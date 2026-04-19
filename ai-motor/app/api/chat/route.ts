import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

const N8N_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

function extractMessage(data: Record<string, unknown>): string {
  const candidates = [
    data.output,
    data.answer,
    data.message,
    data.answer_raw,
    data.text,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return JSON.stringify(data);
}

type CtxMsg = { role?: string; content?: string };

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
      context?: CtxMsg[];
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

    const ctx = Array.isArray(context)
      ? context
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const response = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        klant,
        ...(afdelingStr ? { afdeling: afdelingStr } : {}),
        agent_mode: Boolean(agent_mode),
        context: ctx,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const t = await response.text();
      return NextResponse.json(
        { error: `n8n error: ${response.status}`, detail: t.slice(0, 500) },
        { status: response.status }
      );
    }

    const rawText = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { output: rawText };
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
