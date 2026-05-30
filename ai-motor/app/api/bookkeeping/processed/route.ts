import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Gearchiveerde bon ophalen of bewerken. */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path")?.trim();
  if (!path) {
    return NextResponse.json({ error: "path verplicht" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${base()}/processed/${encodeURIComponent(path)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bookkeeping unreachable" },
      { status: 502 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${base()}/processed`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
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
