import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  createAutomationRun,
  getAutomationTaskByKey,
} from "@/lib/automation";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { runFumeroAutomationTask } from "@/lib/fumero/run-automation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const task = getAutomationTaskByKey("fumero_orders_daily");
  if (!task) {
    return NextResponse.json(
      { error: "automation task fumero_orders_daily niet gevonden" },
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
      `SELECT id, status, detail, error_message, created_at, finished_at
       FROM automation_runs WHERE id = ?`
    )
    .get(runId);

  return NextResponse.json({ ok, detail: ok ? true : false, run });
}
