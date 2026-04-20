import { NextRequest } from "next/server";
import db from "@/lib/db/database";
import { scheduleConversationTitleUpdate } from "@/lib/chat-conversation-title";
import { assertConversationForKlant } from "@/lib/chat-conversation-guard";
import { getChatLearnedInstructionSuffix } from "@/lib/chat-learned";
import {
  experimentInstructionOverlay,
  getActiveExperimentForKlant,
  pickVariant,
} from "@/lib/experiments";
import {
  callFactoryN8n,
  CHAT_OUTPUT_INSTRUCTION_PREFIX,
  extractMessage,
  normalizeContext,
  streamChunks,
  type ChatContextMsg,
} from "@/lib/chat-n8n";
import { detectChatIntent, resolveChatWebhookUrl } from "@/lib/intent-detection";

export const runtime = "nodejs";

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    prompt,
    klant = "fumero",
    afdeling,
    agent_mode = false,
    context = [],
    conversation_id: conversationIdRaw,
  } = body as {
    prompt?: string;
    klant?: string;
    afdeling?: string;
    agent_mode?: boolean;
    context?: ChatContextMsg[];
    conversation_id?: number | null;
  };

  const conversationId =
    typeof conversationIdRaw === "number" && Number.isFinite(conversationIdRaw)
      ? conversationIdRaw
      : null;

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const afdelingStr =
    typeof afdeling === "string" && afdeling ? afdeling : null;
  const ctx = normalizeContext(context);

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

      push({ type: "start", timestamp: new Date().toISOString() });

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

        const exp = getActiveExperimentForKlant(klant);
        const expVariant = exp ? pickVariant() : null;
        const experimentOverlay =
          exp && expVariant
            ? experimentInstructionOverlay(exp, expVariant)
            : "";

        const promptForFactory =
          CHAT_OUTPUT_INSTRUCTION_PREFIX +
          getChatLearnedInstructionSuffix() +
          experimentOverlay +
          prompt.trim();

        const intent = detectChatIntent(prompt.trim());
        const webhookUrl = resolveChatWebhookUrl(intent);

        const t0 = Date.now();
        const { ok, status, data, rawText } = await callFactoryN8n(
          {
            prompt: promptForFactory,
            klant,
            ...(afdelingStr ? { afdeling: afdelingStr } : {}),
            agent_mode: Boolean(agent_mode),
            context: ctx,
            intent,
          },
          { webhookUrl }
        );
        const latencyMs = Math.max(0, Date.now() - t0);

        if (!ok) {
          push({
            type: "error",
            message: `n8n error: ${status}`,
            detail: rawText.slice(0, 500),
          });
          controller.close();
          return;
        }

        const payload = data ?? {};
        const message = extractMessage(payload);
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
            exp?.id ?? null,
            expVariant,
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

        push({
          type: "done",
          message,
          assistant_message_id: assistantMessageId,
          experiment_id: exp?.id ?? null,
          experiment_variant: expVariant,
          experiment_name: exp?.name ?? null,
          klant,
          afdeling: outAfdeling,
          model,
          agent_mode: Boolean(agent_mode),
          intent,
          timestamp: new Date().toISOString(),
        });
      } catch (e: unknown) {
        push({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        controller.close();
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
