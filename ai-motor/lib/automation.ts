import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";
import { runFumeroOrdersDaily } from "@/lib/automation/run-fumero-orders";
import { runInvoiceEmails } from "@/lib/automation/run-invoice-emails";
import { runInventoryUpdate } from "@/lib/automation/run-inventory";
import { runVendorCheckWeekly } from "@/lib/automation/run-vendor-check";
import { runSocialScheduleWeekly } from "@/lib/automation/run-social-weekly";
import { runAnalyticsReportWeekly } from "@/lib/automation/run-analytics-weekly";

export type AutomationTaskRow = {
  id: number;
  task_key: string;
  title: string;
  description: string | null;
  schedule_kind: string;
  schedule_time: string;
  schedule_weekday: number | null;
  enabled: number;
  approval_required: number;
  integration: string | null;
  config_json: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationRunRow = {
  id: number;
  task_id: number;
  status: string;
  trigger: string;
  detail: string | null;
  error_message: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True if `now` falls in [schedule_time, schedule_time + windowMinutes). */
export function isScheduleDue(
  task: AutomationTaskRow,
  now: Date,
  windowMinutes = 20
): boolean {
  const parts = task.schedule_time.split(":");
  const th = parseInt(parts[0] ?? "", 10);
  const tm = parseInt(parts[1] ?? "", 10);
  if (Number.isNaN(th) || Number.isNaN(tm)) return false;

  if (task.schedule_kind === "weekly") {
    const wd = task.schedule_weekday;
    if (wd == null || now.getDay() !== wd) return false;
  }

  const cur = now.getHours() * 60 + now.getMinutes();
  const target = th * 60 + tm;
  return cur >= target && cur < target + windowMinutes;
}

export function hasCronRunOnDate(taskId: number, dateKey: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 as x FROM automation_runs
       WHERE task_id = ? AND trigger = 'cron'
         AND date(created_at) = date(?)
       LIMIT 1`
    )
    .get(taskId, dateKey) as { x: number } | undefined;
  return !!row;
}

async function notifyAutomationChannels(text: string): Promise<void> {
  void sendTelegramMessage(text);
  const url = process.env.AUTOMATION_SLACK_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    /* optional */
  }
}

/** Uitvoer per task_key — Playwright / SMTP / Qdrant / Dify / n8n. */
export async function executeAutomationTask(
  task: AutomationTaskRow
): Promise<{ ok: boolean; detail: string }> {
  switch (task.task_key) {
    case "fumero_orders_daily":
      return runFumeroOrdersDaily();
    case "send_invoice_emails":
      return runInvoiceEmails();
    case "update_inventory":
      return runInventoryUpdate();
    case "vendor_check_weekly":
      return runVendorCheckWeekly();
    case "social_schedule_weekly":
      return runSocialScheduleWeekly();
    case "analytics_report_weekly":
      return runAnalyticsReportWeekly();
    default:
      return { ok: false, detail: `Onbekende task_key: ${task.task_key}` };
  }
}

export function getAutomationTask(id: number): AutomationTaskRow | undefined {
  return db
    .prepare("SELECT * FROM automation_tasks WHERE id = ?")
    .get(id) as AutomationTaskRow | undefined;
}

export function createAutomationRun(
  taskId: number,
  trigger: "cron" | "manual",
  initialStatus: "pending_approval" | "queued"
): number {
  const r = db
    .prepare(
      `INSERT INTO automation_runs (task_id, status, trigger)
       VALUES (?,?,?)`
    )
    .run(taskId, initialStatus, trigger);
  return Number(r.lastInsertRowid);
}

export async function processAutomationRun(runId: number): Promise<void> {
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
    const { ok, detail } = await executeAutomationTask(task);
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

export async function approveAutomationRun(runId: number): Promise<boolean> {
  const run = db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRunRow | undefined;
  if (!run || run.status !== "pending_approval") return false;

  db.prepare(
    `UPDATE automation_runs SET status = 'queued', approved_at = datetime('now') WHERE id = ?`
  ).run(runId);

  await processAutomationRun(runId);
  return true;
}

export function rejectAutomationRun(runId: number): boolean {
  const run = db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRunRow | undefined;
  if (!run || run.status !== "pending_approval") return false;

  db.prepare(
    `UPDATE automation_runs SET status = 'rejected', rejected_at = datetime('now') WHERE id = ?`
  ).run(runId);
  return true;
}

export type CronTickResult = {
  day_key: string;
  created: number[];
  skipped: string[];
  errors: string[];
};

export async function runAutomationCronTick(now: Date): Promise<CronTickResult> {
  const dayKey = localDateKey(now);
  const tasks = db
    .prepare("SELECT * FROM automation_tasks WHERE enabled = 1")
    .all() as AutomationTaskRow[];

  const created: number[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const task of tasks) {
    if (!isScheduleDue(task, now)) {
      skipped.push(`${task.task_key}: not due`);
      continue;
    }
    if (hasCronRunOnDate(task.id, dayKey)) {
      skipped.push(`${task.task_key}: already ran today`);
      continue;
    }

    try {
      const needApproval = task.approval_required === 1;
      const status = needApproval ? "pending_approval" : "queued";
      const runId = createAutomationRun(task.id, "cron", status);

      if (needApproval) {
        await notifyAutomationChannels(
          `Automation wacht op goedkeuring: ${task.title} (#${runId})\nOpen: /admin/automation`
        );
      } else {
        await processAutomationRun(runId);
      }
      created.push(runId);
    } catch (e) {
      errors.push(
        `${task.task_key}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { day_key: dayKey, created, skipped, errors };
}
