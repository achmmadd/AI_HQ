import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

/** Minuten handwerk per gegenereerde post (conservatief); zichtbaar in UI. */
const TIME_SAVED_MIN_PER_GENERATION = 12;

function pctWow(current: number, previous: number): number | null {
  if (previous <= 0) {
    if (current <= 0) return null;
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function safeKlant(raw: string | null): "fumero" | "bokas" | null {
  if (raw === "fumero" || raw === "bokas") return raw;
  return null;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const klant = safeKlant(sp.get("klant"));
  if (!klant) {
    return NextResponse.json(
      { error: "klant=fumero|bokas verplicht" },
      { status: 400 }
    );
  }

  const genThis = db
    .prepare(
      `SELECT platform, COUNT(*) as c
       FROM content_posts
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-7 days')
       GROUP BY platform`
    )
    .all(klant) as { platform: string; c: number }[];

  const genPrev = db
    .prepare(
      `SELECT platform, COUNT(*) as c
       FROM content_posts
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-14 days')
         AND datetime(created_at) < datetime('now', '-7 days')
       GROUP BY platform`
    )
    .all(klant) as { platform: string; c: number }[];

  const prevMap = new Map(genPrev.map((r) => [r.platform, r.c]));
  const generations_by_channel = genThis.map((r) => {
    const prev = prevMap.get(r.platform) ?? 0;
    return {
      platform: r.platform,
      this_week: r.c,
      prev_week: prev,
      wow_pct: pctWow(r.c, prev),
    };
  });

  const genTotalThisWeek = genThis.reduce((s, r) => s + r.c, 0);

  const tokensRows = db
    .prepare(
      `SELECT
        COALESCE(model, 'unknown') as model,
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as tokens,
        SUM(COALESCE(cost_eur, 0)) as eur,
        COUNT(*) as calls
       FROM usage_logs
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-7 days')
       GROUP BY model
       ORDER BY eur DESC`
    )
    .all(klant) as {
    model: string;
    tokens: number;
    eur: number;
    calls: number;
  }[];

  const eur_sparkline = db
    .prepare(
      `SELECT date(created_at) as dag, SUM(COALESCE(cost_eur, 0)) as eur
       FROM usage_logs
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-14 days')
       GROUP BY dag
       ORDER BY dag ASC`
    )
    .all(klant) as { dag: string; eur: number }[];

  const analystThis = db
    .prepare(
      `SELECT
        AVG(brand_score) as brand_avg,
        AVG(compliance_score) as compliance_avg,
        COUNT(*) as n
       FROM content_posts
       WHERE klant = ?
         AND brand_score IS NOT NULL
         AND compliance_score IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get(klant) as {
    brand_avg: number | null;
    compliance_avg: number | null;
    n: number;
  };

  const analystPrev = db
    .prepare(
      `SELECT
        AVG(brand_score) as brand_avg,
        AVG(compliance_score) as compliance_avg
       FROM content_posts
       WHERE klant = ?
         AND brand_score IS NOT NULL
         AND compliance_score IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-14 days')
         AND datetime(created_at) < datetime('now', '-7 days')`
    )
    .get(klant) as {
    brand_avg: number | null;
    compliance_avg: number | null;
  };

  const usageWeek = db
    .prepare(
      `SELECT
        COUNT(*) as calls,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fails
       FROM usage_logs
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get(klant) as { calls: number; fails: number };

  const calls = Number(usageWeek.calls) || 0;
  const fails = Number(usageWeek.fails) || 0;
  const error_ratio = calls > 0 ? Math.round((fails / calls) * 1000) / 1000 : 0;

  const agent_latency = db
    .prepare(
      `SELECT
        COALESCE(agent_label, '—') as agent_label,
        AVG(duration_ms) as avg_ms,
        COUNT(*) as calls,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fails
       FROM usage_logs
       WHERE klant = ?
         AND datetime(created_at) >= datetime('now', '-7 days')
         AND agent_label IS NOT NULL
       GROUP BY agent_label
       ORDER BY calls DESC`
    )
    .all(klant) as {
    agent_label: string;
    avg_ms: number | null;
    calls: number;
    fails: number;
  }[];

  const automationWeek = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as ok,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM automation_runs
       WHERE datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get() as { total: number; ok: number; failed: number };

  const autoTotal = Number(automationWeek.total) || 0;
  const autoOk = Number(automationWeek.ok) || 0;
  const automation_success_ratio =
    autoTotal > 0 ? Math.round((autoOk / autoTotal) * 1000) / 1000 : null;

  const time_saved_hours_estimate =
    Math.round(((genTotalThisWeek * TIME_SAVED_MIN_PER_GENERATION) / 60) * 10) / 10;

  return NextResponse.json({
    klant,
    generations_by_channel,
    generations_total_this_week: genTotalThisWeek,
    tokens_by_model: tokensRows.map((r) => ({
      model: r.model,
      tokens: Math.round(Number(r.tokens) || 0),
      eur: Math.round((Number(r.eur) || 0) * 10000) / 10000,
      calls: r.calls,
    })),
    eur_sparkline: eur_sparkline.map((r) => ({
      date: r.dag,
      eur: Math.round((Number(r.eur) || 0) * 10000) / 10000,
    })),
    analyst: {
      brand_avg:
        analystThis.brand_avg != null
          ? Math.round(Number(analystThis.brand_avg) * 10) / 10
          : null,
      compliance_avg:
        analystThis.compliance_avg != null
          ? Math.round(Number(analystThis.compliance_avg) * 10) / 10
          : null,
      brand_prev:
        analystPrev?.brand_avg != null
          ? Math.round(Number(analystPrev.brand_avg) * 10) / 10
          : null,
      compliance_prev:
        analystPrev?.compliance_avg != null
          ? Math.round(Number(analystPrev.compliance_avg) * 10) / 10
          : null,
      scored_posts: Number(analystThis.n) || 0,
    },
    usage_health: {
      calls,
      fails,
      error_ratio,
    },
    agent_latency: agent_latency.map((r) => ({
      agent_label: r.agent_label,
      avg_ms: r.avg_ms != null ? Math.round(Number(r.avg_ms)) : null,
      calls: r.calls,
      fail_ratio:
        r.calls > 0
          ? Math.round((Number(r.fails) / r.calls) * 1000) / 1000
          : 0,
    })),
    automation_week: {
      total_runs: autoTotal,
      success_ratio: automation_success_ratio,
      note: "Alle klanten — automation_runs heeft geen klant-kolom.",
    },
    time_saved: {
      hours_estimate: time_saved_hours_estimate,
      formula: `${TIME_SAVED_MIN_PER_GENERATION} minuten per nieuwe contentregel (alle kanalen), deze week.`,
    },
  });
}
