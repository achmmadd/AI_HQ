import { NextRequest } from "next/server";
import db from "@/lib/db/database";
import {
  callFactoryN8n,
  extractMessage,
  normalizeContext,
  streamChunks,
  type ChatContextMsg,
} from "@/lib/chat-n8n";

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
  } = body as {
    prompt?: string;
    klant?: string;
    afdeling?: string;
    agent_mode?: boolean;
    context?: ChatContextMsg[];
  };

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const afdelingStr =
    typeof afdeling === "string" && afdeling ? afdeling : null;
  const ctx = normalizeContext(context);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => controller.enqueue(sseEncode(obj));

      push({ type: "start", timestamp: new Date().toISOString() });

      try {
        db.prepare(
          `INSERT INTO chat_history (klant, role, content, afdeling)
           VALUES (?, 'user', ?, ?)`
        ).run(klant, prompt.trim(), afdelingStr);

        const { ok, status, data, rawText } = await callFactoryN8n({
          prompt: prompt.trim(),
          klant,
          ...(afdelingStr ? { afdeling: afdelingStr } : {}),
          agent_mode: Boolean(agent_mode),
          context: ctx,
        });

        if (!ok) {
          push({
            type: "error",
            message: `n8n error: ${status}`,
            detail: rawText.slice(0, 500),
          });
          controller.close();
          return;
        }

        const message = extractMessage(data);
        const outAfdeling =
          typeof data.afdeling === "string" ? data.afdeling : afdelingStr;
        const model =
          typeof data.model === "string" ? data.model : "factory-os";

        for (const chunk of streamChunks(message, 18)) {
          push({ type: "delta", text: chunk });
          await new Promise((r) => setTimeout(r, 10));
        }

        db.prepare(
          `INSERT INTO chat_history (klant, role, content, afdeling, model)
           VALUES (?, 'assistant', ?, ?, ?)`
        ).run(klant, message, outAfdeling, model);

        push({
          type: "done",
          message,
          klant,
          afdeling: outAfdeling,
          model,
          agent_mode: Boolean(agent_mode),
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
