import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Open of download één bon-PDF (proxy naar bookkeeping-bot). */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is verplicht" }, { status: 400 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const qs = new URLSearchParams({ path, download: download ? "true" : "false" });

  try {
    const res = await fetch(`${base()}/export/document?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: errText || res.statusText },
        { status: res.status }
      );
    }

    const body = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/pdf";
    const disposition =
      res.headers.get("content-disposition") ||
      `${download ? "attachment" : "inline"}; filename="bon.pdf"`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bookkeeping unreachable" },
      { status: 502 }
    );
  }
}
