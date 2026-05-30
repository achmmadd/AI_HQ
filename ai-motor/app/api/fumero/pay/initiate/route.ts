import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  fumeroPayBankMeta,
  fumeroPayCryptoMeta,
  isFumeroPayConfigured,
} from "@/lib/fumero/pay-config";

export const runtime = "nodejs";

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

function paymentRef(): string {
  return `fum_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  ensurePaymentsTable();
  const body = (await req.json().catch(() => ({}))) as {
    method?: "bank" | "crypto";
    amount_eur?: number;
  };
  const method = body.method === "crypto" ? "crypto" : "bank";
  const amount = Number(body.amount_eur || 0);
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_eur ongeldig" }, { status: 400 });
  }

  if (!isFumeroPayConfigured(method)) {
    return NextResponse.json(
      {
        error:
          method === "bank"
            ? "Bankbetaling niet geconfigureerd — zet FUMERO_PAY_IBAN en FUMERO_PAY_BENEFICIARY."
            : "Crypto niet geconfigureerd — zet FUMERO_PAY_CRYPTO_WALLET.",
      },
      { status: 503 }
    );
  }

  const ref = paymentRef();
  const meta =
    method === "bank"
      ? fumeroPayBankMeta(amount, ref)
      : fumeroPayCryptoMeta(amount);

  db.prepare(
    `INSERT INTO fumero_payments (payment_ref, method, amount_eur, status, meta_json)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(ref, method, amount, JSON.stringify(meta));

  return NextResponse.json({
    ok: true,
    payment_ref: ref,
    method,
    amount_eur: amount,
    status: "pending",
    configured: true,
    ...meta,
  });
}
