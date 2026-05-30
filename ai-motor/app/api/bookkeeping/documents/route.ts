import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Lijst bon-PDF's uit export_boekhouder voor een kwartaal. */
export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year") ?? "2026";
  const quarter = req.nextUrl.searchParams.get("quarter");
  if (!quarter) {
    return NextResponse.json({ error: "quarter is verplicht (1-4)" }, { status: 400 });
  }

  try {
    const qs = new URLSearchParams({ year, quarter });
    const res = await fetch(`${base()}/export/documents?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { error: text };
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
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
