import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  try {
    const res = await fetch(`${base()}/bank${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bookkeeping unreachable", items: [] },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const year = form.get("year");
  const month = form.get("month");
  const label = form.get("label");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file verplicht" }, { status: 400 });
  }
  if (!year || !month) {
    return NextResponse.json({ error: "year en month verplicht" }, { status: 400 });
  }

  const out = new FormData();
  out.append("file", file, file.name);
  const qs = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (typeof label === "string" && label.trim()) qs.set("label", label.trim());

  try {
    const res = await fetch(`${base()}/bank/upload?${qs}`, {
      method: "POST",
      body: out,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
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
