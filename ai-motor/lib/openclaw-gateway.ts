/**
 * OpenClaw Gateway HTTP client (OpenAI-compatible /v1/chat/completions).
 * @see https://openclawlab.com/en/docs/gateway/openai-http-api/
 */

export type OpenClawChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenClawStreamDelta = {
  text: string;
  done: boolean;
  raw?: unknown;
};

export function isOpenClawGatewayConfigured(): boolean {
  return Boolean(
    process.env.OPENCLAW_GATEWAY_URL?.trim() &&
      process.env.OPENCLAW_CHAT_ENABLED?.trim() !== "0"
  );
}

export function getOpenClawGatewayUrl(): string {
  return (
    process.env.OPENCLAW_GATEWAY_URL?.trim() || "http://127.0.0.1:18789"
  ).replace(/\/+$/, "");
}

export function getOpenClawGatewayToken(): string {
  return process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || "";
}

export function getOpenClawAgentId(): string {
  return process.env.OPENCLAW_AGENT_ID?.trim() || "main";
}

type HealthSnapshot = {
  at: number;
  result: Awaited<ReturnType<typeof fetchOpenClawGatewayHealthUncached>>;
};

let healthCache: HealthSnapshot | null = null;
const HEALTH_CACHE_MS = Number(process.env.OPENCLAW_HEALTH_CACHE_MS || 45_000);

async function fetchOpenClawGatewayHealthUncached(): Promise<{
  configured: boolean;
  reachable: boolean;
  chatCompletionsEnabled?: boolean;
  error?: string;
}> {
  if (!isOpenClawGatewayConfigured()) {
    return { configured: false, reachable: false };
  }
  const base = getOpenClawGatewayUrl();
  try {
    const res = await fetch(`${base}/`, {
      method: "GET",
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        reachable: true,
        chatCompletionsEnabled: true,
        error: `auth: HTTP ${res.status}`,
      };
    }
    if (res.ok || res.status === 404) {
      return { configured: true, reachable: true, chatCompletionsEnabled: true };
    }
    const text = await res.text().catch(() => "");
    return {
      configured: true,
      reachable: false,
      error: `HTTP ${res.status}: ${text.slice(0, 120)}`,
    };
  } catch (e) {
    return {
      configured: true,
      reachable: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Cached gateway probe — avoids ~3s GET on every chat turn. */
export async function fetchOpenClawGatewayHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  chatCompletionsEnabled?: boolean;
  error?: string;
}> {
  const now = Date.now();
  if (healthCache && now - healthCache.at < HEALTH_CACHE_MS) {
    return healthCache.result;
  }
  const result = await fetchOpenClawGatewayHealthUncached();
  if (result.reachable) {
    healthCache = { at: now, result };
  } else {
    healthCache = null;
  }
  return result;
}

export function invalidateOpenClawHealthCache(): void {
  healthCache = null;
}

function gatewayHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-openclaw-agent-id": getOpenClawAgentId(),
  };
  const token = getOpenClawGatewayToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function extractDeltaFromSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const parsed = JSON.parse(data) as {
      choices?: { delta?: { content?: string }; message?: { content?: string } }[];
    };
    const choice = parsed.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content;
    return typeof delta === "string" ? delta : null;
  } catch {
    return null;
  }
}

function extractMessageFromJson(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const o = body as {
    choices?: { message?: { content?: string } }[];
    message?: string;
    output?: string;
  };
  const fromChoice = o.choices?.[0]?.message?.content;
  if (typeof fromChoice === "string") return fromChoice;
  if (typeof o.message === "string") return o.message;
  if (typeof o.output === "string") return o.output;
  return "";
}

/** Stream chat via OpenClaw Gateway SSE. */
export async function streamOpenClawChat(opts: {
  messages: OpenClawChatMessage[];
  userKey: string;
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
}): Promise<{ message: string; raw?: unknown }> {
  const base = getOpenClawGatewayUrl();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({
      model: `openclaw:${getOpenClawAgentId()}`,
      stream: true,
      user: opts.userKey,
      messages: opts.messages,
    }),
    signal: opts.signal ?? AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenClaw gateway HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream") || !res.body) {
    const json = (await res.json().catch(() => ({}))) as unknown;
    const message = extractMessageFromJson(json);
    if (message) opts.onDelta(message);
    return { message, raw: json };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let acc = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const delta = extractDeltaFromSseLine(line);
      if (delta) {
        acc += delta;
        opts.onDelta(delta);
      }
    }
  }

  return { message: acc.trim(), raw: undefined };
}
