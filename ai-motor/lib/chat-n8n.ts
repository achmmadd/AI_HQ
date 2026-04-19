export const N8N_FACTORY_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

export const N8N_REVIEW_WEBHOOK =
  process.env.N8N_REVIEW_WEBHOOK || N8N_FACTORY_WEBHOOK;

export type ChatContextMsg = { role?: string; content?: string };

/** Voor chat: instructie die Dify/n8n helpt géén Factory OS-metadata te tonen. */
export const CHAT_OUTPUT_INSTRUCTION_PREFIX =
  "[Output only the direct answer for the user. No Klant/Agent/Datum lines, no “Samenvatting” or “Volledige response” sections, no Factory OS footer.]\n\n";

/**
 * Haalt de ruwe Factory OS-response uit de n8n “Format”-envelope
 * (# Factory OS Response … ## Volledige response … --- footer).
 */
export function stripFactoryOsResponseEnvelope(text: string): string {
  const t = text.trim();
  if (!t) return t;

  const marker = "## Volledige response";
  const idx = t.indexOf(marker);
  if (idx !== -1) {
    let rest = t.slice(idx + marker.length).replace(/^\s*\n?/, "");
    const foot = rest.search(/\n\n---\s*$/m);
    if (foot !== -1) rest = rest.slice(0, foot);
    const foot2 = rest.indexOf("\n\n---\n");
    if (foot2 !== -1) rest = rest.slice(0, foot2);
    const trimmed = rest.trim();
    if (trimmed) return trimmed;
  }

  if (/^#\s*Factory OS Response/im.test(t) || /\*\*Klant:\*\*/i.test(t)) {
    const m = t.match(
      /##\s*Volledige response\s*\n([\s\S]*?)(?=\n\n---|\s*$)/i
    );
    if (m?.[1]?.trim()) return m[1].trim();
  }

  return t;
}

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
    if (typeof c === "string" && c.trim()) {
      return stripFactoryOsResponseEnvelope(c);
    }
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
