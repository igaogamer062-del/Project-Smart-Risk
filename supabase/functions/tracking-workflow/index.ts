import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const expected = Deno.env.get("TRACKING_INGEST_SECRET");
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || auth !== expected) return json({ error: "Não autorizado" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const result = await db.rpc("tracking_workflow_tick");
  if (result.error) {
    console.error("tracking-workflow", result.error.message);
    return json({ error: result.error.message }, 500);
  }
  return json({ ok: true, result: result.data });
});

