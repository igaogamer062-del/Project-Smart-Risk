import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const roles = new Set(["Operador","Lider","Supervisor","Coordenador","Gerente","Administrador","Cliente"]);
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Configuração segura do Supabase indisponível.");
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const authResult = await admin.auth.getUser(token);
    if (authResult.error || !authResult.data.user) return reply({ error: "Sessão inválida." }, 401);
    const caller = await admin.from("profiles").select("access_role,active").eq("id", authResult.data.user.id).single();
    if (caller.error || !caller.data?.active || caller.data.access_role !== "Administrador") return reply({ error: "Somente Administradores podem criar usuários." }, 403);

    const body = await request.json();
    const username = String(body.username || "").trim();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const accessRole = roles.has(body.access_role) ? String(body.access_role) : "Operador";
    if (accessRole !== "Cliente" && !body.manager_id) return reply({ error: "Informe o gestor responsável." }, 400);
    if (accessRole === "Operador" && !body.base_id) return reply({ error: "Informe a base do operador." }, 400);
    if (accessRole === "Cliente" && !body.transporter_id) return reply({ error: "Informe a transportadora do cliente." }, 400);
    if (!username || !fullName || !email || password.length < 8) return reply({ error: "Nome, usuário, e-mail e senha de 8 caracteres são obrigatórios." }, 400);
    const duplicate = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (duplicate.data) return reply({ error: "Este nome de usuário já está em uso." }, 409);

    let baseName: string | null = null;
    if (accessRole === "Operador") {
      const base = await admin.from("operational_bases").select("name").eq("id", body.base_id).eq("active", true).single();
      if (base.error) return reply({ error: "Base inválida ou inativa." }, 400);
      baseName = base.data.name;
    }
    if (accessRole === "Cliente") {
      const carrier = await admin.from("transporters").select("id").eq("id", body.transporter_id).eq("active", true).single();
      if (carrier.error) return reply({ error: "Transportadora inválida ou inativa." }, 400);
    }
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, full_name: fullName } });
    if (created.error || !created.data.user) throw created.error || new Error("Usuário não criado.");
    const id = created.data.user.id;
    const profile: Record<string, unknown> = {
      id, username, full_name: fullName, email,
      employee_code: String(body.employee_code || "").trim() || undefined,
      job_title: accessRole, access_role: accessRole,
      base_id: accessRole === "Operador" ? body.base_id : null,
      base_name: baseName,
      transporter_id: accessRole === "Cliente" ? body.transporter_id : null,
      manager_id: accessRole === "Cliente" ? null : body.manager_id,
      hire_date: body.hire_date || null, notes: String(body.notes || "").trim() || null,
      active: true, notifications_enabled: body.notifications_enabled !== false,
      notification_preferences: body.notification_preferences || { sinistro: true, ferias: true, sistema: true, alertas: true, chamados: true },
    };
    Object.keys(profile).forEach((key) => profile[key] === undefined && delete profile[key]);
    const saved = await admin.from("profiles").upsert(profile).select("*").single();
    if (saved.error) {
      await admin.auth.admin.deleteUser(id);
      throw saved.error;
    }
    return reply({ profile: saved.data }, 201);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
