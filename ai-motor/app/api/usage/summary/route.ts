import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  chatUsageDisplayKind,
  chatUsageDisplayName,
} from "@/lib/chat-usage-labels";

export const runtime = "nodejs";

function dateFilterSql(period: string): string {
  if (period === "week") {
    return "datetime(created_at) >= datetime('now', '-7 days')";
  }
  if (period === "month") {
    return "datetime(created_at) >= datetime('now', '-30 days')";
  }
  return "date(created_at) = date('now')";
}

/** Uitgebreide usage-samenvatting (tokens per Motor/Turbo/…). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "today";
  const klantFilter = url.searchParams.get("klant")?.trim();
  const safePeriod = ["today", "week", "month"].includes(period)
    ? period
    : "today";
  const filter = dateFilterSql(safePeriod);
  const klantSql = klantFilter ? " AND klant = ?" : "";
  const klantArgs = klantFilter ? [klantFilter] : [];

  const totals = db
    .prepare(
      `SELECT
        COALESCE(model, 'unknown') as model,
        COALESCE(klant, 'unknown') as klant,
        SUM(cost_usd) as total_cost,
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as total_tokens,
        COUNT(*) as total_calls
      FROM usage_logs
      WHERE ${filter}${klantSql}
      GROUP BY model, klant
      ORDER BY total_cost DESC`
    )
    .all(...klantArgs);

  const byAgent = db
    .prepare(
      `SELECT
        COALESCE(agent_label, 'overig') as agent_label,
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as total_tokens,
        SUM(COALESCE(cost_eur, cost_usd * 0.92, 0)) as total_cost_eur,
        SUM(cost_usd) as total_cost_usd,
        COUNT(*) as total_calls
      FROM usage_logs
      WHERE ${filter}${klantSql}
      GROUP BY agent_label
      ORDER BY total_tokens DESC`
    )
    .all(...klantArgs) as Array<{
    agent_label: string;
    total_tokens: number;
    total_cost_eur: number;
    total_calls: number;
  }>;

  const daily = db
    .prepare(
      `SELECT
        date(created_at) as dag,
        SUM(cost_usd) as kosten,
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as tokens,
        COUNT(*) as calls
      FROM usage_logs
      WHERE datetime(created_at) >= datetime('now', '-30 days')${klantSql}
      GROUP BY dag
      ORDER BY dag ASC`
    )
    .all(...klantArgs);

  const rows = totals as Array<{
    total_cost: number | null;
    total_tokens?: number;
  }>;
  const grandTotal = rows.reduce(
    (sum, r) => sum + (Number(r.total_cost) || 0),
    0
  );
  const totalTokens = rows.reduce(
    (sum, r) => sum + (Number(r.total_tokens) || 0),
    0
  );
  const totalEur = byAgent.reduce(
    (sum, r) => sum + (Number(r.total_cost_eur) || 0),
    0
  );

  return NextResponse.json({
    period: safePeriod,
    klant: klantFilter ?? null,
    totals,
    by_agent: byAgent.map((r) => ({
      ...r,
      display_name: chatUsageDisplayName(
        chatUsageDisplayKind(r.agent_label)
      ),
    })),
    daily,
    grand_total: grandTotal.toFixed(4),
    total_tokens: totalTokens,
    total_eur: totalEur,
  });
}
