import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Bulk goedkeuren/afwijzen wachtende bonnen. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    tokens?: string[];
    action?: string;
    reason?: string;
  };
  if (!Array.isArray(body.tokens) || body.tokens.length === 0) {
    return NextResponse.json({ error: "tokens array verplicht" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action approve|reject" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base()}/pending/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bookkeeping unreachable" },
      { status: 502 }
    );
  }
}
