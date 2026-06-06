/**
 * Langfuse Cloud tracing (Sprint 2.1).
 * Graceful no-op when LANGFUSE_* keys are unset — no self-host on 16 GB Hetzner.
 */

import { Langfuse, type LangfuseTraceClient } from "langfuse";

export type LangfuseChatTraceContext = {
  conversationId: number | null;
  klant: string;
  workspaceId?: string | null;
  workspaceSlug?: string | null;
  userId?: string | null;
  agentMode?: boolean;
  intent?: string;
};

export type LangfuseGenerationEnd = {
  output: string;
  model: string;
  routing: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
};

let client: Langfuse | null = null;

export function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY?.trim() &&
      process.env.LANGFUSE_PUBLIC_KEY?.trim()
  );
}

function getLangfuseClient(): Langfuse | null {
  if (!isLangfuseConfigured()) return null;
  if (!client) {
    client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!.trim(),
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!.trim(),
      baseUrl:
        process.env.LANGFUSE_BASE_URL?.trim() ||
        "https://cloud.langfuse.com",
      release: process.env.LANGFUSE_RELEASE?.trim() || undefined,
      environment:
        process.env.LANGFUSE_ENVIRONMENT?.trim() ||
        process.env.NODE_ENV ||
        "development",
    });
  }
  return client;
}

export type ChatLangfuseTrace = {
  trace: LangfuseTraceClient;
  generation: ReturnType<LangfuseTraceClient["generation"]>;
};

/** Start a chat-turn trace; returns null when Langfuse is not configured. */
export function startChatLangfuseTrace(
  ctx: LangfuseChatTraceContext,
  input: string
): ChatLangfuseTrace | null {
  const lf = getLangfuseClient();
  if (!lf) return null;

  const sessionId =
    ctx.conversationId != null
      ? `conv-${ctx.conversationId}`
      : `klant-${ctx.klant}`;

  const trace = lf.trace({
    name: "motor-chat-stream",
    sessionId,
    userId: ctx.userId ?? ctx.klant,
    input: input.slice(0, 8000),
    metadata: {
      klant: ctx.klant,
      workspace_id: ctx.workspaceId ?? null,
      workspace_slug: ctx.workspaceSlug ?? null,
      conversation_id: ctx.conversationId,
      agent_mode: Boolean(ctx.agentMode),
      intent: ctx.intent ?? null,
    },
    tags: [
      `klant:${ctx.klant}`,
      ctx.workspaceSlug ? `workspace:${ctx.workspaceSlug}` : "workspace:unknown",
    ],
  });

  const generation = trace.generation({
    name: "llm-completion",
    input: input.slice(0, 4000),
    metadata: {
      klant: ctx.klant,
      workspace_id: ctx.workspaceId ?? null,
    },
  });

  return { trace, generation };
}

/** Record planned routing chain before LLM execution (Sprint 3.2). */
export function updateChatLangfuseRoutingPlan(
  handle: ChatLangfuseTrace | null,
  routing: {
    routeChain: string[];
    primary: string;
    litellm: boolean;
    plannedModel?: string | null;
    fastPath?: string | null;
  }
): void {
  if (!handle) return;
  const meta = {
    routing_plan: routing.routeChain,
    routing_primary: routing.primary,
    litellm_proxy: routing.litellm,
    planned_model: routing.plannedModel ?? null,
    fast_path: routing.fastPath ?? null,
  };
  handle.trace.update({ metadata: meta });
  handle.generation.update({ metadata: meta });
}

export function endChatLangfuseTrace(
  handle: ChatLangfuseTrace | null,
  end: LangfuseGenerationEnd
): void {
  if (!handle) return;

  handle.generation.end({
    output: end.output.slice(0, 8000),
    model: end.model,
    metadata: {
      routing: end.routing,
      success: end.success !== false,
      ...end.metadata,
    },
    usage: {
      input: end.promptTokens,
      output: end.completionTokens,
      total: end.promptTokens + end.completionTokens,
    },
  });

  handle.trace.update({
    output: end.output.slice(0, 2000),
    metadata: {
      routing: end.routing,
      duration_ms: end.durationMs,
      model: end.model,
    },
  });
}

/** Flush pending events (best-effort; never throws). */
export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuseClient();
  if (!lf) return;
  try {
    await lf.flushAsync();
  } catch (err) {
    console.warn(
      "[langfuse] flush failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}
