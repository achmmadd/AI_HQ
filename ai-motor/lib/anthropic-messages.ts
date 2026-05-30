const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const ANTHROPIC_CHAT_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

export function getAnthropicApiKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k || null;
}

export function getAnthropicChatModel(): string {
  return (
    process.env.ANTHROPIC_CHAT_MODEL?.trim() || ANTHROPIC_CHAT_MODEL_DEFAULT
  );
}

/** Direct Haiku-chat i.p.v. n8n Factory-webhook. Zet CHAT_PROVIDER=anthropic. */
export function shouldUseAnthropicChat(): boolean {
  if (!getAnthropicApiKey()) return false;
  return process.env.CHAT_PROVIDER === "anthropic";
}

type AnthropicMsg = { role: "user" | "assistant"; content: string };

export async function anthropicComplete(opts: {
  system: string;
  messages: AnthropicMsg[];
  maxTokens?: number;
  model?: string;
}): Promise<{
  text: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
}> {
  const key = getAnthropicApiKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt");

  const model = opts.model ?? getAnthropicChatModel();
  /** Sonnet builder (SCHEMA+FRONTEND) requests up to 14k; cap matches Anthropic output limits. */
  const max_tokens = Math.min(Math.max(opts.maxTokens ?? 4096, 256), 16_384);

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens,
      system: opts.system.slice(0, 200_000),
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${rawText.slice(0, 400)}`);
  }

  const data = JSON.parse(rawText) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const parts = Array.isArray(data.content) ? data.content : [];
  const text = parts
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");

  const input_tokens = data.usage?.input_tokens;
  const output_tokens = data.usage?.output_tokens;

  return {
    text,
    model,
    ...(typeof input_tokens === "number" ? { input_tokens } : {}),
    ...(typeof output_tokens === "number" ? { output_tokens } : {}),
  };
}
