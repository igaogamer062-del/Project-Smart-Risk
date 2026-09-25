import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const leadershipRoles = ["Lider", "Supervisor", "Coordenador", "Gerente", "Administrador"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const secret = Deno.env.get("TRACKING_INGEST_SECRET");
  if (!secret) return json({ error: "Integração de teste não configurada" }, 503);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const suppliedSecret = request.headers.get("x-tracking-secret");
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  let authorized = suppliedSecret === secret;
  if (!authorized && bearer) {
    const userResult = await db.auth.getUser(bearer);
    if (userResult.data.user) {
      const profile = await db.from("profiles").select("access_role,active").eq("id", userResult.data.user.id).maybeSingle();
      authorized = profile.data?.active === true && profile.data?.access_role === "Administrador";
    }
  }
  if (!authorized) return json({ error: "Não autorizado" }, 401);

  try {
    const body = await request.json();
    const alertId = String(body.alert_id || "").trim();
    const result = String(body.result || "").trim().toUpperCase();
    const reason = String(body.reason || "").trim();
    const contactResult = body.contact_result == null ? null : String(body.contact_result).trim().toUpperCase();

    if (!alertId || !["CORRECT", "INCORRECT"].includes(result)) {
      return json({ error: "Informe alert_id e result CORRECT ou INCORRECT." }, 400);
    }
    if (reason.length < 3) return json({ error: "Informe o motivo da validação." }, 400);
    if (result === "CORRECT" && !["SUCCESS", "NO_SUCCESS"].includes(contactResult || "")) {
      return json({ error: "Uma ocorrência correta exige contact_result SUCCESS ou NO_SUCCESS." }, 400);
    }

    const current = await db.from("tracking_alerts")
      .select("id,plate,status,transporter_id,occurrence_summary")
      .eq("id", alertId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "Alerta não encontrado." }, 404);
    if (["TREATED", "ARCHIVED", "DISCARDED"].includes(current.data.status)) {
      return json({ error: "O alerta já foi encerrado." }, 409);
    }

    const now = new Date();
    const forwardAt = result === "CORRECT" && contactResult === "NO_SUCCESS" && current.data.transporter_id
      ? new Date(now.getTime() + 60_000).toISOString()
      : null;
    const deadline = new Date(now.getTime() + (result === "INCORRECT" ? 10 : 60) * 60_000).toISOString();

    const updated = await db.from("tracking_alerts").update({
      occurrence_check_status: result,
      occurrence_checked_at: now.toISOString(),
      occurrence_checked_by: null,
      occurrence_validation_reason: reason,
      occurrence_validation_source: String(body.source || "TEST_OCCURRENCE_PROVIDER"),
      contact_result: result === "CORRECT" ? contactResult : null,
      client_forward_at: forwardAt,
      deadline_at: deadline,
      status: "IN_TREATMENT",
      updated_at: now.toISOString(),
    }).eq("id", alertId).select("id,status,occurrence_check_status,contact_result,client_forward_at").single();
    if (updated.error) throw updated.error;

    const action = result === "CORRECT" ? "Ocorrência validada como correta pelo integrador." : "Ocorrência validada como incorreta pelo integrador.";
    const timeline = await db.from("tracking_alert_timeline").insert({
      alert_id: alertId,
      actor_type: "SYSTEM",
      actor_name: "OccurrenceIntegrationService",
      action,
      details: { reason, contact_result: result === "CORRECT" ? contactResult : null, source: body.source || "TEST_OCCURRENCE_PROVIDER" },
    });
    if (timeline.error) throw timeline.error;

    const leaders = await db.from("profiles")
      .select("id,notifications_enabled,notification_preferences")
      .eq("active", true).in("access_role", leadershipRoles);
    if (leaders.error) throw leaders.error;
    const notifications = (leaders.data || []).filter((profile) =>
      profile.notifications_enabled !== false && profile.notification_preferences?.alertas !== false
    ).map((profile) => ({
      user_id: profile.id,
      title: result === "CORRECT" ? "Ocorrência correta" : "Ocorrência incorreta",
      message: `${current.data.plate || "Veículo"}: ${reason}`,
      priority: result === "CORRECT" ? "HIGH" : "URGENT",
      alert_id: alertId,
    }));
    if (notifications.length) {
      const inserted = await db.from("user_notifications").insert(notifications);
      if (inserted.error) throw inserted.error;
    }

    await db.from("tracking_audit_logs").insert({
      actor_type: "SYSTEM",
      component: "OccurrenceIntegrationService",
      action,
      entity_type: "tracking_alert",
      entity_id: alertId,
      metadata: { result, reason, contact_result: result === "CORRECT" ? contactResult : null },
    });

    return json({ data: updated.data });
  } catch (error) {
    console.error("tracking-occurrence-provider", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível processar o resultado da ocorrência." }, 500);
  }
});
