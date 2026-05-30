import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Odoo retry-wachtrij ophalen. */
export async function GET() {
  try {
    const res = await fetch(`${base()}/retry`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "bookkeeping unreachable",
        items: [],
      },
      { status: 502 }
    );
  }
}

/** Forceer Odoo retry voor alle items in de wachtrij. */
export async function POST(_req: NextRequest) {
  try {
    const res = await fetch(`${base()}/retry/flush`, {
      method: "POST",
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
