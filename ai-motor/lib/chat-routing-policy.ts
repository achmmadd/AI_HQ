import { isOpenClawGatewayConfigured } from "@/lib/openclaw-gateway";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import { shouldUseAnthropicChat } from "@/lib/anthropic-messages";

import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import { parseFumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";

function isFumeroKlant(klant: string): boolean {
  return klant.trim().toLowerCase() === "fumero";
}

/**
 * OpenClaw gateway (tools + geheugen) — standaard voor normale chat (smooth Claw).
 */
export function shouldRouteChatViaOpenClaw(opts: {
  agentMode: boolean;
  hasActiveProject?: boolean;
  useResearchModel?: boolean;
}): boolean {
  if (opts.useResearchModel) return false;
  if (opts.agentMode || opts.hasActiveProject) return true;

  const mode = (process.env.MOTORS_CHAT_USE_OPENCLAW?.trim() || "auto").toLowerCase();
  if (mode === "0" || mode === "false" || mode === "off") return false;
  if (mode === "1" || mode === "true" || mode === "on") {
    return isOpenClawGatewayConfigured();
  }
  return isOpenClawGatewayConfigured();
}

/** Snelle OpenRouter zonder gateway — alleen met MOTORS_CHAT_FAST_PATH=1 */
export function shouldUseOpenRouterFastPath(opts: {
  agentMode: boolean;
  hasActiveProject?: boolean;
  useResearchModel?: boolean;
}): boolean {
  if (opts.useResearchModel) return isOpenRouterDirectConfigured();
  const mode = process.env.MOTORS_CHAT_FAST_PATH?.trim();
  if (mode === "1" || mode === "true") {
    if (shouldRouteChatViaOpenClaw(opts)) return false;
    return isOpenRouterDirectConfigured();
  }
  return false;
}

export function shouldUseResearchModelPath(useResearch: boolean): boolean {
  return useResearch && isOpenRouterDirectConfigured();
}

/** OpenRouter fallback als OpenClaw faalt (vóór n8n). */
export function shouldOpenRouterFallbackOnClawFailure(): boolean {
  return (
    process.env.MOTORS_CHAT_OPENROUTER_FALLBACK?.trim() !== "0" &&
    isOpenRouterDirectConfigured()
  );
}

/** Lokale bestanden/commando's in normale chat. */
export function isLocalChatEnabled(): boolean {
  return process.env.MOTORS_LOCAL_CHAT?.trim() !== "0";
}

/** Qdrant + kennisbank in preamble (Claude-achtiger geheugen). */
export function useRichChatContext(): boolean {
  return process.env.MOTORS_CHAT_RICH_CONTEXT?.trim() !== "0";
}

/** Per-klant rich context; Fumero kan lichter via FUMERO_CHAT_RICH_CONTEXT. */
export function useRichChatContextForKlant(klant: string): boolean {
  if (isFumeroKlant(klant)) {
    const mode = process.env.FUMERO_CHAT_RICH_CONTEXT?.trim();
    if (mode === "0" || mode === "false" || mode === "off") return false;
    if (mode === "1" || mode === "true" || mode === "on") return true;
  }
  return useRichChatContext();
}

type ChatRouteOpts = {
  agentMode: boolean;
  hasActiveProject?: boolean;
  useResearchModel?: boolean;
};

/**
 * Fumero Max Q&A: OpenRouter direct (snel), zonder OpenClaw-gateway.
 * Builds/tools blijven client-side op MOTOR_BUILDER_MODEL (Sonnet).
 */
export function shouldUseFumeroOpenRouterFastPath(
  klant: string,
  opts: ChatRouteOpts,
  modelTier?: FumeroComposerModelTier
): boolean {
  if (!isFumeroKlant(klant)) return false;
  if (opts.agentMode || opts.hasActiveProject || opts.useResearchModel) {
    return false;
  }
  if (modelTier && modelTier !== "flash") return false;
  const mode = process.env.FUMERO_CHAT_FAST_PATH?.trim();
  if (mode === "0" || mode === "false" || mode === "off") return false;
  if (
    mode === "1" ||
    mode === "true" ||
    mode === "on" ||
    Boolean(process.env.FUMERO_CHAT_MODEL?.trim())
  ) {
    return isOpenRouterDirectConfigured();
  }
  return false;
}

export function parseChatModelTier(raw: unknown): FumeroComposerModelTier | undefined {
  return parseFumeroComposerModelTier(raw);
}

export function shouldUseAnthropicDirectPath(): boolean {
  return shouldUseAnthropicChat();
}
