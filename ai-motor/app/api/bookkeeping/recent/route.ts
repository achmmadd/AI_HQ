import { NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Proxy naar bookkeeping-bot GET /recent (receipts). */
export async function GET() {
  try {
    const res = await fetch(`${base()}/recent`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "bookkeeping unreachable",
        receipts: [],
      },
      { status: 502 }
    );
  }
}
