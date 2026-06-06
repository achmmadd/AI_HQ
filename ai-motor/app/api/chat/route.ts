import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  callFactoryN8n,
  extractMessage,
  formatN8nChatError,
  n8nFetchTimeoutMs,
  type ChatContextMsg,
} from "@/lib/chat-n8n";
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
import { resolveChatWebhookUrl } from "@/lib/intent-detection";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const prompt = parseChatUserPrompt(body);
    const {
      klant = "fumero",
      afdeling,
      agent_mode = false,
      context = [],
      conversation_id: conversationIdRaw,
    } = body as {
      klant?: string;
      afdeling?: string;
      agent_mode?: boolean;
      context?: ChatContextMsg[];
      conversation_id?: number | null;
    };

    const auth = await requireApiAuthForKlant(req, klant);
    if (auth instanceof Response) return auth;

    const conversationId =
      typeof conversationIdRaw === "number" && Number.isFinite(conversationIdRaw)
        ? conversationIdRaw
        : null;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required (or message)" },
        { status: 400 }
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
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Conversatiefout" },
        { status: 400 }
      );
    }

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
    const browserTask =
      agentMode && shouldUseBrowserTaskForAgent(prompt.trim(), intent);
    const ctx = mergeConversationContext(conversationId, context);

    const localHandled = await tryHandleLocalExecutorChat(
      prompt.trim(),
      intent,
      agentMode
    );
    if (localHandled.handled && localHandled.message) {
      const t0 = Date.now();
      const message = localHandled.message;
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
        scheduleConversationTitleUpdate(conversationId, klant, prompt.trim());
      }
      maybeIngestMotorMemory(conversationId, klant);
      return NextResponse.json({
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
        memory_active: true,
        timestamp: new Date().toISOString(),
      });
    }

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
      return NextResponse.json(
        { error: err.message, detail: err.detail },
        { status: status > 0 ? status : 502 }
      );
    }

    const payload = data ?? {};
    const message = extractMessage(payload);
    const outAfdeling =
      typeof payload.afdeling === "string" ? payload.afdeling : afdelingStr;
    const model =
      typeof payload.model === "string" ? payload.model : "factory-os";

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
      scheduleConversationTitleUpdate(conversationId, klant, prompt.trim());
    }

    maybeIngestMotorMemory(conversationId, klant);

    return NextResponse.json({
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
      memory_active: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
