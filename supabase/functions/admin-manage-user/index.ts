import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const roles = new Set(["Operador","Lider","Supervisor","Coordenador","Gerente","Administrador","Cliente"]);

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) throw new Error("Configuração segura do Supabase indisponível.");

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sessão obrigatória." }, 401);

    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const authResult = await admin.auth.getUser(token);
    if (authResult.error || !authResult.data.user) return response({ error: "Sessão inválida." }, 401);

    const body = await request.json();
    const targetId = String(body.user_id || "");
    const action = String(body.action || "update");
    if (!targetId) return response({ error: "Usuário de destino não informado." }, 400);

    const callerId = authResult.data.user.id;
    const caller = await admin.from("profiles").select("access_role,active,must_change_password").eq("id", callerId).single();
    if (caller.error || !caller.data?.active) return response({ error: "Acesso não permitido." }, 403);

    if (action === "complete-password-change") {
      if (targetId !== callerId || caller.data.must_change_password !== true) {
        return response({ error: "A troca obrigatória de senha não está disponível para esta conta." }, 403);
      }
      const password = String(body.password || "");
      if (password.length < 8) return response({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
      const authUpdate = await admin.auth.admin.updateUserById(callerId, { password });
      if (authUpdate.error) throw authUpdate.error;
      const profileUpdate = await admin.from("profiles").update({ must_change_password: false, password_changed_at: new Date().toISOString() }).eq("id", callerId);
      if (profileUpdate.error) throw profileUpdate.error;
      return response({ success: true });
    }

    let canManage = caller.data.access_role === "Administrador";
    if (action === "reset-password" && !canManage) {
      const override = await admin.from("user_permission_overrides").select("allowed").eq("user_id", callerId).eq("permission_key", "users_reset_password").maybeSingle();
      if (override.error) throw override.error;
      if (override.data) canManage = override.data.allowed === true;
      else {
        const rolePermission = await admin.from("role_permissions").select("allowed").eq("access_role", caller.data.access_role).eq("permission_key", "users_reset_password").maybeSingle();
        if (rolePermission.error) throw rolePermission.error;
        canManage = rolePermission.data?.allowed === true;
      }
    }
    if (!canManage) return response({ error: "Acesso não permitido." }, 403);

    if (action === "reset-password") {
      const password = String(body.password || "");
      if (password.length < 8) return response({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
      const authUpdate = await admin.auth.admin.updateUserById(targetId, { password });
      if (authUpdate.error) throw authUpdate.error;
      const profileUpdate = await admin.from("profiles").update({ must_change_password: true }).eq("id", targetId);
      if (profileUpdate.error) throw profileUpdate.error;
      return response({ success: true });
    }

    if (action === "set-active") {
      const active = body.active === true;
      if (!active && targetId === authResult.data.user.id) return response({ error: "Você não pode desativar o próprio acesso." }, 400);
      const profileResult = await admin.from("profiles").update({ active }).eq("id", targetId).select("*").single();
      if (profileResult.error) throw profileResult.error;
      const authUpdate = await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
      if (authUpdate.error) throw authUpdate.error;
      if (!active) {
        try { await admin.auth.admin.signOut(targetId, "global"); } catch (_) { /* sessão expira pelo banimento */ }
      }
      return response({ profile: profileResult.data });
    }

    if (action !== "update") return response({ error: "Ação inválida." }, 400);

    const username = String(body.username || "").trim();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const accessRole = roles.has(body.access_role) ? body.access_role : "Operador";
    if (accessRole !== "Cliente" && !body.manager_id) return response({ error: "Informe o gestor responsável." }, 400);
    if (accessRole === "Operador" && !body.base_id) return response({ error: "Informe a base do operador." }, 400);
    if (accessRole === "Cliente" && !body.transporter_id) return response({ error: "Informe a transportadora do cliente." }, 400);
    if (!username || !fullName || !email) return response({ error: "Nome, usuário e e-mail são obrigatórios." }, 400);
    if (password && password.length < 8) return response({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);

    const duplicate = await admin.from("profiles").select("id").ilike("username", username).neq("id", targetId).maybeSingle();
    if (duplicate.data) return response({ error: "Este nome de usuário já está em uso." }, 409);

    let baseName: string | null = null;
    if (accessRole === "Operador") {
      const base = await admin.from("operational_bases").select("name").eq("id", body.base_id).eq("active", true).single();
      if (base.error) return response({ error: "Base inválida ou inativa." }, 400);
      baseName = base.data.name;
    }
    if (accessRole === "Cliente") {
      const carrier = await admin.from("transporters").select("id").eq("id", body.transporter_id).eq("active", true).single();
      if (carrier.error) return response({ error: "Transportadora inválida ou inativa." }, 400);
    }
    const authChanges: Record<string, unknown> = { email, email_confirm: true };
    if (password) authChanges.password = password;
    const authUpdate = await admin.auth.admin.updateUserById(targetId, authChanges);
    if (authUpdate.error) throw authUpdate.error;

    const profileChanges: Record<string, unknown> = {
      username,
      full_name: fullName,
      email,
      employee_code: String(body.employee_code || "").trim() || undefined,
      job_title: accessRole,
      access_role: accessRole,
      base_id: accessRole === "Operador" ? body.base_id : null,
      base_name: baseName,
      transporter_id: accessRole === "Cliente" ? body.transporter_id : null,
      manager_id: accessRole === "Cliente" ? null : body.manager_id,
      hire_date: body.hire_date || null,
      notes: String(body.notes || "").trim() || null,
      notifications_enabled: body.notifications_enabled !== false,
      notification_preferences: body.notification_preferences || { sinistro: true, ferias: true, sistema: true, alertas: true },
    };
    Object.keys(profileChanges).forEach((key) => profileChanges[key] === undefined && delete profileChanges[key]);
    const profileResult = await admin.from("profiles").update(profileChanges).eq("id", targetId).select("*").single();
    if (profileResult.error) throw profileResult.error;
    return response({ profile: profileResult.data });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
