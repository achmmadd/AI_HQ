import { DEFAULT_JUNIOR_MODEL } from "@/lib/chat-models";

/** Shown in chat/code UI when OpenRouter returns upstream rate limits. */
export const OPENROUTER_RATE_LIMIT_USER_MESSAGE =
  "Model tijdelijk druk — probeer Flash of Pro, of over een minuut opnieuw";

/** Stable fallback when primary model is 429 (override via OPENROUTER_FALLBACK_MODEL). */
export function getOpenRouterFallbackModel(): string {
  return process.env.OPENROUTER_FALLBACK_MODEL?.trim() || DEFAULT_JUNIOR_MODEL;
}

export function isOpenRouterRateLimited(
  status: number,
  body: string
): boolean {
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("rate-limited") ||
    lower.includes("rate limit") ||
    lower.includes("temporarily rate")
  );
}

/** Map raw OpenRouter errors to user-friendly Dutch copy. */
export function formatOpenRouterUserError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return OPENROUTER_RATE_LIMIT_USER_MESSAGE;
  if (
    /OpenRouter\s+(HTTP\s+)?429/i.test(msg) ||
    isOpenRouterRateLimited(429, msg)
  ) {
    return OPENROUTER_RATE_LIMIT_USER_MESSAGE;
  }
  if (msg.length > 280) return `${msg.slice(0, 277)}…`;
  return msg;
}
