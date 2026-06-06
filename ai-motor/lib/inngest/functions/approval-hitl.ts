/**
 * HITL approval workflow — durable wait for human decision (Sprint 2.2).
 * Integrates with SQLite `approvals` + cowork inbox; emits reminders on timeout.
 */

import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  type ApprovalDecidedData,
  type ApprovalRequestedData,
} from "@/lib/inngest/events";

const DEFAULT_TIMEOUT_HOURS = Number(
  process.env.INNGEST_APPROVAL_TIMEOUT_HOURS || "24"
);

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3040"
  );
}

/** Durable HITL: wait for `motor/approval.decided` or remind on timeout. */
export const approvalHitlWorkflow = inngest.createFunction(
  {
    id: "approval-hitl",
    name: "Motor HITL approval",
    retries: 2,
  },
  { event: INNGEST_EVENTS.approvalRequested },
  async ({ event, step }) => {
    const data = event.data as ApprovalRequestedData;
    const approvalId = Number(data.approvalId);
    const timeoutHours = data.timeoutHours ?? DEFAULT_TIMEOUT_HOURS;

    if (!Number.isFinite(approvalId) || approvalId <= 0) {
      return { status: "invalid", reason: "missing approvalId" };
    }

    const row = await step.run("load-approval", async () => {
      return db
        .prepare(
          `SELECT id, title, status, action FROM approvals WHERE id = ? LIMIT 1`
        )
        .get(approvalId) as
        | { id: number; title: string; status: string; action: string }
        | undefined;
    });

    if (!row) {
      return { status: "not_found", approvalId };
    }

    if (row.status !== "pending") {
      return { status: row.status, approvalId, alreadyResolved: true };
    }

    const decision = await step.waitForEvent("wait-for-human-decision", {
      event: INNGEST_EVENTS.approvalDecided,
      timeout: `${timeoutHours}h`,
      if: `async.data.approvalId == ${approvalId}`,
    });

    if (decision) {
      const decided = decision.data as ApprovalDecidedData;
      return {
        status: decided.status,
        approvalId,
        decidedBy: decided.decidedBy ?? null,
      };
    }

    await step.run("timeout-reminder", async () => {
      const appUrl = baseUrl();
      void sendTelegramMessage(
        `⏰ Goedkeuring #${approvalId} wacht nog (${timeoutHours}u)\n\n${row.title}\n\nOpen: ${appUrl}/cowork?tab=approvals`
      );
      return { reminded: true };
    });

    await step.sendEvent("schedule-reminder-event", {
      name: INNGEST_EVENTS.approvalReminder,
      data: { approvalId, title: row.title, timeoutHours },
    });

    return { status: "timeout", approvalId, timeoutHours };
  }
);
