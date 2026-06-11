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
  resolveOpenClawStreamRoute,
  shouldFallbackToOpenRouter,
  type OpenClawStreamRoute,
} from "@/lib/model-router";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import { runAnthropicChatTurn } from "@/lib/chat-anthropic";
import { chatAgentName, modelBadgeForId } from "@/lib/chat-activity-messages";
import { streamChunks } from "@/lib/chat-n8n";
import { stripChatOutput } from "@/lib/strip-response";

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

function isFumeroFlashFastPath(route: OpenClawStreamRoute): boolean {
  return (
    route.provider === "openrouter" &&
    route.fastPath === "fumero_openrouter_direct"
  );
}

function openRouterMetaForRoute(
  route: Extract<OpenClawStreamRoute, { provider: "openrouter" }>,
  metaRecord: Record<string, unknown>
): Record<string, unknown> {
  const tier =
    route.fastPath === "fumero_openrouter_pro"
      ? "pro"
      : route.fastPath === "fumero_openrouter_balanced"
        ? "normaal"
        : route.fastPath === "fumero_openrouter_direct"
          ? "flash"
          : route.research
            ? "research"
            : undefined;
  return {
    ...metaRecord,
    ...(route.fastPath ? { fast_path: route.fastPath } : {}),
    ...(route.model ? { model_id: route.model } : {}),
    ...(tier ? { model_tier: tier } : {}),
    research: route.research,
  };
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
  const trimmed = stripChatOutput(message.trim());
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

async function streamViaOpenClawGateway(opts: {
  messages: Awaited<ReturnType<typeof buildOpenClawMessages>>["messages"];
  metaRecord: Record<string, unknown>;
  klant: string;
  conversationId: number | null;
  signal?: AbortSignal;
  onStreamStart?: (routing: "openclaw" | "openrouter") => void;
  onDelta: (text: string) => void;
}): Promise<OpenClawChatStreamResult> {
  if (!isOpenClawGatewayConfigured()) {
    if (shouldFallbackToOpenRouter()) {
      try {
        return await streamViaOpenRouter({
          messages: opts.messages,
          meta: opts.metaRecord,
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
    if (shouldFallbackToOpenRouter()) {
      try {
        return await streamViaOpenRouter({
          messages: opts.messages,
          meta: opts.metaRecord,
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
      messages: opts.messages,
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

    const trimmed = stripChatOutput(message.trim());
    const failed =
      !trimmed ||
      /LLM (error|request failed)/i.test(trimmed) ||
      /provider rejected/i.test(trimmed) ||
      /model requires more system memory/i.test(trimmed) ||
      /context window too small/i.test(trimmed);

    if (failed) {
      if (shouldFallbackToOpenRouter()) {
        return await streamViaOpenRouter({
          messages: opts.messages,
          meta: opts.metaRecord,
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
      meta: opts.metaRecord,
    };
  } catch (e) {
    if (shouldFallbackToOpenRouter()) {
      try {
        const msg = e instanceof Error ? e.message : String(e);
        return await streamViaOpenRouter({
          messages: opts.messages,
          meta: opts.metaRecord,
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
  onActivity?: (label: string) => void;
  onStreamStart?: (routing: "openclaw" | "openrouter" | "anthropic") => void;
  signal?: AbortSignal;
}): Promise<OpenClawChatStreamResult> {
  const useResearch = Boolean(opts.useResearchModel);
  const route = resolveOpenClawStreamRoute({
    klant: opts.klant,
    agentMode: opts.agentMode,
    hasActiveProject: opts.hasActiveProject,
    useResearchModel: useResearch,
    fumeroModelTier: opts.fumeroModelTier,
  });
  const fumeroFast = isFumeroFlashFastPath(route);

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
  opts.onActivity?.(`${chatAgentName(opts.klant)} · context geladen`);

  if (route.provider === "anthropic") {
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

  if (route.provider === "openrouter") {
    try {
      if (fumeroFast && route.model) {
        const badge = modelBadgeForId(route.model);
        opts.onActivity?.(
          badge ? `Smokey · ${badge} — verbonden` : "Smokey · model starten…"
        );
      }
      return await streamViaOpenRouter({
        messages,
        meta: openRouterMetaForRoute(route, metaRecord),
        research: route.research,
        model: route.model,
        signal: mergeAbortSignals(opts.signal),
        onStreamStart: (routing) => {
          if (fumeroFast && route.model) {
            const badge = modelBadgeForId(route.model);
            opts.onActivity?.(
              badge ? `Smokey antwoordt · ${badge}…` : "Smokey antwoordt…"
            );
          }
          opts.onStreamStart?.(routing);
        },
        onDelta: opts.onDelta,
        reason: route.reason,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const prefix = route.fastPath ?? (route.research ? "openrouter_research" : "openrouter");
      return {
        handled: false,
        reason: `${prefix}_failed: ${msg.slice(0, 120)}`,
      };
    }
  }

  if (route.provider === "openclaw") {
    return streamViaOpenClawGateway({
      messages,
      metaRecord,
      klant: opts.klant,
      conversationId: opts.conversationId,
      signal: opts.signal,
      onStreamStart: opts.onStreamStart,
      onDelta: opts.onDelta,
    });
  }

  if (route.provider === "none") {
    return { handled: false, reason: route.reason };
  }

  if (!isOpenRouterDirectConfigured()) {
    return { handled: false, reason: "openrouter_not_configured" };
  }
  return { handled: false, reason: "openrouter_skipped" };
}
