import { NextRequest, NextResponse } from "next/server";

const WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, klant, afdeling } = body as {
      prompt?: string;
      klant?: string;
      afdeling?: string;
    };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    const r = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        klant: klant || "fumero",
        ...(afdeling ? { afdeling } : {}),
      }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: text || r.statusText },
        { status: r.status }
      );
    }
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ output: text });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upstream error" },
      { status: 502 }
    );
  }
}
