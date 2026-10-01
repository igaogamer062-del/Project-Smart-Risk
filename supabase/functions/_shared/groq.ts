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


export type GroqOccurrenceClassification = {
  occurrence_correct: boolean;
  contact_result: "SUCCESS" | "NO_SUCCESS";
  requires_client_response: boolean;
  requires_client_notification: boolean;
  confidence: number;
  reason: string;
};

function isOccurrenceClassification(value: unknown): value is GroqOccurrenceClassification {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.occurrence_correct === "boolean" &&
    ["SUCCESS", "NO_SUCCESS"].includes(String(item.contact_result)) &&
    typeof item.requires_client_response === "boolean" &&
    typeof item.requires_client_notification === "boolean" &&
    typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1 &&
    typeof item.reason === "string";
}

export async function classifyOccurrenceWithGroq(input: unknown, extraInstructions = ""): Promise<GroqOccurrenceClassification> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0,
        messages: [
          { role: "system", content: "Analise a ocorrência operacional relacionada ao alerta. Verifique se a descrição é coerente e suficiente e identifique se houve contato com o condutor. Você apenas classifica o conteúdo; não decide prazo, status, escalonamento, permissão ou encerramento. " + extraInstructions },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "tracking_occurrence_classification", strict: true, schema: {
          type: "object",
          properties: {
            occurrence_correct: { type: "boolean" },
            contact_result: { type: "string", enum: ["SUCCESS", "NO_SUCCESS"] },
            requires_client_response: { type: "boolean" },
            requires_client_notification: { type: "boolean" },
            confidence: { type: "number" },
            reason: { type: "string" },
          },
          required: ["occurrence_correct", "contact_result", "requires_client_response", "requires_client_notification", "confidence", "reason"],
          additionalProperties: false,
        } } },
      }),
    });
    if (!response.ok) throw new Error(`Groq respondeu HTTP ${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Resposta da Groq sem conteúdo");
    const parsed = JSON.parse(content);
    if (!isOccurrenceClassification(parsed)) throw new Error("Resposta da Groq fora do schema de ocorrência");
    return parsed;
  } finally { clearTimeout(timeout); }
}

