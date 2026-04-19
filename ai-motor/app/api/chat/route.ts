import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      klant = "fumero",
      afdeling,
    } = body as {
      prompt?: string;
      klant?: string;
      afdeling?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const response = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        klant,
        ...(afdeling ? { afdeling } : {}),
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
      typeof data.afdeling === "string" ? data.afdeling : undefined;

    return NextResponse.json({
      message,
      klant,
      afdeling: outAfdeling || afdeling,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
