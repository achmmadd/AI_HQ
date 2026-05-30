import type { AutomationTaskRow } from "@/lib/automation";
import { executeAutomationTaskExtended } from "@/lib/automation-execute";

export { executeAutomationTaskExtended } from "@/lib/automation-execute";

/** Stub voor dagelijkse MotorsAI stack-verbetering (OpenClaw / n8n follow-up). */
export async function executeMotorsaiImproveDaily(): Promise<{
  ok: boolean;
  detail: string;
}> {
  return {
    ok: true,
    detail:
      "Stub: motorsai_improve_daily — stack-analyse gepland. Resultaat verschijnt in Cowork audit.",
  };
}

/** Uitgebreide executor inclusief motorsai_improve_daily stub. */
export async function executeAutomationUnified(
  task: AutomationTaskRow
): Promise<{ ok: boolean; detail: string }> {
  if (task.task_key === "motorsai_improve_daily") {
    return executeMotorsaiImproveDaily();
  }
  return executeAutomationTaskExtended(task);
}
