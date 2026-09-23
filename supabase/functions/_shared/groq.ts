export type GroqClassification = {
  alert_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  requires_human_treatment: boolean;
  reason: string;
};

function isClassification(value: unknown): value is GroqClassification {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.alert_type === "string" &&
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(item.severity)) &&
    typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1 &&
    typeof item.requires_human_treatment === "boolean" &&
    typeof item.reason === "string";
}

export async function classifyWithGroq(input: unknown, extraInstructions = ""): Promise<GroqClassification> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "Classifique somente o evento de rastreamento recebido. Não decida prazos, permissões, notificações, escalonamento ou status do workflow. " + extraInstructions },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tracking_alert_classification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                alert_type: { type: "string" },
                severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                confidence: { type: "number" },
                requires_human_treatment: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["alert_type", "severity", "confidence", "requires_human_treatment", "reason"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`Groq respondeu HTTP ${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Resposta da Groq sem conteúdo");
    const parsed = JSON.parse(content);
    if (!isClassification(parsed)) throw new Error("Resposta da Groq fora do schema esperado");
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

