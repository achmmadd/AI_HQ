import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Proxy naar bookkeeping-bot GET /odoo/bills (Odoo vendor bills). */
export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year") || "2026";
  const quarter = req.nextUrl.searchParams.get("quarter");
  const qs = new URLSearchParams({ year });
  if (quarter) qs.set("quarter", quarter);

  try {
    const res = await fetch(`${base()}/odoo/bills?${qs.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
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
        ok: false,
        error: e instanceof Error ? e.message : "bookkeeping unreachable",
      },
      { status: 502 }
    );
  }
}
