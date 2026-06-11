import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getFumeroIntegrationReadiness } from "@/lib/fumero/integration-readiness";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const limitRaw = Number(params.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 50;

  const rows = db
    .prepare(
      `SELECT id, external_id, order_date, total_cents, currency, customer_hint, raw_summary, scraped_at
       FROM fumero_orders
       ORDER BY datetime(order_date) DESC, id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    external_id: string;
    order_date: string;
    total_cents: number;
    currency: string | null;
    customer_hint: string | null;
    raw_summary: string | null;
    scraped_at: string;
  }>;

  const total = rows.reduce((sum, r) => sum + (Number(r.total_cents) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => r.order_date.slice(0, 10) === today).length;

  const lastRun = db
    .prepare(
      `SELECT r.status, r.finished_at, r.detail, r.error_message
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE t.task_key = 'fumero_orders_daily'
       ORDER BY r.id DESC
       LIMIT 1`
    )
    .get() as
    | {
        status: string;
        finished_at: string | null;
        detail: string | null;
        error_message: string | null;
      }
    | undefined;

  const lastScraped = db
    .prepare(`SELECT MAX(scraped_at) AS last_scraped FROM fumero_orders`)
    .get() as { last_scraped: string | null } | undefined;

  const adminReady = getFumeroIntegrationReadiness().checks.find(
    (c) => c.id === "fumero_admin"
  )?.configured;

  let sync_state: "ok" | "empty" | "never_synced" | "config_missing" | "sync_failed" =
    "empty";
  if (!adminReady) {
    sync_state = "config_missing";
  } else if (lastRun?.status === "failed") {
    sync_state = "sync_failed";
  } else if (rows.length === 0 && !lastRun) {
    sync_state = "never_synced";
  } else if (rows.length === 0) {
    sync_state = "empty";
  } else {
    sync_state = "ok";
  }

  return NextResponse.json({
    orders: rows,
    stats: {
      count: rows.length,
      total_cents: total,
      today_count: todayCount,
    },
    sync: {
      state: sync_state,
      configured: Boolean(adminReady),
      last_success_at:
        lastRun?.status === "success" ? lastRun.finished_at : null,
      last_scraped_at: lastScraped?.last_scraped ?? null,
      last_status: lastRun?.status ?? null,
      last_error:
        lastRun?.status === "failed"
          ? lastRun.error_message || lastRun.detail
          : null,
    },
  });
}
