import type { AutomationTaskRow } from "@/lib/automation";
import { executeAutomationTask } from "@/lib/automation";
import { executeAutomationTaskExtended } from "@/lib/automation-execute";

export async function runFumeroAutomationTask(
  task: AutomationTaskRow
): Promise<{ ok: boolean; detail: string }> {
  const base = await executeAutomationTask(task);
  if (base.ok || !base.detail.includes("Onbekende task_key")) {
    return base;
  }
  return executeAutomationTaskExtended(task);
}
