export type BookkeepingHealth = {
  ok: boolean;
  status: "online" | "offline" | "degraded";
  pending_approvals: number;
  retry_queue: number;
  disk_free_mb?: number;
  error?: string;
};

export function bookkeepingBotBaseUrl(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

export function offlineBookkeepingHealth(error: string): BookkeepingHealth {
  return {
    ok: false,
    status: "offline",
    pending_approvals: 0,
    retry_queue: 0,
    error,
  };
}

/** Probe bookkeeping-bot GET /health — never throws. */
export async function fetchBookkeepingHealth(
  timeoutMs = 8_000
): Promise<BookkeepingHealth> {
  try {
    const res = await fetch(`${bookkeepingBotBaseUrl()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      if (!res.ok) {
        return offlineBookkeepingHealth(
          text.slice(0, 200) || `HTTP ${res.status}`
        );
      }
    }

    if (!res.ok) {
      const err =
        typeof data.error === "string"
          ? data.error
          : text.slice(0, 200) || `HTTP ${res.status}`;
      return offlineBookkeepingHealth(err);
    }

    return {
      ok: true,
      status: "online",
      pending_approvals:
        typeof data.pending_approvals === "number" ? data.pending_approvals : 0,
      retry_queue:
        typeof data.retry_queue === "number" ? data.retry_queue : 0,
      disk_free_mb:
        typeof data.disk_free_mb === "number" ? data.disk_free_mb : undefined,
    };
  } catch (e) {
    return offlineBookkeepingHealth(
      e instanceof Error ? e.message : "bookkeeping unreachable"
    );
  }
}

/** Proxy fetch naar bookkeeping-bot — graceful JSON fallback bij offline. */
export async function proxyBookkeepingJson(
  path: string,
  init?: RequestInit,
  fallback: Record<string, unknown> = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${bookkeepingBotBaseUrl()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      ...init,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? (JSON.parse(text) as unknown) : fallback;
    } catch {
      data = res.ok ? { raw: text } : { ...fallback, error: text.slice(0, 300) };
    }
    if (!res.ok && typeof data === "object" && data !== null) {
      data = {
        ...(data as Record<string, unknown>),
        ok: false,
        status: "offline",
        error:
          (data as Record<string, unknown>).error ??
          text.slice(0, 200) ??
          res.statusText,
      };
    }
    return { ok: res.ok, status: res.ok ? res.status : 502, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bookkeeping unreachable";
    return {
      ok: false,
      status: 502,
      data: { ...fallback, ok: false, status: "offline", error: msg },
    };
  }
}
