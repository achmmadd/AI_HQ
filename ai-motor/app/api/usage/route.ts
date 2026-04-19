import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5": { input: 0.001, output: 0.005 },
  "deepseek-chat": { input: 0.00027, output: 0.0011 },
  ollama: { input: 0, output: 0 },
  "factory-os": { input: 0.001, output: 0.005 },
};

function dateFilterSql(period: string): string {
  if (period === "week") {
    return "datetime(created_at) >= datetime('now', '-7 days')";
  }
  if (period === "month") {
    return "datetime(created_at) >= datetime('now', '-30 days')";
  }
  return "date(created_at) = date('now')";
}

export async function GET(req: NextRequest) {
  const period =
    new URL(req.url).searchParams.get("period") || "today";
  const safePeriod = ["today", "week", "month"].includes(period)
    ? period
    : "today";
  const filter = dateFilterSql(safePeriod);

  const totals = db
    .prepare(
      `SELECT
        COALESCE(model, 'unknown') as model,
        COALESCE(klant, 'unknown') as klant,
        SUM(cost_usd) as total_cost,
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as total_tokens,
        COUNT(*) as total_calls
      FROM usage_logs
      WHERE ${filter}
      GROUP BY model, klant
      ORDER BY total_cost DESC`
    )
    .all();

  const daily = db
    .prepare(
      `SELECT
        date(created_at) as dag,
        SUM(cost_usd) as kosten,
        COUNT(*) as calls
      FROM usage_logs
      WHERE datetime(created_at) >= datetime('now', '-30 days')
      GROUP BY dag
      ORDER BY dag ASC`
    )
    .all();

  const rows = totals as Array<{ total_cost: number | null }>;
  const grandTotal = rows.reduce(
    (sum, r) => sum + (Number(r.total_cost) || 0),
    0
  );

  return NextResponse.json({
    period: safePeriod,
    totals,
    daily,
    grand_total: grandTotal.toFixed(4),
    model_costs: MODEL_COSTS,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    klant,
    afdeling,
    model = "factory-os",
    prompt_tokens = 0,
    completion_tokens = 0,
    duration_ms = 0,
    success = true,
  } = body as Record<string, unknown>;

  const m = String(model);
  const costs = MODEL_COSTS[m] ?? MODEL_COSTS["factory-os"];
  const pt = Number(prompt_tokens) || 0;
  const ct = Number(completion_tokens) || 0;
  const cost_usd =
    (pt * costs.input) / 1000 + (ct * costs.output) / 1000;

  db.prepare(
    `INSERT INTO usage_logs
      (klant, afdeling, model, prompt_tokens, completion_tokens,
       cost_usd, duration_ms, success)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    klant != null ? String(klant) : null,
    afdeling != null ? String(afdeling) : null,
    m,
    pt,
    ct,
    cost_usd,
    Number(duration_ms) || 0,
    success ? 1 : 0
  );

  return NextResponse.json({ logged: true, cost_usd });
}
