"use client";

/** Browser/fetch — gebroken verbinding vs user-abort (`AbortError`). */

export function isDisconnectedFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("fetch failed") ||
    msg.includes("ecconnreset") ||
    msg.includes("econnreset") ||
    msg.includes("the network connection was lost")
  );
}

const DISCONNECT_HINT =
  "Vaak idle-timeout achter nginx/Cloudflare bij lange taken — verhoog read-timeout/proxy (`proxy_read_timeout` ca. 300s) en zet MOTOR_SSE_KEEPALIVE_MS=10000 indien nodig.";

/** Fout bij netwerk/SSE-afbreking; zelfde boodschap als chat-stream client. */
export function disconnectFetchError(): Error {
  return new Error(
    `Netwerkfout — de verbinding brak af. ${DISCONNECT_HINT} Probeer opnieuw.`
  );
}

export function unwrapFetchFailure(err: unknown): Error {
  if (err instanceof Error && err.name === "AbortError") return err;
  if (isDisconnectedFetchError(err)) return disconnectFetchError();
  return err instanceof Error ? err : new Error(String(err));
}
