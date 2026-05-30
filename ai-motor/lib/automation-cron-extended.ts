import db from "@/lib/db/database";
import {
  createAutomationRun,
  hasCronRunOnDate,
  isScheduleDue,
  type AutomationTaskRow,
  type CronTickResult,
} from "@/lib/automation";
import { processAutomationRunExtended } from "@/lib/automation-runner";
import { sendTelegramMessage } from "@/lib/telegram";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/** Cron tick met extended executor (Max briefing/research + school). */
export async function runAutomationCronTickExtended(
  now: Date
): Promise<CronTickResult> {
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
        await processAutomationRunExtended(runId);
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
