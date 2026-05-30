import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";

export const runtime = "nodejs";

type PaymentRow = {
  payment_ref: string;
  method: string;
  amount_eur: number;
  status: string;
  meta_json: string | null;
  created_at: string;
};

function ensurePaymentsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fumero_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_ref TEXT UNIQUE NOT NULL,
      method TEXT NOT NULL,
      amount_eur REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ref: string }> }
) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;
  ensurePaymentsTable();

  const { ref } = await ctx.params;
  const row = db
    .prepare(
      `SELECT payment_ref, method, amount_eur, status, meta_json, created_at
       FROM fumero_payments
       WHERE payment_ref = ?`
    )
    .get(ref) as PaymentRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "betaling niet gevonden" }, { status: 404 });
  }

  const meta = row.meta_json ? JSON.parse(row.meta_json) : null;
  return NextResponse.json({
    payment_ref: row.payment_ref,
    method: row.method,
    amount_eur: row.amount_eur,
    status: row.status,
    meta,
    created_at: row.created_at,
  });
}
