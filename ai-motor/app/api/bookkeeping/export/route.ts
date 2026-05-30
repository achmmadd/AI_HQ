import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Kwartaal-ZIP voor boekhouder (formaat 2026-Q1-Boka's-…-001.zip). */
export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year") ?? "2026";
  const quarter = req.nextUrl.searchParams.get("quarter");
  if (!quarter) {
    return NextResponse.json({ error: "quarter is verplicht (1-4)" }, { status: 400 });
  }

  try {
    const qs = new URLSearchParams({ year, quarter });
    const res = await fetch(`${base()}/export/quarter-zip?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText;
      try {
        const j = JSON.parse(errText) as { detail?: string };
        detail = j.detail || errText;
      } catch {
        /* raw text */
      }
      return NextResponse.json({ error: detail || res.statusText }, { status: res.status });
    }

    const body = await res.arrayBuffer();
    const disposition =
      res.headers.get("content-disposition") ||
      `attachment; filename="${year}-Q${quarter}-Bokas-export.zip"`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": disposition,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bookkeeping unreachable" },
      { status: 502 }
    );
  }
}
