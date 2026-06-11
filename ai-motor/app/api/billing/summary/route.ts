import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";
import { getUsageBudgetStatus } from "@/lib/usage-budget";
import db from "@/lib/db/database";

export const runtime = "nodejs";

/** Minimale billing-samenvatting: budget + usage_logs deze maand. */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const klant = sp.get("klant")?.trim().toLowerCase() || "fumero";
  if (klant !== "fumero" && klant !== "bokas") {
    return NextResponse.json(
      { error: "klant=fumero|bokas verplicht" },
      { status: 400 }
    );
  }

  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof NextResponse) return auth;

  const budget = getUsageBudgetStatus(klant);

  const byModel = db
    .prepare(
      `SELECT
        COALESCE(model, 'unknown') as model,
        COUNT(*) as calls,
        SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) as tokens,
        SUM(COALESCE(cost_eur, cost_usd * 0.92, 0)) as cost_eur
      FROM usage_logs
      WHERE klant = ? AND datetime(created_at) >= datetime('now', 'start of month')
      GROUP BY model
      ORDER BY cost_eur DESC`
    )
    .all(klant) as Array<{
    model: string;
    calls: number;
    tokens: number;
    cost_eur: number;
  }>;

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

  const eurUsdRate = Number(process.env.EUR_USD_RATE?.trim()) || 0.92;

  return NextResponse.json({
    klant,
    budget,
    usage_this_month: byModel,
    pricing: {
      currency: "EUR",
      source: "OpenRouter usage_logs (cost_eur of cost_usd × koers)",
      eur_usd_rate: eurUsdRate,
      rounded_to: "0,001 € per modelregel",
      as_of: new Date().toISOString(),
    },
    billing_provider: stripeConfigured ? "stripe_stub" : "internal",
    stripe_webhook: "/api/billing/webhook/stripe",
    note: stripeConfigured
      ? "Stripe-keys aanwezig — webhook stub actief; volledige facturatie volgt in Fase 6."
      : "Interne usage-tracking actief; Stripe niet geconfigureerd.",
  });
}
