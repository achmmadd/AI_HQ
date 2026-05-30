/**
 * Thin REST client for https://api.browserbase.com — keys only on server.
 */

const BROWSERBASE_API = "https://api.browserbase.com";

async function browserbaseFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = getBrowserbaseApiKey();
  if (!key) throw new Error("BROWSERBASE_API_KEY ontbreekt");
  const headers = new Headers(init?.headers || {});
  headers.set("x-bb-api-key", key);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${BROWSERBASE_API}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
}

export function getBrowserbaseApiKey(): string | null {
  return process.env.BROWSERBASE_API_KEY?.trim() || null;
}

export function getBrowserbaseProjectId(): string | null {
  return process.env.BROWSERBASE_PROJECT_ID?.trim() || null;
}

export function isBrowserbaseConfigured(): boolean {
  return Boolean(getBrowserbaseApiKey());
}

export async function browserbaseCreateSession(
  body: Record<string, unknown>
): Promise<{ id?: string; [k: string]: unknown }> {
  const res = await browserbaseFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(`Browserbase HTTP ${res.status}: ${text || "unknown error"}`);
  }
  return data;
}

export async function browserbaseSessionDebug(
  sessionId: string
): Promise<{ debuggerFullscreenUrl?: string | null; [k: string]: unknown }> {
  const res = await browserbaseFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/debug`);
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(`Browserbase debug ${res.status}: ${text || "unknown error"}`);
  }
  return data as { debuggerFullscreenUrl?: string | null; [k: string]: unknown };
}

export async function browserbaseSessionDebugWithRetry(
  sessionId: string,
  retries = 5
): Promise<{ debuggerFullscreenUrl?: string | null; [k: string]: unknown }> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await browserbaseSessionDebug(sessionId);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function browserbasePing(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await browserbaseFetch("/v1/sessions?limit=1", { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, detail: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
