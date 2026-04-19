export const N8N_FACTORY_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

export const N8N_REVIEW_WEBHOOK =
  process.env.N8N_REVIEW_WEBHOOK || N8N_FACTORY_WEBHOOK;

export type ChatContextMsg = { role?: string; content?: string };

export function extractMessage(data: Record<string, unknown>): string {
  const candidates = [
    data.output,
    data.answer,
    data.message,
    data.answer_raw,
    data.text,
    data.reply,
    data.suggested_reply,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return JSON.stringify(data);
}

export function normalizeContext(context: ChatContextMsg[]) {
  if (!Array.isArray(context)) return [];
  return context
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-10)
    .map((m) => ({ role: m.role as string, content: m.content as string }));
}

export async function callFactoryN8n(payload: Record<string, unknown>) {
  const response = await fetch(N8N_FACTORY_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    data = { output: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText,
  };
}

export async function callReviewN8n(payload: Record<string, unknown>) {
  const response = await fetch(N8N_REVIEW_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    data = { output: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText,
  };
}

/** Split for SSE typing effect; keeps spaces and newlines */
export function* streamChunks(text: string, maxLen = 20): Generator<string> {
  if (!text) return;
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const nl = rest.indexOf("\n");
    if (nl !== -1 && nl < maxLen) {
      yield rest.slice(0, nl + 1);
      i += nl + 1;
      continue;
    }
    const space = rest.lastIndexOf(" ", maxLen);
    const take =
      space > 0 && space < maxLen ? space + 1 : Math.min(maxLen, rest.length);
    yield rest.slice(0, take);
    i += take;
  }
}
