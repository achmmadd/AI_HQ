import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";

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

  return NextResponse.json({
    orders: rows,
    stats: {
      count: rows.length,
      total_cents: total,
      today_count: todayCount,
    },
  });
}
