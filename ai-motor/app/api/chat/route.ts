import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  callFactoryN8n,
  extractMessage,
  normalizeContext,
  type ChatContextMsg,
} from "@/lib/chat-n8n";

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
    } = body as {
      prompt?: string;
      klant?: string;
      afdeling?: string;
      agent_mode?: boolean;
      context?: ChatContextMsg[];
    };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const afdelingStr =
      typeof afdeling === "string" && afdeling ? afdeling : null;

    db.prepare(
      `INSERT INTO chat_history (klant, role, content, afdeling)
       VALUES (?, 'user', ?, ?)`
    ).run(klant, prompt.trim(), afdelingStr);

    const ctx = normalizeContext(context);

    const { ok, status, data, rawText } = await callFactoryN8n({
      prompt: prompt.trim(),
      klant,
      ...(afdelingStr ? { afdeling: afdelingStr } : {}),
      agent_mode: Boolean(agent_mode),
      context: ctx,
    });

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

    db.prepare(
      `INSERT INTO chat_history (klant, role, content, afdeling, model)
       VALUES (?, 'assistant', ?, ?, ?)`
    ).run(klant, message, outAfdeling, model);

    return NextResponse.json({
      message,
      klant,
      afdeling: outAfdeling,
      model,
      agent_mode: Boolean(agent_mode),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
