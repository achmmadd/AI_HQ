import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  createAutomationRun,
  getAutomationTask,
  processAutomationRun,
} from "@/lib/automation";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(limitRaw ?? "50", 10) || 50)
  );

  const runs = db
    .prepare(
      `SELECT r.id, r.task_id, r.status, r.trigger, r.detail, r.error_message,
              r.approved_at, r.rejected_at, r.started_at, r.finished_at, r.created_at,
              t.title AS task_title, t.task_key
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       ORDER BY r.id DESC
       LIMIT ?`
    )
    .all(limit);

  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const taskIdRaw = (body as { task_id?: number }).task_id;
  const taskId =
    typeof taskIdRaw === "number"
      ? taskIdRaw
      : parseInt(String(taskIdRaw), 10);

  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const task = getAutomationTask(taskId);
  if (!task || !task.enabled) {
    return NextResponse.json({ error: "task not found or disabled" }, { status: 404 });
  }

  const needApproval = task.approval_required === 1;
  const status = needApproval ? "pending_approval" : "queued";
  const runId = createAutomationRun(taskId, "manual", status);

  if (needApproval) {
    void sendTelegramMessage(
      `Handmatige automation wacht op goedkeuring: ${task.title} (#${runId})\n/admin/automation`
    );
  } else {
    await processAutomationRun(runId);
  }

  const run = db
    .prepare(
      `SELECT r.*, t.title AS task_title, t.task_key
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE r.id = ?`
    )
    .get(runId);

  return NextResponse.json({ run });
}
