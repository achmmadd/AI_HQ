import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Bon/factuur preview (JPEG of PDF) voor wachtende items. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token verplicht" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${base()}/pending/${encodeURIComponent(token)}/preview`,
      { cache: "no-store", signal: AbortSignal.timeout(30_000) }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (j as { detail?: string }).detail || res.statusText },
        { status: res.status }
      );
    }
    const buf = await res.arrayBuffer();
    const type = res.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bookkeeping unreachable" },
      { status: 502 }
    );
  }
}
