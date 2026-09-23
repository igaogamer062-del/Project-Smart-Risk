import { classifyWithGroq } from "../_shared/groq.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sample = await request.json().catch(() => ({ event_type: "PANIC_BUTTON", description: "Botão de pânico acionado pelo veículo ABC1D23" }));
    return json({ ok: true, classification: await classifyWithGroq(sample) });
  } catch (error) {
    console.error("groq-test", error instanceof Error ? error.message : error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Falha na Groq" }, 502);
  }
});

