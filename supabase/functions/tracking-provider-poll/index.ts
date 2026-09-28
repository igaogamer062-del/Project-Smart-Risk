import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type SimulatorVehicle = {
  id?: string; provider_vehicle_id?: string; plate?: string; transporter?: string; trip?: string; trailer?: string;
  latitude?: number; longitude?: number; speed?: number; drivers?: { id?: string; name?: string };
};
type SimulatorOccurrence = {
  id?: string; vehicle_id?: string; plate?: string; event_type?: string; severity?: string; description?: string;
  latitude?: number; longitude?: number; speed?: number; status?: string; occurred_at?: string;
  vehicle?: SimulatorVehicle; vehicles?: SimulatorVehicle;
};

const PROVIDER = "LOVABLE_SIMULATOR";
const normalizeName = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function extractRows<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record[key])) return record[key] as T[];
    if (record.data && typeof record.data === "object" && Array.isArray((record.data as Record<string, unknown>)[key])) return (record.data as Record<string, unknown>)[key] as T[];
  }
  return [];
}
async function providerGet(baseUrl: string, path: string, apiKey?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const response = await fetch(new URL(path, baseUrl), { headers, signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Simulador respondeu HTTP ${response.status}: ${body.slice(0, 300)}`);
  try { return JSON.parse(body); } catch { throw new Error("O simulador retornou uma resposta que não é JSON."); }
}
async function providerGetWithPublicFallback(baseUrl: string, protectedPath: string, publicPath: string, apiKey: string) {
  try {
    return await providerGet(baseUrl, protectedPath, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/HTTP (401|403)/.test(message)) throw error;
    return providerGet(baseUrl, publicPath);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const internalSecret = Deno.env.get("TRACKING_INGEST_SECRET");
  const cronSecret = Deno.env.get("TRACKING_CRON_SECRET");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const trackingSecret = request.headers.get("x-tracking-secret");
  const authorized = Boolean(
    internalSecret && (authorization === internalSecret || trackingSecret === internalSecret)
  ) || Boolean(cronSecret && authorization === cronSecret)
    || Boolean(serviceRole && authorization === serviceRole);
  if (!authorized) return json({ error: "Não autorizado" }, 401);
  const baseUrl = Deno.env.get("TRACKING_PROVIDER_BASE_URL")?.replace(/\/+$/, "");
  const apiKey = Deno.env.get("TRACKING_PROVIDER_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl || !apiKey || !supabaseUrl || !serviceRole) return json({ error: "Credenciais do provider ou do Supabase não configuradas." }, 500);

  const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const cursorResult = await db.from("tracking_sync_cursors").select("*").eq("provider", PROVIDER).maybeSingle();
  const previous = cursorResult.data || { received_count: 0, processed_count: 0, ignored_count: 0, error_count: 0 };
  let received = 0, processed = 0, ignored = 0, errors = 0;
  try {
    const [occurrencePayload, vehiclePayload, transportersResult, mappingsResult, baseLinksResult] = await Promise.all([
      providerGetWithPublicFallback(baseUrl, "/api/public/v1/occurrences?status=aberta&limit=100", "/api/public/tracking/occurrences?status=aberta&limit=100", apiKey),
      providerGetWithPublicFallback(baseUrl, "/api/public/v1/vehicles", "/api/public/tracking/vehicles", apiKey),
      db.from("transporters").select("id,name").eq("active", true),
      db.from("tracking_alert_mappings").select("provider_alert_code,transporter_id").eq("provider", PROVIDER).eq("active", true),
      db.from("base_transporters").select("base_id,transporter_id").eq("active", true),
    ]);
    if (transportersResult.error) throw transportersResult.error;
    if (mappingsResult.error) throw mappingsResult.error;
    if (baseLinksResult.error) throw baseLinksResult.error;
    const occurrences = extractRows<SimulatorOccurrence>(occurrencePayload, "occurrences");
    const vehicles = extractRows<SimulatorVehicle>(vehiclePayload, "vehicles");
    received = occurrences.length;
    let newestEventAt = previous.last_event_at || null;
    let newestCursor = previous.last_cursor || null;
    for (const occurrence of occurrences) {
      try {
        const embedded = occurrence.vehicle || occurrence.vehicles;
        const vehicle = embedded || vehicles.find((item) => item.id === occurrence.vehicle_id || item.provider_vehicle_id === occurrence.vehicle_id || item.plate === occurrence.plate);
        const plate = String(occurrence.plate || vehicle?.plate || "").trim().toUpperCase();
        const eventType = String(occurrence.event_type || "").trim();
        const eventId = String(occurrence.id || "").trim();
        const occurredAt = occurrence.occurred_at || new Date().toISOString();
        if (!eventId || !eventType || !plate) throw new Error("Ocorrência sem id, event_type ou placa.");
        const externalTransporter = normalizeName(vehicle?.transporter);
        let transporterId = (transportersResult.data || []).find((item) => normalizeName(item.name) === externalTransporter)?.id || null;
        if (!transporterId) {
          const specific = (mappingsResult.data || []).filter((item) => item.provider_alert_code === eventType && item.transporter_id);
          if (specific.length === 1) transporterId = specific[0].transporter_id;
        }
        const baseId = transporterId ? (baseLinksResult.data || []).find((item) => item.transporter_id === transporterId)?.base_id || null : null;
        const normalizedEvent = {
          provider: PROVIDER, provider_event_id: eventId,
          vehicle: { id: vehicle?.provider_vehicle_id || vehicle?.id || occurrence.vehicle_id, plate },
          driver: { id: vehicle?.drivers?.id, name: vehicle?.drivers?.name },
          transporter_id: transporterId, base_id: baseId, operation: vehicle?.trip, event_type: eventType,
          description: occurrence.description || `${eventType.replaceAll("_", " ")} · severidade ${occurrence.severity || "não informada"}`,
          event_time: occurredAt, latitude: occurrence.latitude ?? vehicle?.latitude, longitude: occurrence.longitude ?? vehicle?.longitude,
          location: vehicle?.trip, source_occurrence: occurrence, source_vehicle: vehicle || null,
        };
        const ingestResponse = await fetch(`${supabaseUrl}/functions/v1/tracking-ingest`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-tracking-secret": internalSecret },
          body: JSON.stringify(normalizedEvent), signal: AbortSignal.timeout(20_000),
        });
        const ingestBody = await ingestResponse.json().catch(() => ({}));
        if (!ingestResponse.ok) throw new Error(`tracking-ingest HTTP ${ingestResponse.status}`);
        if (ingestBody.duplicate || ingestBody.ignored) ignored += 1; else processed += 1;
        if (!newestEventAt || new Date(occurredAt) > new Date(newestEventAt)) { newestEventAt = occurredAt; newestCursor = eventId; }
      } catch (eventError) {
        errors += 1;
        console.error("tracking-provider-poll event", occurrence.id, eventError instanceof Error ? eventError.message : eventError);
      }
    }
    await db.from("tracking_sync_cursors").upsert({
      provider: PROVIDER, last_cursor: newestCursor, last_event_at: newestEventAt, last_run_at: new Date().toISOString(),
      received_count: Number(previous.received_count || 0) + received, processed_count: Number(previous.processed_count || 0) + processed,
      ignored_count: Number(previous.ignored_count || 0) + ignored, error_count: Number(previous.error_count || 0) + errors,
      last_error: errors ? `${errors} evento(s) não processado(s) nesta execução.` : null,
    }, { onConflict: "provider" });
    await db.from("tracking_audit_logs").insert({ actor_type: "SYSTEM", component: "TrackingIntegrationService", action: "Consulta ao simulador concluída.", entity_type: "tracking_provider", entity_id: PROVIDER, metadata: { received, processed, ignored, errors } });
    return json({ ok: true, provider: PROVIDER, received, processed, ignored, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("tracking-provider-poll", message);
    await db.from("tracking_sync_cursors").upsert({
      provider: PROVIDER, last_run_at: new Date().toISOString(), received_count: Number(previous.received_count || 0),
      processed_count: Number(previous.processed_count || 0), ignored_count: Number(previous.ignored_count || 0),
      error_count: Number(previous.error_count || 0) + 1, last_error: message.slice(0, 1000),
    }, { onConflict: "provider" });
    return json({ ok: false, error: "Falha ao consultar o simulador.", detail: message }, 502);
  }
});
