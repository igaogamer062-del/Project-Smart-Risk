import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { classifyWithGroq } from "../_shared/groq.ts";
import { AlertNormalizationService, type ProviderEvent } from "../_shared/tracking.ts";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const configuredSecret = Deno.env.get("TRACKING_INGEST_SECRET");
  if (!configuredSecret || request.headers.get("x-tracking-secret") !== configuredSecret) return json({ error: "Não autorizado" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let inboundId: string | null = null;
  try {
    const event = await request.json() as ProviderEvent;
    let normalized;
    try { normalized = new AlertNormalizationService().normalize(event); }
    catch (validationError) { return json({ error: validationError instanceof Error ? validationError.message : "Payload inválido." }, 400); }
    const provider = normalized.provider;
    const eventCode = normalized.providerAlertCode;
    const occurredAt = normalized.occurredAt;
    const plate = normalized.plate;
    const fallbackKey = await sha256([provider, eventCode, plate, occurredAt, event.latitude ?? "", event.longitude ?? ""].join("|"));
    const inserted = await db.from("tracking_inbound_events").insert({ provider, provider_event_id: event.provider_event_id || null, fallback_key: fallbackKey, payload: event }).select("id").single();
    if (inserted.error?.code === "23505") return json({ ok: true, duplicate: true, message: "Evento já processado." });
    if (inserted.error) throw inserted.error;
    inboundId = inserted.data.id;

    const mapped = await db.from("tracking_alert_mappings").select("*").eq("provider", provider).eq("provider_alert_code", eventCode).eq("active", true).maybeSingle();
    if (mapped.error) throw mapped.error;
    if (!mapped.data) {
      await db.from("tracking_inbound_events").update({ processing_status: "IGNORED", processed_at: new Date().toISOString() }).eq("id", inboundId);
      await db.from("tracking_audit_logs").insert({ actor_type: "SYSTEM", component: "AlertNormalizationService", action: "Evento recebido e ignorado por não possuir mapeamento ativo.", entity_type: "tracking_inbound_event", entity_id: inboundId, metadata: { provider, event_code: eventCode } });
      return json({ ok: true, ignored: true, message: "Evento armazenado para auditoria; tipo não habilitado." });
    }
    if (!mapped.data.creates_operational_alert) {
      await db.from("tracking_inbound_events").update({ processing_status: "IGNORED", processed_at: new Date().toISOString() }).eq("id", inboundId);
      return json({ ok: true, ignored: true, message: "Mapeamento configurado para não gerar alerta operacional." });
    }

    let resolvedBaseId = event.base_id || null;
    if (!resolvedBaseId && event.transporter_id) {
      const baseLink = await db.from("base_transporters").select("base_id").eq("transporter_id", event.transporter_id).eq("active", true).limit(1).maybeSingle();
      if (baseLink.error) throw baseLink.error;
      resolvedBaseId = baseLink.data?.base_id || null;
    }

    let aiResult: unknown = null;
    let aiAvailable: boolean | null = null;
    let normalizedType = mapped.data.normalized_type;
    let severity = mapped.data.severity;
    if (mapped.data.requires_ai) {
      try {
        aiResult = await classifyWithGroq(event, mapped.data.ai_instructions || "");
        aiAvailable = true;
        normalizedType = (aiResult as { alert_type: string }).alert_type;
        severity = (aiResult as { severity: string }).severity;
        await db.from("tracking_audit_logs").insert({ actor_type: "AI", component: "Groq", action: "Classificação realizada.", entity_type: "tracking_inbound_event", entity_id: inboundId, metadata: aiResult });
      } catch (error) {
        aiAvailable = false;
        console.error("Groq indisponível; seguindo regra determinística", error instanceof Error ? error.message : error);
        await db.from("tracking_audit_logs").insert({ actor_type: "SYSTEM", component: "AlertClassificationService", action: "Groq indisponível; classificação determinística preservada.", entity_type: "tracking_inbound_event", entity_id: inboundId, metadata: { error: error instanceof Error ? error.message : "Falha desconhecida" } });
      }
    }

    const deadline = new Date(Date.now() + Number(mapped.data.treatment_timeout_minutes || 60) * 60_000).toISOString();
    const alert = await db.from("tracking_alerts").insert({
      inbound_event_id: inboundId, provider, provider_event_id: event.provider_event_id || null,
      alert_type: normalizedType, severity, priority: mapped.data.priority,
      vehicle_id: event.vehicle?.id || null, plate, driver_id: event.driver?.id || null, driver_name: event.driver?.name || null,
      transporter_id: event.transporter_id || null, base_id: resolvedBaseId, operation_name: event.operation || null,
      occurred_at: occurredAt, latitude: event.latitude ?? null, longitude: event.longitude ?? null, location_text: event.location || null,
      description: event.description || mapped.data.description || null,
      status: mapped.data.requires_treatment ? "PENDING_TREATMENT" : "TREATED",
      deadline_at: deadline,
      treated_at: mapped.data.requires_treatment ? null : new Date().toISOString(),
      visible_until: mapped.data.requires_treatment ? null : new Date(Date.now() + 10 * 60_000).toISOString(),
      ai_used: Boolean(mapped.data.requires_ai), ai_available: aiAvailable, ai_result: aiResult, raw_payload: event,
    }).select("id,status,deadline_at").single();
    if (alert.error) throw alert.error;
    await db.from("tracking_inbound_events").update({ processing_status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", inboundId);
    await db.from("tracking_alert_timeline").insert({ alert_id: alert.data.id, actor_type: "SYSTEM", actor_name: "TrackingIntegrationService", action: "Alerta operacional criado.", details: { provider, provider_event_id: event.provider_event_id || null } });
    await db.from("tracking_audit_logs").insert({ actor_type: "SYSTEM", component: "AlertWorkflowService", action: "Alerta criado com prazo determinístico.", entity_type: "tracking_alert", entity_id: alert.data.id, metadata: { deadline_at: deadline } });
    return json({ ok: true, duplicate: false, alert: alert.data }, 201);
  } catch (error) {
    console.error("tracking-ingest", error instanceof Error ? error.message : error);
    if (inboundId) await db.from("tracking_inbound_events").update({ processing_status: "ERROR", processing_error: error instanceof Error ? error.message : "Erro desconhecido", processed_at: new Date().toISOString() }).eq("id", inboundId);
    return json({ ok: false, error: "Falha ao processar evento." }, 500);
  }
});
