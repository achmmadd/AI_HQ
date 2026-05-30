/**
 * Direct OpenRouter streaming (bypasses OpenClaw agent runtime for latency).
 */

import {
  chatMaxTokens,
  openRouterChatTimeoutMs,
  openRouterResearchTimeoutMs,
  resolveOpenRouterModelForTurn,
} from "@/lib/chat-models";

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function isOpenRouterDirectConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/** @deprecated gebruik getOpenRouterChatModelId uit chat-models */
export function getOpenRouterJuniorModel(): string {
  return resolveOpenRouterModelForTurn({ research: false });
}

export function getOpenRouterChatModel(): string {
  return resolveOpenRouterModelForTurn({ research: false });
}

function openRouterHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://motorsai.app",
    "X-Title": "MotorsAI",
  };
}

type SseChunk = {
  delta: string | null;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
};

function parseSseChunk(line: string): SseChunk {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return { delta: null, usage: null };
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return { delta: null, usage: null };
  try {
    const parsed = JSON.parse(data) as {
      choices?: {
        delta?: { content?: string };
        message?: { content?: string };
      }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    const usageRaw = parsed.usage;
    const usage =
      usageRaw &&
      (Number(usageRaw.prompt_tokens) > 0 ||
        Number(usageRaw.completion_tokens) > 0)
        ? {
            prompt_tokens: Number(usageRaw.prompt_tokens) || 0,
            completion_tokens: Number(usageRaw.completion_tokens) || 0,
          }
        : null;
    const choice = parsed.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content;
    return {
      delta: typeof delta === "string" ? delta : null,
      usage,
    };
  } catch {
    return { delta: null, usage: null };
  }
}

export async function streamOpenRouterChat(opts: {
  messages: OpenRouterChatMessage[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  /** research → Sonar; anders CHAT_MODEL */
  research?: boolean;
  model?: string;
}): Promise<{
  message: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
}> {
  const model =
    opts.model?.trim() ||
    resolveOpenRouterModelForTurn({ research: Boolean(opts.research) });
  const timeoutMs = opts.research
    ? openRouterResearchTimeoutMs()
    : openRouterChatTimeoutMs();

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: true,
    max_tokens: chatMaxTokens(),
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
    signal: opts.signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream") || !res.body) {
    const json = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = json.choices?.[0]?.message?.content ?? "";
    if (message) opts.onDelta(message);
    const u = json.usage;
    const usage =
      u &&
      (Number(u.prompt_tokens) > 0 || Number(u.completion_tokens) > 0)
        ? {
            prompt_tokens: Number(u.prompt_tokens) || 0,
            completion_tokens: Number(u.completion_tokens) || 0,
          }
        : null;
    return { message: message.trim(), model, usage };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let acc = "";
  let usage: { prompt_tokens: number; completion_tokens: number } | null =
    null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const chunk = parseSseChunk(line);
      if (chunk.usage) usage = chunk.usage;
      if (chunk.delta) {
        acc += chunk.delta;
        opts.onDelta(chunk.delta);
      }
    }
  }

  return { message: acc.trim(), model, usage };
}

/** Blocking completion (builder / non-streaming callers). */
export async function completeOpenRouterChat(opts: {
  messages: OpenRouterChatMessage[];
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{
  message: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
}> {
  const model =
    opts.model?.trim() ||
    resolveOpenRouterModelForTurn({ research: false });
  const timeoutMs = openRouterChatTimeoutMs();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: false,
      max_tokens: opts.maxTokens ?? chatMaxTokens(),
    }),
    signal: opts.signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = json.choices?.[0]?.message?.content?.trim() ?? "";
  const u = json.usage;
  const usage =
    u &&
    (Number(u.prompt_tokens) > 0 || Number(u.completion_tokens) > 0)
      ? {
          prompt_tokens: Number(u.prompt_tokens) || 0,
          completion_tokens: Number(u.completion_tokens) || 0,
        }
      : null;
  return { message, model, usage };
}
