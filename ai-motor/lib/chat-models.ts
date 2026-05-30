/**
 * Centrale model-defaults voor MotorsAI chat (mei 2026, OpenRouter).
 */

export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v4-pro";
export const DEFAULT_RESEARCH_MODEL = "perplexity/sonar-pro";
export const DEFAULT_JUNIOR_MODEL = "deepseek/deepseek-v4-flash";

export type ChatModelTier = "chat" | "research" | "online";

export function getOpenRouterChatModelId(): string {
  return (
    process.env.CHAT_MODEL?.trim() ||
    process.env.JUNIOR_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL
  );
}

/** Snelle chat voor Fumero Max Q&A (OpenRouter direct, geen OpenClaw). */
export function getFumeroChatModelId(): string {
  return (
    process.env.FUMERO_CHAT_MODEL?.trim() ||
    process.env.JUNIOR_MODEL?.trim() ||
    DEFAULT_JUNIOR_MODEL
  );
}

/** Pro-tier voor Fumero chat (complexere vragen). */
export function getFumeroProChatModelId(): string {
  return (
    process.env.FUMERO_PRO_CHAT_MODEL?.trim() ||
    process.env.MOTOR_BUILDER_MODEL?.trim() ||
    getOpenRouterChatModelId()
  );
}

export function getOpenRouterResearchModelId(): string {
  return (
    process.env.CHAT_RESEARCH_MODEL?.trim() || DEFAULT_RESEARCH_MODEL
  );
}

/** Optioneel :online suffix op chat-model (OpenRouter web plugin). */
export function getOpenRouterChatModelWithOnline(): string | null {
  if (process.env.CHAT_USE_ONLINE?.trim() !== "1") return null;
  const base = getOpenRouterChatModelId();
  if (base.includes(":online")) return base;
  return `${base}:online`;
}

export function resolveOpenRouterModelForTurn(opts: {
  research: boolean;
}): string {
  if (opts.research) return getOpenRouterResearchModelId();
  return getOpenRouterChatModelWithOnline() ?? getOpenRouterChatModelId();
}

export function chatMaxTokens(): number {
  const raw = process.env.CHAT_MAX_TOKENS?.trim();
  if (!raw) return 4096;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 4096;
  return Math.min(Math.max(n, 512), 16_384);
}

export function openRouterResearchTimeoutMs(): number {
  const raw = process.env.CHAT_RESEARCH_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 90_000;
  return Number.isFinite(n) && n > 10_000 ? n : 90_000;
}

export function openRouterChatTimeoutMs(): number {
  const raw = process.env.OPENROUTER_CHAT_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 60_000;
  return Number.isFinite(n) && n > 5_000 ? n : 60_000;
}
