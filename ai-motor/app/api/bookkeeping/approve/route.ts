import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function base(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

type Action = "approve" | "reject";

type BookkeepingResult = {
  ok?: boolean;
  status?: string;
  token?: string;
  error?: string;
  warning?: string;
  move_id?: number;
  pdf_name?: string;
};

function isAction(value: unknown): value is Action {
  return value === "approve" || value === "reject";
}

function titleFor(action: Action, vendor: string | null, amount: number | null): string {
  const label = action === "approve" ? "Bon goedgekeurd" : "Bon afgewezen";
  const amountLabel = amount != null ? ` (€${amount.toFixed(2)})` : "";
  return `${label}: ${vendor || "onbekende leverancier"}${amountLabel}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const receiptId =
    typeof body.receipt_id === "string"
      ? body.receipt_id.trim()
      : typeof body.token === "string"
        ? body.token.trim()
        : "";
  const action = body.action;
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const vendor =
    typeof body.vendor === "string" && body.vendor.trim()
      ? body.vendor.trim().slice(0, 200)
      : null;
  const amount =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? body.amount
      : null;

  if (!receiptId || !isAction(action)) {
    return NextResponse.json(
      { error: "receipt_id and action approve|reject required" },
      { status: 400 }
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "reason is verplicht bij afwijzen" },
      { status: 400 }
    );
  }

  const endpoint = action === "approve" ? "approve" : "reject";
  const res = await fetch(`${base()}/${endpoint}/${encodeURIComponent(receiptId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "reject" ? { reason } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let result: BookkeepingResult;
  try {
    result = text ? (JSON.parse(text) as BookkeepingResult) : {};
  } catch {
    result = { ok: false, error: text || res.statusText };
  }

  if (!res.ok || result.ok === false) {
    return NextResponse.json(
      {
        error: result.error || result.status || res.statusText,
        bookkeeping: result,
      },
      { status: res.ok ? 502 : res.status }
    );
  }

  const resolvedStatus = action === "approve" ? "approved" : "rejected";
  const payload = {
    receipt_id: receiptId,
    vendor,
    amount,
    action,
    reason: reason || null,
    bookkeeping: result,
  };
  const insert = db
    .prepare(
      `INSERT INTO approvals
        (title, description, action, payload, status, requested_by, klant,
         resolved_at, resolved_by, reject_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`
    )
    .run(
      titleFor(action, vendor, amount),
      result.warning || result.status || null,
      `bookkeeping.${action}`,
      JSON.stringify(payload),
      resolvedStatus,
      "bookkeeping-bot",
      "bokas",
      "Motor AI",
      action === "reject" ? reason : null
    );

  void sendTelegramMessage(
    `${resolvedStatus === "approved" ? "Goedkeuring" : "Afwijzing"} bon ${receiptId.slice(0, 8)} via Motor AI`
  );

  return NextResponse.json({
    ok: true,
    id: insert.lastInsertRowid,
    status: resolvedStatus,
    bookkeeping: result,
  });
}
