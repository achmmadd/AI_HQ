/**
 * Factory OS via n8n webhook — centrale plek voor URL + response-parsing.
 */

export const N8N_FACTORY_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK?.trim() ||
  "http://127.0.0.1:5678/webhook/factory-os";

export type CallFactoryN8nInput = {
  prompt: string;
  klant?: string;
  afdeling?: string;
  type?: string;
  parse_response?: boolean;
  attempt?: number;
  improvement_id?: number;
  [key: string]: unknown;
};

export async function callFactoryN8n(opts: CallFactoryN8nInput): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}> {
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    klant: opts.klant ?? "system",
    afdeling: opts.afdeling ?? "fabriek",
  };

  const skip = new Set([
    "prompt",
    "klant",
    "afdeling",
    "type",
    "parse_response",
    "attempt",
    "improvement_id",
  ]);

  if (opts.type != null) body.type = opts.type;
  if (opts.parse_response != null) body.parse_response = opts.parse_response;
  if (opts.attempt != null) body.attempt = opts.attempt;
  if (opts.improvement_id != null) body.improvement_id = opts.improvement_id;

  for (const [k, v] of Object.entries(opts)) {
    if (!skip.has(k) && v !== undefined) body[k] = v;
  }

  try {
    const res = await fetch(N8N_FACTORY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: { error: e instanceof Error ? e.message : String(e) },
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
