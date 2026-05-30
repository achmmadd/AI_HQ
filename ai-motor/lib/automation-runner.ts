import db from "@/lib/db/database";
import { executeAutomationTaskExtended } from "@/lib/automation-execute";
import type { AutomationRunRow, AutomationTaskRow } from "@/lib/automation";
import { getAutomationTask } from "@/lib/automation";

/** Zelfde als processAutomationRun maar met school-taken (executeAutomationTaskExtended). */
export async function processAutomationRunExtended(
  runId: number
): Promise<void> {
  const run = db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRunRow | undefined;
  if (!run || run.status !== "queued") return;

  const task = getAutomationTask(run.task_id);
  if (!task) {
    db.prepare(
      `UPDATE automation_runs SET status = 'failed', error_message = ?, finished_at = datetime('now')
       WHERE id = ?`
    ).run("Task niet gevonden", runId);
    return;
  }

  db.prepare(
    `UPDATE automation_runs SET status = 'running', started_at = datetime('now') WHERE id = ?`
  ).run(runId);

  try {
    const { ok, detail } = await executeAutomationTaskExtended(task);
    if (ok) {
      db.prepare(
        `UPDATE automation_runs SET status = 'success', detail = ?, finished_at = datetime('now')
         WHERE id = ?`
      ).run(detail, runId);
    } else {
      db.prepare(
        `UPDATE automation_runs SET status = 'failed', detail = ?, finished_at = datetime('now')
         WHERE id = ?`
      ).run(detail, runId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.prepare(
      `UPDATE automation_runs SET status = 'failed', error_message = ?, finished_at = datetime('now')
       WHERE id = ?`
    ).run(msg, runId);
  }
}

const SCHOOL_KEYS = new Set([
  "motor_school_lesson_daily",
  "motor_school_exam_weekly",
]);

export function isSchoolAutomationTask(task: AutomationTaskRow): boolean {
  return SCHOOL_KEYS.has(task.task_key);
}

export async function approveAutomationRunExtended(
  runId: number
): Promise<boolean> {
  const run = db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRunRow | undefined;
  if (!run || run.status !== "pending_approval") return false;

  const task = getAutomationTask(run.task_id);
  if (!task) return false;

  if (!isSchoolAutomationTask(task)) {
    const { approveAutomationRun } = await import("@/lib/automation");
    return approveAutomationRun(runId);
  }

  db.prepare(
    `UPDATE automation_runs SET status = 'queued', approved_at = datetime('now') WHERE id = ?`
  ).run(runId);
  await processAutomationRunExtended(runId);
  return true;
}
