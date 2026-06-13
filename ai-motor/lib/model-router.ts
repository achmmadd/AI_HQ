/**
 * Central model routing — OpenClaw primary, OpenRouter fallback, n8n last.
 * Sprint 2.1: single surface for chat stream, OpenClaw handler, and future LiteLLM proxy.
 */

import { isOpenClawGatewayConfigured } from "@/lib/openclaw-gateway";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import {
  getFumeroChatModelId,
  getFumeroProChatModelId,
  getOpenRouterChatModelId,
  resolveOpenRouterModelForTurn,
} from "@/lib/chat-models";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import {
  shouldOpenRouterFallbackOnClawFailure,
  shouldRouteChatViaOpenClaw,
  shouldUseAnthropicDirectPath,
  shouldUseFumeroOpenRouterFastPath,
  shouldUseOpenRouterFastPath,
  shouldUseResearchModelPath,
} from "@/lib/chat-routing-policy";

export type ChatRouteProvider =
  | "local_executor"
  | "anthropic"
  | "openrouter"
  | "openclaw"
  | "n8n";

/** Canonical fallback order after local executor (Sprint 2.1). */
export const CHAT_ROUTE_PRIORITY: readonly ChatRouteProvider[] = [
  "openclaw",
  "openrouter",
  "n8n",
] as const;

export type ChatRouteContext = {
  klant: string;
  agentMode: boolean;
  hasActiveProject?: boolean;
  useResearchModel: boolean;
  fumeroModelTier?: FumeroComposerModelTier;
};

export type OpenClawStreamRoute =
  | { provider: "anthropic" }
  | {
      provider: "openrouter";
      model?: string;
      research: boolean;
      fastPath?: string;
      reason?: string;
    }
  | { provider: "openclaw" }
  | { provider: "none"; reason: string };

/** LiteLLM proxy base URL (Hetzner sidecar). Empty → direct OpenRouter. */
export function getLiteLLMBaseUrl(): string | null {
  const url =
    process.env.LITELLM_BASE_URL?.trim() ||
    process.env.LITELLM_PROXY_URL?.trim();
  return url || null;
}

/** OpenRouter API endpoint — LiteLLM when configured, else OpenRouter direct. */
export function resolveChatCompletionsUrl(): string {
  const litellm = getLiteLLMBaseUrl();
  if (litellm) {
    return `${litellm.replace(/\/$/, "")}/v1/chat/completions`;
  }
  return "https://openrouter.ai/api/v1/chat/completions";
}

export function isLiteLLMConfigured(): boolean {
  return Boolean(getLiteLLMBaseUrl());
}

/**
 * Primary route for tryOpenClawChatStream — mirrors handler precedence without I/O.
 * OpenClaw health checks remain in the handler.
 */
export function resolveOpenClawStreamRoute(
  opts: ChatRouteContext
): OpenClawStreamRoute {
  const routeOpts = {
    agentMode: opts.agentMode,
    hasActiveProject: opts.hasActiveProject,
    useResearchModel: opts.useResearchModel,
  };

  if (shouldUseAnthropicDirectPath()) {
    return { provider: "anthropic" };
  }

  if (
    shouldUseFumeroOpenRouterFastPath(
      opts.klant,
      routeOpts,
      opts.fumeroModelTier
    )
  ) {
    return {
      provider: "openrouter",
      model: getFumeroChatModelId(),
      research: false,
      fastPath: "fumero_openrouter_direct",
    };
  }

  const klant = opts.klant.trim().toLowerCase();
  if (
    klant === "fumero" &&
    opts.fumeroModelTier === "normaal" &&
    isOpenRouterDirectConfigured()
  ) {
    return {
      provider: "openrouter",
      model: getOpenRouterChatModelId(),
      research: false,
      fastPath: "fumero_openrouter_balanced",
    };
  }

  if (
    klant === "fumero" &&
    opts.fumeroModelTier === "pro" &&
    isOpenRouterDirectConfigured()
  ) {
    return {
      provider: "openrouter",
      model: getFumeroProChatModelId(),
      research: false,
      fastPath: "fumero_openrouter_pro",
    };
  }

  if (shouldUseResearchModelPath(opts.useResearchModel)) {
    return {
      provider: "openrouter",
      model: resolveOpenRouterModelForTurn({ research: true }),
      research: true,
      fastPath: "research",
    };
  }

  if (shouldUseOpenRouterFastPath(routeOpts)) {
    return {
      provider: "openrouter",
      research: false,
      fastPath: "openrouter_direct",
    };
  }

  if (shouldRouteChatViaOpenClaw(routeOpts)) {
    if (!isOpenClawGatewayConfigured()) {
      if (shouldOpenRouterFallbackOnClawFailure()) {
        return {
          provider: "openrouter",
          research: false,
          reason: "openclaw_not_configured",
        };
      }
      return { provider: "none", reason: "not_configured" };
    }
    return { provider: "openclaw" };
  }

  if (!isOpenRouterDirectConfigured()) {
    return { provider: "none", reason: "openrouter_not_configured" };
  }
  return { provider: "none", reason: "openrouter_skipped" };
}

/** Whether OpenRouter should be attempted when OpenClaw fails at runtime. */
export function shouldFallbackToOpenRouter(): boolean {
  return shouldOpenRouterFallbackOnClawFailure();
}

/** n8n is the terminal fallback when OpenClaw + OpenRouter both fail. */
export function isN8nTerminalFallback(): boolean {
  return true;
}

/** LLM provider chain after local-executor skip (OpenClaw → OpenRouter → n8n). */
export function resolveLlmRouteChain(ctx: ChatRouteContext): ChatRouteProvider[] {
  const route = resolveOpenClawStreamRoute(ctx);
  const chain: ChatRouteProvider[] = [];

  if (route.provider === "anthropic") {
    chain.push("anthropic");
  } else if (route.provider === "openrouter") {
    chain.push("openrouter");
  } else if (route.provider === "openclaw") {
    chain.push("openclaw");
    if (shouldFallbackToOpenRouter()) chain.push("openrouter");
  }

  if (isN8nTerminalFallback()) chain.push("n8n");
  return chain;
}

export type ChatRoutingDecision = {
  /** Full chain incl. optional local executor first hop. */
  routeChain: ChatRouteProvider[];
  primaryProvider: ChatRouteProvider | "none";
  primaryReason?: string;
  litellm: boolean;
  plannedModel?: string;
  fastPath?: string;
};

/** SSOT routing decision for chat stream logging (Langfuse + usage). */
export function resolveChatRoutingDecision(
  ctx: ChatRouteContext,
  opts?: { includeLocalExecutor?: boolean }
): ChatRoutingDecision {
  const route = resolveOpenClawStreamRoute(ctx);
  const chain: ChatRouteProvider[] = [];

  if (opts?.includeLocalExecutor) chain.push("local_executor");
  chain.push(...resolveLlmRouteChain(ctx));

  let primaryProvider: ChatRouteProvider | "none" = "none";
  let plannedModel: string | undefined;
  let fastPath: string | undefined;

  if (route.provider === "anthropic") {
    primaryProvider = "anthropic";
  } else if (route.provider === "openrouter") {
    primaryProvider = "openrouter";
    plannedModel =
      route.model ?? resolveOpenRouterModelForTurn({ research: route.research });
    fastPath = route.fastPath;
  } else if (route.provider === "openclaw") {
    primaryProvider = "openclaw";
  }

  return {
    routeChain: chain,
    primaryProvider,
    primaryReason: route.provider === "none" ? route.reason : undefined,
    litellm: isLiteLLMConfigured(),
    plannedModel,
    fastPath,
  };
}

/** Human-readable chain for Langfuse / usage metadata. */
export function formatRouteChain(chain: readonly ChatRouteProvider[]): string {
  return chain.map(routeProviderLabel).join(" → ");
}

export function routeProviderLabel(provider: ChatRouteProvider): string {
  switch (provider) {
    case "local_executor":
      return "nuc-local-executor";
    case "anthropic":
      return "anthropic-direct";
    case "openrouter":
      return "openrouter-direct";
    case "openclaw":
      return "openclaw-gateway";
    case "n8n":
      return "factory-os";
    default:
      return provider;
  }
}

// Re-exports — prefer importing from model-router for routing policy + model IDs.
export {
  shouldOpenRouterFallbackOnClawFailure,
  shouldRouteChatViaOpenClaw,
  shouldUseAnthropicDirectPath,
  shouldUseFumeroOpenRouterFastPath,
  shouldUseOpenRouterFastPath,
  shouldUseResearchModelPath,
  isLocalChatEnabled,
  useRichChatContext,
  useRichChatContextForKlant,
  parseChatModelTier,
} from "@/lib/chat-routing-policy";

export {
  getFumeroChatModelId,
  getFumeroProChatModelId,
  getOpenRouterChatModelId,
  getOpenRouterResearchModelId,
  resolveOpenRouterModelForTurn,
  DEFAULT_CHAT_MODEL,
  DEFAULT_RESEARCH_MODEL,
} from "@/lib/chat-models";

export {
  resolveCodeModelForTurn,
  getMotorCodeModel,
  DEFAULT_CODE_MODEL_HEAVY,
  PARETO_CODE_MODEL,
} from "@/lib/code-agent/code-models";
