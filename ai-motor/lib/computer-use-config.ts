/**
 * Server-side Computer Use / Agent paneel — géén secrets naar de client tenzij expres NEXT_PUBLIC_.
 */

/** iframe in Agent-paneel: server-env wint op build-time public (interne tunnels). */
export function getComputerUseViewerUrl(): string | null {
  const server =
    process.env.COMPUTER_USE_VIEWER_URL?.trim() ||
    "";
  if (server) return server;
  const pub =
    process.env.NEXT_PUBLIC_COMPUTER_USE_VIEWER_URL?.trim() || "";
  return pub || null;
}

/** Optionele Authorization / custom headers voor COMPUTER_USE_SCREENSHOT_URL fetch. */
export function getComputerUseScreenshotRequestInit(): Pick<
  RequestInit,
  "method" | "headers" | "body"
> {
  const headers = new Headers();
  headers.set(
    "Accept",
    "image/png,image/jpeg,image/webp,image/gif,image/*;q=0.9,*/*;q=0.8"
  );

  const rawJson =
    process.env.COMPUTER_USE_SCREENSHOT_HEADERS_JSON?.trim();
  if (rawJson) {
    try {
      const o = JSON.parse(rawJson) as unknown;
      if (o !== null && typeof o === "object" && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          if (
            typeof k === "string" &&
            k.trim() &&
            typeof v === "string"
          ) {
            headers.set(k, v);
          }
        }
      }
    } catch {
      /* negeer ongeldige JSON */
    }
  }

  const bearer = process.env.COMPUTER_USE_SCREENSHOT_BEARER_TOKEN?.trim();
  if (bearer) {
    headers.set(
      "Authorization",
      bearer.toLowerCase().startsWith("bearer ")
        ? bearer
        : `Bearer ${bearer}`
    );
  }

  const method =
    process.env.COMPUTER_USE_SCREENSHOT_METHOD?.trim().toUpperCase() ===
    "POST"
      ? "POST"
      : "GET";

  const bodyRaw =
    process.env.COMPUTER_USE_SCREENSHOT_POST_BODY?.trim();
  let body: string | undefined;
  if (method === "POST" && bodyRaw) {
    body = bodyRaw;
    if (
      bodyRaw.startsWith("{") &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
  }

  return { method, headers, body };
}
