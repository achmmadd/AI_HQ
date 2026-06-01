import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  createAutomationRun,
  getAutomationTask,
} from "@/lib/automation";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { runFumeroAutomationTask } from "@/lib/fumero/run-automation";

export const runtime = "nodejs";

const FUMERO_TASK_KEYS = new Set([
  "fumero_orders_daily",
  "send_invoice_emails",
  "social_schedule_weekly",
  "analytics_report_weekly",
  "vendor_check_weekly",
  "fumero_max_briefing",
  "fumero_max_research",
  "fumero_kennisbank_refresh",
]);

function isFumeroTask(taskKey: string): boolean {
  return FUMERO_TASK_KEYS.has(taskKey);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    task_id?: number;
    enabled?: boolean;
    schedule_time?: string;
    schedule_kind?: "daily" | "weekly";
    schedule_weekday?: number | null;
  };

  const taskId =
    typeof body.task_id === "number"
      ? body.task_id
      : parseInt(String(body.task_id), 10);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const task = getAutomationTask(taskId);
  if (!task || !isFumeroTask(task.task_key)) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const updates: string[] = ["updated_at = datetime('now')"];
  const values: Array<string | number | null> = [];
  if (typeof body.enabled === "boolean") {
    updates.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }
  if (
    typeof body.schedule_time === "string" &&
    /^\d{1,2}:\d{2}$/.test(body.schedule_time)
  ) {
    updates.push("schedule_time = ?");
    values.push(body.schedule_time);
  }
  if (body.schedule_kind === "daily" || body.schedule_kind === "weekly") {
    updates.push("schedule_kind = ?");
    values.push(body.schedule_kind);
  }
  if (
    body.schedule_weekday === null ||
    (typeof body.schedule_weekday === "number" &&
      body.schedule_weekday >= 0 &&
      body.schedule_weekday <= 6)
  ) {
    updates.push("schedule_weekday = ?");
    values.push(body.schedule_weekday ?? null);
  }
  if (updates.length <= 1) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  values.push(taskId);
  db.prepare(`UPDATE automation_tasks SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values
  );
  const nextTask = getAutomationTask(taskId);
  return NextResponse.json({ task: nextTask });
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    task_id?: number;
  };
  const taskId =
    typeof body.task_id === "number"
      ? body.task_id
      : parseInt(String(body.task_id), 10);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const task = getAutomationTask(taskId);
  if (!task || !isFumeroTask(task.task_key) || !task.enabled) {
    return NextResponse.json(
      { error: "task not found or disabled" },
      { status: 404 }
    );
  }

  const runId = createAutomationRun(task.id, "manual", "queued");
  db.prepare(
    `UPDATE automation_runs SET status = 'running', started_at = datetime('now') WHERE id = ?`
  ).run(runId);

  const { ok, detail } = await runFumeroAutomationTask(task);
  db.prepare(
    `UPDATE automation_runs SET status = ?, detail = ?, finished_at = datetime('now') WHERE id = ?`
  ).run(ok ? "success" : "failed", detail, runId);

  const run = db
    .prepare(
      `SELECT r.id, r.task_id, r.status, r.trigger, r.detail, r.error_message,
              r.created_at, r.started_at, r.finished_at, t.task_key, t.title
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE r.id = ?`
    )
    .get(runId);

  return NextResponse.json({ run });
}
