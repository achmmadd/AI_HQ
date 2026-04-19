import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  callFactoryN8n,
  CHAT_OUTPUT_INSTRUCTION_PREFIX,
  extractMessage,
  normalizeContext,
  type ChatContextMsg,
} from "@/lib/chat-n8n";
import { scheduleConversationTitleUpdate } from "@/lib/chat-conversation-title";
import { assertConversationForKlant } from "@/lib/chat-conversation-guard";
import { getChatLearnedInstructionSuffix } from "@/lib/chat-learned";
import {
  experimentInstructionOverlay,
  getActiveExperimentForKlant,
  pickVariant,
} from "@/lib/experiments";
import { detectChatIntent, resolveChatWebhookUrl } from "@/lib/intent-detection";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "prompt is required" },
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

    const ctx = normalizeContext(context);

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
      return NextResponse.json(
        { error: `n8n error: ${status}`, detail: rawText.slice(0, 500) },
        { status }
      );
    }

    const message = extractMessage(data);
    const outAfdeling =
      typeof data.afdeling === "string" ? data.afdeling : afdelingStr;
    const model =
      typeof data.model === "string" ? data.model : "factory-os";

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
      scheduleConversationTitleUpdate(conversationId, klant, prompt.trim());
    }

    return NextResponse.json({
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
