import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const { username, password } = await request.json();
    if (!username || !password) return json({ error: "Informe login e senha." }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const found = await admin.from("profiles").select("email,active").ilike("username", String(username).trim()).maybeSingle();
    if (found.error || !found.data?.active) return json({ error: "Login ou senha inválidos." }, 401);
    const auth = createClient(url, anonKey, { auth: { persistSession: false } });
    const result = await auth.auth.signInWithPassword({ email: found.data.email, password: String(password) });
    if (result.error || !result.data.session) return json({ error: "Login ou senha inválidos." }, 401);
    return json({
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
      expires_at: result.data.session.expires_at,
    });
  } catch (error) {
    console.error("login-username", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível entrar agora." }, 500);
  }
});
