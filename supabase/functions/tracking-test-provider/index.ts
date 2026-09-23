import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { TestTrackingProvider } from "../_shared/tracking.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("TRACKING_INGEST_SECRET");
  if (!secret) return json({ error: "Simulador não configurado" }, 503);
  const suppliedSecret = request.headers.get("x-tracking-secret");
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  let authorized = suppliedSecret === secret;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!authorized && bearer) {
    const userResult = await db.auth.getUser(bearer);
    if (userResult.data.user) {
      const profile = await db.from("profiles").select("access_role,active").eq("id", userResult.data.user.id).maybeSingle();
      authorized = profile.data?.active === true && profile.data?.access_role === "Administrador";
    }
  }
  if (!authorized) return json({ error: "Não autorizado" }, 401);
  try {
    const override = await request.json().catch(() => ({}));
    const sample = new TestTrackingProvider().toSmartRiskEvent({
      provider_event_id: override.provider_event_id || crypto.randomUUID(),
      vehicle: override.vehicle || { plate: "ABC1D23" },
      driver: override.driver || { name: "Condutor de teste" },
      transporter_id: override.transporter_id || null,
      base_id: override.base_id || null,
      event_type: override.event_type || "PANIC_BUTTON",
      event_time: override.event_time || new Date().toISOString(),
      latitude: override.latitude ?? -23.5505,
      longitude: override.longitude ?? -46.6333,
      location: override.location || "São Paulo/SP",
      description: override.description || "Evento gerado pelo provider HTTP de desenvolvimento.",
    });
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tracking-secret": secret },
      body: JSON.stringify(sample),
    });
    return json({ provider: "TEST_PROVIDER", forwarded_event: sample, smart_risk_response: await response.json() }, response.status);
  } catch (error) {
    console.error("tracking-test-provider", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível simular o integrador." }, 500);
  }
});
