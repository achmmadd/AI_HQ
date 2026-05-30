import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** PDF-factuur uploaden → pending approval in bookkeeping-bot. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const note = form.get("note");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file verplicht (PDF)" }, { status: 400 });
  }

  const out = new FormData();
  out.append("file", file, file.name);
  const qs = new URLSearchParams();
  if (typeof note === "string" && note.trim()) qs.set("note", note.trim());

  try {
    const res = await fetch(`${base()}/upload/invoice?${qs}`, {
      method: "POST",
      body: out,
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
