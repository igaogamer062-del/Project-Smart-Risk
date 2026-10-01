import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { classifyOccurrenceWithGroq } from "../_shared/groq.ts";

const leadershipRoles = ["Lider", "Supervisor", "Coordenador", "Gerente", "Administrador"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const secret = Deno.env.get("TRACKING_INGEST_SECRET");
  if (!secret) return json({ error: "Integração de ocorrências não configurada" }, 503);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const suppliedSecret = request.headers.get("x-tracking-secret");
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  let authorized = suppliedSecret === secret;
  if (!authorized && bearer) {
    const authResult = await db.auth.getUser(bearer);
    if (authResult.data.user) {
      const profile = await db.from("profiles").select("access_role,active").eq("id", authResult.data.user.id).maybeSingle();
      authorized = profile.data?.active === true && profile.data?.access_role === "Administrador";
    }
  }
  if (!authorized) return json({ error: "Não autorizado" }, 401);

  try {
    const body = await request.json();
    const alertId = String(body.alert_id || "").trim();
    const occurrenceText = String(body.occurrence_text || body.reason || body.description || "").trim();
    if (!alertId || occurrenceText.length < 3) return json({ error: "Informe alert_id e o texto da ocorrência." }, 400);

    const current = await db.from("tracking_alerts").select("*").eq("id", alertId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "Alerta não encontrado." }, 404);
    if (["TREATED", "ARCHIVED", "DISCARDED"].includes(current.data.status)) return json({ error: "O alerta já foi encerrado." }, 409);

    let instructions = "";
    if (current.data.transporter_id) {
      const knowledge = await db.from("transporter_knowledge_documents")
        .select("title,description,extracted_text").eq("transporter_id", current.data.transporter_id)
        .eq("scope", "ALERT_AI").eq("active", true);
      if (knowledge.error) throw knowledge.error;
      instructions = (knowledge.data || []).map((item) =>
        [`Documento: ${item.title}`, item.description || "", item.extracted_text || ""].filter(Boolean).join("\n")
      ).join("\n\n").slice(0, 16000);
    }

    let classification;
    try {
      classification = await classifyOccurrenceWithGroq({
        alert: { type: current.data.alert_type, plate: current.data.plate, description: current.data.description, occurred_at: current.data.occurred_at },
        occurrence: occurrenceText,
      }, instructions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      await db.from("tracking_alerts").update({ occurrence_summary: occurrenceText, occurrence_received_at: new Date().toISOString(),
        occurrence_ai_available: false, workflow_stage: "AWAITING_AI_REVIEW", updated_at: new Date().toISOString() }).eq("id", alertId);
      await db.from("tracking_audit_logs").insert({ actor_type: "SYSTEM", component: "OccurrenceClassificationService",
        action: "Groq indisponível; ocorrência preservada para nova análise.", entity_type: "tracking_alert", entity_id: alertId, metadata: { error: message } });
      return json({ ok: true, pending_ai: true, message: "Ocorrência recebida e preservada. A classificação por IA será refeita." }, 202);
    }

    const now = new Date().toISOString();
    const occurrenceStatus = classification.occurrence_correct ? "CORRECT" : "INCORRECT";
    const updated = await db.from("tracking_alerts").update({
      occurrence_check_status: occurrenceStatus,
      contact_result: classification.contact_result,
      occurrence_summary: occurrenceText,
      occurrence_received_at: now,
      occurrence_checked_at: now,
      occurrence_checked_by: null,
      occurrence_validation_reason: classification.reason,
      occurrence_validation_source: "GROQ",
      occurrence_ai_result: classification,
      occurrence_ai_available: true,
      workflow_stage: "OCCURRENCE_READY",
      status: "IN_TREATMENT",
      updated_at: now,
    }).eq("id", alertId).select("id,status,workflow_stage,occurrence_check_status,contact_result,initial_check_at").single();
    if (updated.error) throw updated.error;

    await db.from("tracking_alert_timeline").insert({ alert_id: alertId, actor_type: "AI", actor_name: "Groq",
      action: classification.occurrence_correct ? "Ocorrência classificada como correta." : "Ocorrência classificada como incorreta.",
      details: classification });
    await db.from("tracking_audit_logs").insert({ actor_type: "AI", component: "Groq", action: "Classificação da ocorrência realizada.",
      entity_type: "tracking_alert", entity_id: alertId, metadata: classification });

    const leaders = await db.from("profiles").select("id,notifications_enabled,notification_preferences").eq("active", true).in("access_role", leadershipRoles);
    if (leaders.error) throw leaders.error;
    const notifications = (leaders.data || []).filter((profile) => profile.notifications_enabled !== false && profile.notification_preferences?.alertas !== false)
      .map((profile) => ({ user_id: profile.id, title: classification.occurrence_correct ? "Ocorrência analisada" : "Ocorrência incorreta",
        message: `${current.data.plate || "Veículo"}: ${classification.reason}`, priority: classification.occurrence_correct ? "HIGH" : "URGENT", alert_id: alertId }));
    if (notifications.length) { const result = await db.from("user_notifications").insert(notifications); if (result.error) throw result.error; }

    await db.rpc("tracking_workflow_tick");
    return json({ data: updated.data, classification });
  } catch (error) {
    console.error("tracking-occurrence-provider", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível processar a ocorrência." }, 500);
  }
});
