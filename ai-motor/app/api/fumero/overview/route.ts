import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

const FUMERO_TASK_KEYS = [
  "fumero_orders_daily",
  "send_invoice_emails",
  "social_schedule_weekly",
  "analytics_report_weekly",
  "vendor_check_weekly",
  "fumero_max_briefing",
  "fumero_max_research",
  "fumero_kennisbank_refresh",
];

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    await ensureFumeroSchemaAsync();

    const placeholders = FUMERO_TASK_KEYS.map(() => "?").join(",");

    const postStats = db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
         FROM content_posts
         WHERE klant = 'fumero'`
      )
      .get() as {
      total: number;
      drafts: number;
      approved: number;
      published: number;
    };

    const tasks = db
      .prepare(
        `SELECT id, task_key, title, enabled, schedule_kind, schedule_time, integration
         FROM automation_tasks
         WHERE task_key IN (${placeholders})
         ORDER BY id ASC`
      )
      .all(...FUMERO_TASK_KEYS);

    const runs = db
      .prepare(
        `SELECT r.id, r.task_id, r.status, r.created_at, r.finished_at, t.task_key, t.title
         FROM automation_runs r
         JOIN automation_tasks t ON t.id = r.task_id
         WHERE t.task_key IN (${placeholders})
         ORDER BY r.id DESC
         LIMIT 20`
      )
      .all(...FUMERO_TASK_KEYS);

    return NextResponse.json({
      posts: {
        total: Number(postStats.total || 0),
        drafts: Number(postStats.drafts || 0),
        approved: Number(postStats.approved || 0),
        published: Number(postStats.published || 0),
      },
      tasks,
      runs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[fumero/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
