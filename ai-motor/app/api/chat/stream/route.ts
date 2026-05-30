import { NextRequest } from "next/server";
import db from "@/lib/db/database";
import { scheduleConversationTitleUpdate } from "@/lib/chat-conversation-title";
import { assertConversationForKlant } from "@/lib/chat-conversation-guard";
import {
  buildPromptForN8n,
  detectChatIntent,
  maybeIngestMotorMemory,
  mergeConversationContext,
  parseChatUserPrompt,
  shouldUseBrowserTaskForAgent,
} from "@/lib/chat-request";
import { tryHandleLocalExecutorChat } from "@/lib/chat-local-handler";
import { tryOpenClawChatStream } from "@/lib/openclaw-chat-handler";
import { shouldRunChatWebResearch } from "@/lib/chat-web-research";
import {
  modelBadgeForId,
  planMotorActivitySteps,
} from "@/lib/chat-activity-messages";
import { getFumeroChatModelId } from "@/lib/chat-models";
import { shouldUseFumeroOpenRouterFastPath, parseChatModelTier } from "@/lib/chat-routing-policy";
import {
  callFactoryN8n,
  extractMessage,
  formatN8nChatError,
  n8nFetchTimeoutMs,
  streamChunks,
  type ChatContextMsg,
} from "@/lib/chat-n8n";
import { resolveChatWebhookUrl } from "@/lib/intent-detection";
import {
  chatUsageAgentLabel,
  chatUsageDisplayKind,
  chatUsageDisplayName,
  estimatePromptTokens,
  estimateTokens,
  formatTokenUsageLine,
  logMotorChatUsage,
  resolveUsageModel,
  usageCostEur,
  type TokenUsage,
} from "@/lib/chat-usage";

export const runtime = "nodejs";

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function buildChatUsagePayload(opts: {
  klant: string;
  prompt: string;
  message: string;
  context: ChatContextMsg[];
  agentMode: boolean;
  useResearch: boolean;
  routing: string;
  model: string;
  openrouterModel?: string | null;
  reportedUsage?: TokenUsage | null;
  durationMs: number;
  afdeling?: string | null;
}) {
  const agentLabel = chatUsageAgentLabel({
    agentMode: opts.agentMode,
    useResearch: opts.useResearch,
    routing: opts.routing,
  });
  const model = resolveUsageModel(opts.model, opts.openrouterModel);
  const promptTokens =
    opts.reportedUsage?.prompt_tokens ??
    estimatePromptTokens(opts.prompt, opts.context);
  const completionTokens =
    opts.reportedUsage?.completion_tokens ?? estimateTokens(opts.message);
  logMotorChatUsage({
    klant: opts.klant,
    afdeling: opts.afdeling,
    model,
    agentLabel,
    promptTokens,
    completionTokens,
    durationMs: opts.durationMs,
    prompt: opts.prompt,
    response: opts.message,
  });
  const kind = chatUsageDisplayKind(agentLabel);
  const costEur = usageCostEur(model, promptTokens, completionTokens);
  return {
    usage_label: agentLabel,
    usage_kind: kind,
    usage_display: chatUsageDisplayName(kind),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    cost_eur: costEur,
    usage_model: model,
    usage_line: formatTokenUsageLine({
      model,
      promptTokens,
      completionTokens,
      kind,
      costEur,
    }),
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const prompt = parseChatUserPrompt(body);
  const {
    klant = "fumero",
    afdeling,
    agent_mode = false,
    plan_mode = false,
    model_tier: modelTierRaw,
    context = [],
    conversation_id: conversationIdRaw,
  } = body as {
    klant?: string;
    afdeling?: string;
    agent_mode?: boolean;
    plan_mode?: boolean;
    model_tier?: string;
    context?: ChatContextMsg[];
    conversation_id?: number | null;
  };

  const modelTier = parseChatModelTier(modelTierRaw);

  const conversationId =
    typeof conversationIdRaw === "number" && Number.isFinite(conversationIdRaw)
      ? conversationIdRaw
      : null;

  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "prompt is required (or message)" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const afdelingStr =
    typeof afdeling === "string" && afdeling ? afdeling : null;

  let firstTurnForTitle = false;
  try {
    assertConversationForKlant(klant, conversationId);
    if (conversationId) {
      const c = db
        .prepare(
          `SELECT COUNT(*) as n FROM chat_history WHERE conversation_id = ?`
        )
        .get(conversationId) as { n: number };
      firstTurnForTitle = c.n === 0;
    }
  } catch (guardErr) {
    return new Response(
      JSON.stringify({
        error:
          guardErr instanceof Error ? guardErr.message : "Conversatiefout",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => controller.enqueue(sseEncode(obj));
      const keepaliveEveryMs = 12_000;
      let keepalive: ReturnType<typeof setInterval> | null = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`: keepalive ${Date.now()}\n\n`)
          );
        } catch {
          if (keepalive) clearInterval(keepalive);
          keepalive = null;
        }
      }, keepaliveEveryMs);

      const endStream = () => {
        if (keepalive) {
          clearInterval(keepalive);
          keepalive = null;
        }
        try {
          controller.close();
        } catch {
          /* al gesloten */
        }
      };

      push({ type: "start", timestamp: new Date().toISOString() });
      push({ type: "user_echo", content: prompt.trim() });
      push({ type: "status", phase: "thinking" });

      try {
        db.prepare(
          `INSERT INTO chat_history (klant, role, content, afdeling, conversation_id)
           VALUES (?, 'user', ?, ?, ?)`
        ).run(klant, prompt.trim(), afdelingStr, conversationId);

        if (conversationId) {
          db.prepare(
            `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
          ).run(conversationId);
        }

        const intent = detectChatIntent(prompt.trim());
        const agentMode = Boolean(agent_mode);
        const planMode = Boolean(plan_mode);
        const browserTask =
          agentMode && shouldUseBrowserTaskForAgent(prompt.trim(), intent);
        const ctx = mergeConversationContext(conversationId, context);

        const useResearch = shouldRunChatWebResearch(prompt.trim());
        const fumeroFast = shouldUseFumeroOpenRouterFastPath(klant, {
          agentMode,
          useResearchModel: useResearch,
        }, modelTier);
        const activitySteps = planMotorActivitySteps({
          klant,
          prompt: prompt.trim(),
          agentMode,
          browserTask,
          useResearch,
          intent,
          fumeroFast,
        });
        push({ type: "activities", steps: activitySteps });
        if (fumeroFast) {
          const modelId = getFumeroChatModelId();
          const badge = modelBadgeForId(modelId);
          push({
            type: "activity",
            label: badge ? `Max · ${badge}` : "Max bereidt antwoord…",
          });
          push({
            type: "routing",
            routing: "openrouter",
            model_badge: badge ?? undefined,
          });
        }

        const localHandled = await tryHandleLocalExecutorChat(
          prompt.trim(),
          intent,
          agentMode
        );
        if (localHandled.handled && localHandled.message) {
          const message = localHandled.message;
          push({
            type: "local_action",
            op: localHandled.local_op ?? null,
            label: "Motor voert actie uit op de NUC…",
          });
          for (const chunk of streamChunks(message, 18)) {
            push({ type: "delta", text: chunk });
            await new Promise((r) => setTimeout(r, 10));
          }
          const t0 = Date.now();
          const latencyMs = Math.max(0, Date.now() - t0);
          const insAsst = db
            .prepare(
              `INSERT INTO chat_history (klant, role, content, afdeling, model, conversation_id, latency_ms)
               VALUES (?, 'assistant', ?, ?, ?, ?, ?)`
            )
            .run(
              klant,
              message,
              afdelingStr,
              "nuc-local-executor",
              conversationId,
              latencyMs
            );
          const assistantMessageId = Number(insAsst.lastInsertRowid);
          if (conversationId && firstTurnForTitle) {
            scheduleConversationTitleUpdate(
              conversationId,
              klant,
              prompt.trim()
            );
          }
          maybeIngestMotorMemory(conversationId, klant);
          push({
            type: "done",
            message,
            assistant_message_id: assistantMessageId,
            experiment_id: null,
            experiment_variant: null,
            experiment_name: null,
            klant,
            afdeling: afdelingStr,
            model: "nuc-local-executor",
            agent_mode: agentMode,
            intent,
            browser_task: false,
            local_action: true,
            local_op: localHandled.local_op ?? null,
            routing: "local_executor",
            memory_active: true,
            timestamp: new Date().toISOString(),
            ...buildChatUsagePayload({
              klant,
              prompt: prompt.trim(),
              message,
              context: ctx,
              agentMode,
              useResearch,
              routing: "local_executor",
              model: "nuc-local-executor",
              durationMs: latencyMs,
              afdeling: afdelingStr,
            }),
          });
          endStream();
          return;
        }

        const openClawT0 = Date.now();
        let firstOpenClawDeltaAt: number | null = null;
        const openClawResult = await tryOpenClawChatStream({
          prompt: prompt.trim(),
          klant,
          conversationId,
          context: ctx,
          agentMode,
          planMode,
          useResearchModel: useResearch,
          fumeroModelTier: modelTier,
          onPrepare: () => {
            push({
              type: "activity",
              label: fumeroFast ? "Max bereidt antwoord…" : "Motor bereidt antwoord…",
            });
          },
          onStreamStart: (routing) => {
            if (firstOpenClawDeltaAt === null) {
              firstOpenClawDeltaAt = Date.now();
              push({
                type: "routing",
                routing,
                ttft_ms: firstOpenClawDeltaAt - openClawT0,
              });
            }
          },
          onDelta: (text) => {
            push({ type: "delta", text });
          },
        });

        if (openClawResult.handled) {
          const message = openClawResult.message;
          const latencyMs = Math.max(0, Date.now() - openClawT0);
          const modelLabel =
            openClawResult.routing === "openrouter"
              ? "openrouter-direct"
              : "openclaw-gateway";
          const insAsst = db
            .prepare(
              `INSERT INTO chat_history (klant, role, content, afdeling, model, conversation_id, latency_ms)
               VALUES (?, 'assistant', ?, ?, ?, ?, ?)`
            )
            .run(
              klant,
              message,
              afdelingStr,
              modelLabel,
              conversationId,
              latencyMs
            );
          const assistantMessageId = Number(insAsst.lastInsertRowid);
          if (conversationId && firstTurnForTitle) {
            scheduleConversationTitleUpdate(
              conversationId,
              klant,
              prompt.trim()
            );
          }
          maybeIngestMotorMemory(conversationId, klant);
          const openrouterModel =
            typeof (openClawResult.meta as { openrouter_model?: string })
              .openrouter_model === "string"
              ? (openClawResult.meta as { openrouter_model: string })
                  .openrouter_model
              : null;
          const metaUsage = (
            openClawResult.meta as {
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            }
          ).usage;
          const reportedUsage =
            metaUsage &&
            (Number(metaUsage.prompt_tokens) > 0 ||
              Number(metaUsage.completion_tokens) > 0)
              ? {
                  prompt_tokens: Number(metaUsage.prompt_tokens) || 0,
                  completion_tokens: Number(metaUsage.completion_tokens) || 0,
                }
              : null;
          push({
            type: "done",
            message,
            assistant_message_id: assistantMessageId,
            experiment_id: null,
            experiment_variant: null,
            experiment_name: null,
            klant,
            afdeling: afdelingStr,
            model:
              openClawResult.routing === "openrouter"
                ? "openrouter-direct"
                : "openclaw-gateway",
            agent_mode: agentMode,
            intent,
            browser_task: false,
            routing: openClawResult.routing,
            latency_ms: latencyMs,
            ttft_ms:
              firstOpenClawDeltaAt !== null
                ? firstOpenClawDeltaAt - openClawT0
                : null,
            web_research: useResearch,
            openrouter_model: openrouterModel,
            memory_active: true,
            timestamp: new Date().toISOString(),
            ...buildChatUsagePayload({
              klant,
              prompt: prompt.trim(),
              message,
              context: ctx,
              agentMode,
              useResearch,
              routing: openClawResult.routing,
              model:
                openClawResult.routing === "openrouter"
                  ? "openrouter-direct"
                  : "openclaw-gateway",
              openrouterModel,
              reportedUsage,
              durationMs: latencyMs,
              afdeling: afdelingStr,
            }),
          });
          endStream();
          return;
        }

        push({
          type: "activities",
          steps: [
            "Motor schakelt over…",
            "Automation-workflow draait…",
          ],
        });
        push({
          type: "status",
          phase: "fallback",
          label: "Motor werkt je opdracht af…",
        });
        push({
          type: "routing",
          routing: "n8n",
          fallback: true,
        });

        const {
          promptForFactory,
          experimentId,
          experimentVariant,
          experimentName,
        } = await buildPromptForN8n(klant, prompt.trim());

        const webhookUrl = resolveChatWebhookUrl(intent, { agentMode });

        const t0 = Date.now();
        const { ok, status, data, rawText, webhookUrl: calledUrl, fetchError } =
          await callFactoryN8n(
            {
              prompt: promptForFactory,
              klant,
              ...(afdelingStr ? { afdeling: afdelingStr } : {}),
              agent_mode: agentMode,
              browser_task: browserTask,
              context: ctx,
              intent,
              conversation_id: conversationId,
            },
            {
              webhookUrl,
              timeoutMs: n8nFetchTimeoutMs({ browserTask, agentMode }),
            }
          );
        const latencyMs = Math.max(0, Date.now() - t0);

        if (!ok) {
          const err = formatN8nChatError({
            status,
            webhookUrl: calledUrl,
            fetchError,
            rawText,
          });
          push({
            type: "error",
            message: err.message,
            detail: err.detail,
          });
          endStream();
          return;
        }

        const payload = data ?? {};
        const message = extractMessage(payload);

        const liveUrlRaw = payload.debugger_fullscreen_url;
        const sessionRaw = payload.session_id;
        if (
          agentMode &&
          (typeof liveUrlRaw === "string" || typeof sessionRaw === "string")
        ) {
          push({
            type: "agent_live",
            debugger_fullscreen_url:
              typeof liveUrlRaw === "string" ? liveUrlRaw.trim() : null,
            session_id:
              typeof sessionRaw === "string" ? sessionRaw.trim() : null,
          });
        }
        const outAfdeling =
          typeof payload.afdeling === "string" ? payload.afdeling : afdelingStr;
        const model =
          typeof payload.model === "string" ? payload.model : "factory-os";

        for (const chunk of streamChunks(message, 18)) {
          push({ type: "delta", text: chunk });
          await new Promise((r) => setTimeout(r, 10));
        }

        const insAsst = db
          .prepare(
            `INSERT INTO chat_history (klant, role, content, afdeling, model, conversation_id, experiment_id, experiment_variant, latency_ms)
             VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            klant,
            message,
            outAfdeling,
            model,
            conversationId,
            experimentId,
            experimentVariant,
            latencyMs
          );
        const assistantMessageId = Number(insAsst.lastInsertRowid);

        if (conversationId && firstTurnForTitle) {
          scheduleConversationTitleUpdate(
            conversationId,
            klant,
            prompt.trim()
          );
        }

        maybeIngestMotorMemory(conversationId, klant);

        const n8nUsageRaw = payload as {
          prompt_tokens?: number;
          completion_tokens?: number;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const n8nUsageSrc = n8nUsageRaw.usage ?? n8nUsageRaw;
        const n8nReported: TokenUsage | null =
          n8nUsageSrc.prompt_tokens || n8nUsageSrc.completion_tokens
            ? {
                prompt_tokens: Number(n8nUsageSrc.prompt_tokens) || 0,
                completion_tokens: Number(n8nUsageSrc.completion_tokens) || 0,
              }
            : null;

        push({
          type: "done",
          message,
          assistant_message_id: assistantMessageId,
          experiment_id: experimentId,
          experiment_variant: experimentVariant,
          experiment_name: experimentName,
          klant,
          afdeling: outAfdeling,
          model,
          agent_mode: agentMode,
          intent,
          browser_task: browserTask,
          routing: "n8n",
          memory_active: true,
          timestamp: new Date().toISOString(),
          ...buildChatUsagePayload({
            klant,
            prompt: prompt.trim(),
            message,
            context: ctx,
            agentMode,
            useResearch,
            routing: "n8n",
            model,
            reportedUsage: n8nReported,
            durationMs: latencyMs,
            afdeling: outAfdeling,
          }),
        });
      } catch (e: unknown) {
        push({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        endStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
