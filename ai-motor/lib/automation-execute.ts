import type { AutomationTaskRow } from "@/lib/automation";
import { runFumeroOrdersDaily } from "@/lib/automation/run-fumero-orders";
import { runInvoiceEmails } from "@/lib/automation/run-invoice-emails";
import { runInventoryUpdate } from "@/lib/automation/run-inventory";
import { runVendorCheckWeekly } from "@/lib/automation/run-vendor-check";
import { runSocialScheduleWeekly } from "@/lib/automation/run-social-weekly";
import { runAnalyticsReportWeekly } from "@/lib/automation/run-analytics-weekly";
import { runFumeroMaxBriefing } from "@/lib/automation/run-fumero-max-briefing";
import { runFumeroMaxResearch } from "@/lib/automation/run-fumero-max-research";
import { runFumeroKennisbankRefresh } from "@/lib/automation/run-fumero-kennisbank-refresh";
import {
  runMotorSchoolExamWeekly,
  runMotorSchoolLessonDaily,
} from "@/lib/automation/run-motor-school";

/** Uitbreidbare task-executor (school + fumero max) zonder root-owned automation.ts te patchen. */
export async function executeAutomationTaskExtended(
  task: AutomationTaskRow
): Promise<{ ok: boolean; detail: string }> {
  switch (task.task_key) {
    case "motor_school_lesson_daily":
      return runMotorSchoolLessonDaily();
    case "motor_school_exam_weekly":
      return runMotorSchoolExamWeekly();
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
    case "fumero_max_briefing":
      return runFumeroMaxBriefing();
    case "fumero_max_research":
      return runFumeroMaxResearch();
    case "fumero_kennisbank_refresh":
      return runFumeroKennisbankRefresh();
    default:
      return { ok: false, detail: `Onbekende task_key: ${task.task_key}` };
  }
}
