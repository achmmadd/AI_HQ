import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

/** Wijzig alle velden op wachtende bon (concept opslaan). */
export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const token =
    typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token verplicht" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  const strFields = [
    "vendor", "date", "note", "filename", "category",
    "location", "payment_method", "receipt_number",
  ] as const;
  for (const f of strFields) {
    if (typeof body[f] === "string") payload[f] = body[f];
  }
  if (typeof body.amount === "number") payload.amount = body.amount;
  if (typeof body.btw_rate === "number" && (body.btw_rate === 9 || body.btw_rate === 21)) {
    payload.btw_rate = body.btw_rate;
  }

  try {
    const res = await fetch(`${base()}/pending/${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
