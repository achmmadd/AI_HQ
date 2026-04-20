/**
 * Factory OS via n8n webhook — centrale plek voor URL, context en response-parsing.
 * Zie ook: factory-os/prompts/chat-output-instruction.md
 */

export const N8N_FACTORY_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK?.trim() ||
  "http://127.0.0.1:5678/webhook/factory-os";

const N8N_REVIEW_WEBHOOK =
  process.env.N8N_REVIEW_WEBHOOK?.trim() || N8N_FACTORY_WEBHOOK;

/** Korte prefix voor chat: enkel direct antwoord, geen Factory-metadata in UI. */
export const CHAT_OUTPUT_INSTRUCTION_PREFIX =
  "[Output: alleen de directe nuttige tekst voor de gebruiker. Geen 'Klant:/Agent:/Datum:', geen ## Samenvatting / Volledige response, geen afsluitregel Factory OS.]\n\n";

export type ChatContextMsg = {
  role: string;
  content: string;
};

export type CallFactoryN8nInput = {
  prompt: string;
  klant?: string;
  afdeling?: string;
  type?: string;
  parse_response?: boolean;
  attempt?: number;
  improvement_id?: number;
  agent_mode?: boolean;
  context?: ChatContextMsg[];
  intent?: "action" | "question" | "build";
  platform?: string;
  [key: string]: unknown;
};

export function normalizeContext(raw: unknown): ChatContextMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatContextMsg[] = [];
  for (const item of raw) {
    if (
      typeof item === "object" &&
      item !== null &&
      "role" in item &&
      "content" in item &&
      typeof (item as ChatContextMsg).role === "string" &&
      typeof (item as ChatContextMsg).content === "string"
    ) {
      out.push({
        role: (item as ChatContextMsg).role.slice(0, 64),
        content: (item as ChatContextMsg).content.slice(0, 12_000),
      });
    }
  }
  return out.slice(-24);
}

/** Simuleer streaming door tekst in stukken te splitsen (SSE deltas). */
export function* streamChunks(
  text: string,
  chunkSize: number
): Generator<string> {
  const n = Math.max(1, chunkSize);
  for (let i = 0; i < text.length; i += n) {
    yield text.slice(i, i + n);
  }
}

function buildBody(opts: CallFactoryN8nInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    klant: opts.klant ?? "fumero",
    afdeling: opts.afdeling ?? "fabriek",
  };
  for (const [k, v] of Object.entries(opts)) {
    if (k === "prompt" || k === "klant" || k === "afdeling") continue;
    if (v !== undefined) body[k] = v;
  }
  return body;
}

export async function callFactoryN8n(
  opts: CallFactoryN8nInput,
  extra?: { webhookUrl?: string }
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  rawText: string;
}> {
  const url = extra?.webhookUrl?.trim() || N8N_FACTORY_WEBHOOK;
  const body = buildBody(opts);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      data = { raw: rawText };
    }
    return { ok: res.ok, status: res.status, data, rawText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      data: { error: msg },
      rawText: "",
    };
  }
}

export async function callReviewN8n(payload: {
  type: string;
  klant: string;
  review: {
    reviewer_name: string | null;
    rating: number | null;
    text: string;
  };
}): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  rawText: string;
}> {
  try {
    const res = await fetch(N8N_REVIEW_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      data = { raw: rawText };
    }
    return { ok: res.ok, status: res.status, data, rawText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      data: { error: msg },
      rawText: "",
    };
  }
}

/** Haal tekst uit n8n/Dify/Factory JSON of fallback. */
export function extractMessage(
  data: Record<string, unknown> | null | undefined
): string {
  if (!data) return "";

  const fromObj = (o: Record<string, unknown>): string => {
    for (const k of ["answer", "message", "text", "output"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const direct = fromObj(data);
  if (direct) return direct;

  const nested = data.data;
  if (nested && typeof nested === "object") {
    const inner = fromObj(nested as Record<string, unknown>);
    if (inner) return inner;
  }

  if (Array.isArray(data.messages) && data.messages.length > 0) {
    const last = data.messages[data.messages.length - 1] as Record<
      string,
      unknown
    >;
    if (typeof last?.answer === "string") return last.answer;
  }

  if (typeof data.raw === "string") return data.raw;
  return "";
}
