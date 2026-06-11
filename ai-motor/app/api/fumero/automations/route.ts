import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
import { getFumeroIntegrationReadiness } from "@/lib/fumero/integration-readiness";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    await ensureFumeroSchemaAsync();

    const keys = Array.from(FUMERO_TASK_KEYS);
    const placeholders = keys.map(() => "?").join(",");
    const limitRaw = new URL(req.url).searchParams.get("limit");
    const limit = Math.min(80, Math.max(1, parseInt(limitRaw ?? "40", 10) || 40));

    const tasks = db
      .prepare(
        `SELECT id, task_key, title, description, schedule_kind, schedule_time,
                schedule_weekday, enabled, approval_required, integration,
                created_at, updated_at
         FROM automation_tasks
         WHERE task_key IN (${placeholders})
         ORDER BY enabled DESC, title ASC`
      )
      .all(...keys);

    const runs = db
      .prepare(
        `SELECT r.id, r.task_id, r.status, r.trigger, r.detail, r.error_message,
                r.created_at, r.finished_at, t.title AS task_title, t.task_key
         FROM automation_runs r
         JOIN automation_tasks t ON t.id = r.task_id
         WHERE t.task_key IN (${placeholders})
         ORDER BY r.id DESC
         LIMIT ?`
      )
      .all(...keys, limit);

    const flows = db
      .prepare(
        `SELECT id, title, trigger_text, tone, steps_json, status, source_prompt,
                created_at, updated_at
         FROM fumero_email_flows
         ORDER BY id DESC
         LIMIT 40`
      )
      .all();

    const flowStats = {
      total: (flows as unknown[]).length,
      live: (flows as Array<{ status: string }>).filter((f) => f.status === "live")
        .length,
      draft: (flows as Array<{ status: string }>).filter((f) => f.status === "draft")
        .length,
    };

    return NextResponse.json({
      tasks,
      runs,
      flows,
      flow_stats: flowStats,
      integration_readiness: getFumeroIntegrationReadiness(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[fumero/automations]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
