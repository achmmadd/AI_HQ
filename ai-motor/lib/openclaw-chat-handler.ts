import {
  fetchOpenClawGatewayHealth,
  isOpenClawGatewayConfigured,
  streamOpenClawChat,
} from "@/lib/openclaw-gateway";
import {
  isOpenRouterDirectConfigured,
  streamOpenRouterChat,
} from "@/lib/openrouter-gateway";
import {
  buildOpenClawMessages,
  openClawUserKey,
} from "@/lib/openclaw-router";
import type { ChatContextMsg } from "@/lib/chat-n8n";
import {
  shouldOpenRouterFallbackOnClawFailure,
  shouldRouteChatViaOpenClaw,
  shouldUseAnthropicDirectPath,
  shouldUseFumeroOpenRouterFastPath,
  shouldUseOpenRouterFastPath,
  shouldUseResearchModelPath,
} from "@/lib/chat-routing-policy";
import {
  getFumeroChatModelId,
  getFumeroProChatModelId,
  getOpenRouterChatModelId,
  resolveOpenRouterModelForTurn,
} from "@/lib/chat-models";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import { runAnthropicChatTurn } from "@/lib/chat-anthropic";
import { streamChunks } from "@/lib/chat-n8n";

export type OpenClawChatStreamResult =
  | {
      handled: true;
      message: string;
      routing: "openclaw" | "openrouter";
      meta: Record<string, unknown>;
    }
  | { handled: false; reason: string };

function mergeAbortSignals(
  parent?: AbortSignal,
  timeoutMs?: number
): AbortSignal | undefined {
  if (!parent && !timeoutMs) return undefined;
  if (parent && !timeoutMs) return parent;
  const ac = new AbortController();
  const timeout = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
  const onAbort = () => ac.abort();
  parent?.addEventListener("abort", onAbort, { once: true });
  timeout?.addEventListener("abort", onAbort, { once: true });
  if (parent?.aborted || timeout?.aborted) ac.abort();
  return ac.signal;
}

async function streamViaOpenRouter(opts: {
  messages: Awaited<ReturnType<typeof buildOpenClawMessages>>["messages"];
  meta: Record<string, unknown>;
  research: boolean;
  model?: string;
  signal?: AbortSignal;
  onStreamStart?: (routing: "openrouter") => void;
  onDelta: (text: string) => void;
  reason?: string;
}): Promise<OpenClawChatStreamResult> {
  let started = false;
  const { message, model, usage } = await streamOpenRouterChat({
    messages: opts.messages,
    research: opts.research,
    model: opts.model,
    signal: opts.signal,
    onDelta: (text) => {
      if (!started) {
        started = true;
        opts.onStreamStart?.("openrouter");
      }
      opts.onDelta(text);
    },
  });
  const trimmed = message.trim();
  if (!trimmed) {
    return { handled: false, reason: "openrouter_empty_response" };
  }
  return {
    handled: true,
    message: trimmed,
    routing: "openrouter",
    meta: {
      ...opts.meta,
      openrouter_model: model,
      ...(usage ? { usage } : {}),
      ...(opts.reason ? { fallback_reason: opts.reason } : {}),
      research: opts.research,
    },
  };
}

export async function tryOpenClawChatStream(opts: {
  prompt: string;
  klant: string;
  conversationId: number | null;
  context: ChatContextMsg[];
  agentMode: boolean;
  planMode?: boolean;
  hasActiveProject?: boolean;
  activeProjectId?: number;
  useResearchModel?: boolean;
  fumeroModelTier?: FumeroComposerModelTier;
  onDelta: (text: string) => void;
  onPrepare?: () => void;
  onStreamStart?: (routing: "openclaw" | "openrouter" | "anthropic") => void;
  signal?: AbortSignal;
}): Promise<OpenClawChatStreamResult> {
  const useResearch = Boolean(opts.useResearchModel);
  const routeOpts = {
    agentMode: opts.agentMode,
    hasActiveProject: opts.hasActiveProject,
    useResearchModel: useResearch,
  };
  const fumeroFast = shouldUseFumeroOpenRouterFastPath(
    opts.klant,
    routeOpts,
    opts.fumeroModelTier
  );
  opts.onPrepare?.();
  const built = await buildOpenClawMessages({
    prompt: opts.prompt,
    klant: opts.klant,
    conversationId: opts.conversationId,
    context: opts.context,
    agentMode: opts.agentMode,
    planMode: opts.planMode,
    hasActiveProject: opts.hasActiveProject,
    activeProjectId: opts.activeProjectId,
    fastPreamble: fumeroFast,
  });
  const { messages, meta } = built;
  const metaRecord = meta as unknown as Record<string, unknown>;

  if (shouldUseAnthropicDirectPath()) {
    try {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      opts.onStreamStart?.("anthropic");
      const { text, model } = await runAnthropicChatTurn({
        system,
        context: opts.context,
        userPrompt: opts.prompt,
      });
      const trimmed = text.trim();
      if (trimmed) {
        for (const chunk of streamChunks(trimmed, 18)) {
          opts.onDelta(chunk);
        }
        return {
          handled: true,
          message: trimmed,
          routing: "openrouter",
          meta: { ...metaRecord, provider: "anthropic", model },
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `anthropic_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (fumeroFast) {
    try {
      return await streamViaOpenRouter({
        messages,
        meta: {
          ...metaRecord,
          fast_path: "fumero_openrouter_direct",
          model_id: getFumeroChatModelId(),
          model_tier: "flash",
        },
        research: false,
        model: getFumeroChatModelId(),
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: opts.onStreamStart,
        onDelta: opts.onDelta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `fumero_fast_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (
    opts.klant.trim().toLowerCase() === "fumero" &&
    opts.fumeroModelTier === "normaal" &&
    isOpenRouterDirectConfigured()
  ) {
    const modelId = getOpenRouterChatModelId();
    try {
      return await streamViaOpenRouter({
        messages,
        meta: {
          ...metaRecord,
          fast_path: "fumero_openrouter_balanced",
          model_id: modelId,
          model_tier: "normaal",
        },
        research: false,
        model: modelId,
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: opts.onStreamStart,
        onDelta: opts.onDelta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `fumero_normaal_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (
    opts.klant.trim().toLowerCase() === "fumero" &&
    opts.fumeroModelTier === "pro" &&
    isOpenRouterDirectConfigured()
  ) {
    const modelId = getFumeroProChatModelId();
    try {
      return await streamViaOpenRouter({
        messages,
        meta: {
          ...metaRecord,
          fast_path: "fumero_openrouter_pro",
          model_id: modelId,
          model_tier: "pro",
        },
        research: false,
        model: modelId,
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: opts.onStreamStart,
        onDelta: opts.onDelta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `fumero_pro_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (shouldUseResearchModelPath(useResearch)) {
    try {
      return await streamViaOpenRouter({
        messages,
        meta: {
          ...metaRecord,
          model_tier: "research",
          model_id: resolveOpenRouterModelForTurn({ research: true }),
        },
        research: true,
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: opts.onStreamStart,
        onDelta: opts.onDelta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `openrouter_research_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (shouldUseOpenRouterFastPath(routeOpts)) {
    try {
      return await streamViaOpenRouter({
        messages,
        meta: { ...metaRecord, fast_path: "openrouter_direct" },
        research: false,
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: opts.onStreamStart,
        onDelta: opts.onDelta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { handled: false, reason: `openrouter_failed: ${msg.slice(0, 120)}` };
    }
  }

  if (!shouldRouteChatViaOpenClaw(routeOpts)) {
    if (!isOpenRouterDirectConfigured()) {
      return { handled: false, reason: "openrouter_not_configured" };
    }
    return { handled: false, reason: "openrouter_skipped" };
  }

  if (!isOpenClawGatewayConfigured()) {
    if (shouldOpenRouterFallbackOnClawFailure()) {
      try {
        return await streamViaOpenRouter({
          messages,
          meta: metaRecord,
          research: false,
          signal: mergeAbortSignals(opts.signal),
          onStreamStart: opts.onStreamStart,
          onDelta: opts.onDelta,
          reason: "openclaw_not_configured",
        });
      } catch {
        /* fall through */
      }
    }
    return { handled: false, reason: "not_configured" };
  }

  const health = await fetchOpenClawGatewayHealth();
  if (!health.reachable) {
    if (shouldOpenRouterFallbackOnClawFailure()) {
      try {
        return await streamViaOpenRouter({
          messages,
          meta: metaRecord,
          research: false,
          signal: mergeAbortSignals(opts.signal),
          onStreamStart: opts.onStreamStart,
          onDelta: opts.onDelta,
          reason: health.error || "gateway_unreachable",
        });
      } catch {
        /* fall through */
      }
    }
    return {
      handled: false,
      reason: health.error || "gateway_unreachable",
    };
  }
  if (health.chatCompletionsEnabled === false) {
    return {
      handled: false,
      reason: "chat_completions_disabled",
    };
  }

  const userKey = openClawUserKey(opts.klant, opts.conversationId);
  let started = false;
  try {
    const { message } = await streamOpenClawChat({
      messages,
      userKey,
      signal: opts.signal,
      onDelta: (text) => {
        if (!started) {
          started = true;
          opts.onStreamStart?.("openclaw");
        }
        opts.onDelta(text);
      },
    });

    const trimmed = message.trim();
    const failed =
      !trimmed ||
      /LLM (error|request failed)/i.test(trimmed) ||
      /provider rejected/i.test(trimmed) ||
      /model requires more system memory/i.test(trimmed) ||
      /context window too small/i.test(trimmed);

    if (failed) {
      if (shouldOpenRouterFallbackOnClawFailure()) {
        return await streamViaOpenRouter({
          messages,
          meta: metaRecord,
          research: false,
          signal: mergeAbortSignals(opts.signal),
          onStreamStart: opts.onStreamStart,
          onDelta: opts.onDelta,
          reason: trimmed ? "openclaw_llm_error" : "openclaw_empty_response",
        });
      }
      return {
        handled: false,
        reason: trimmed ? "openclaw_llm_error" : "openclaw_empty_response",
      };
    }

    return {
      handled: true,
      message: trimmed,
      routing: "openclaw",
      meta: metaRecord,
    };
  } catch (e) {
    if (shouldOpenRouterFallbackOnClawFailure()) {
      try {
        const msg = e instanceof Error ? e.message : String(e);
        return await streamViaOpenRouter({
          messages,
          meta: metaRecord,
          research: false,
          signal: mergeAbortSignals(opts.signal),
          onStreamStart: opts.onStreamStart,
          onDelta: opts.onDelta,
          reason: `openclaw_stream_error: ${msg.slice(0, 80)}`,
        });
      } catch {
        /* fall through */
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { handled: false, reason: msg.slice(0, 120) };
  }
}
