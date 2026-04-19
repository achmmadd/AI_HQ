import db from "@/lib/db/database";

const RULES: [RegExp, string][] = [
  [/fumero.*order|orders.*fumero|check.*order|bestellingen.*check/i, "fumero_orders_daily"],
  [/factuur|facturen|invoice/i, "send_invoice_emails"],
  [/voorraad|inventory|stock/i, "update_inventory"],
  [/leverancier|vendor|catalogus|nieuwe producten/i, "vendor_check_weekly"],
  [/social|instagram|tiktok|content.*week/i, "social_schedule_weekly"],
  [/analytic|statistie|weekrapport|usage|rapport/i, "analytics_report_weekly"],
];

/** Valideer dat task_key in automation_tasks bestaat. */
export function isKnownTaskKey(taskKey: string): boolean {
  const row = db
    .prepare("SELECT 1 as x FROM automation_tasks WHERE task_key = ? LIMIT 1")
    .get(taskKey.trim()) as { x: number } | undefined;
  return !!row;
}

/**
 * Expliciete key heeft voorrang; anders heuristiek op natuurlijke taal.
 */
export function resolveAgentTaskKey(
  prompt: string,
  explicitKey?: string | null
): string | null {
  if (explicitKey?.trim()) {
    const k = explicitKey.trim();
    return isKnownTaskKey(k) ? k : null;
  }
  const p = prompt.trim();
  if (!p) return null;
  for (const [re, key] of RULES) {
    if (re.test(p) && isKnownTaskKey(key)) return key;
  }
  return null;
}

export function listAgentTaskKeys(): string[] {
  const rows = db
    .prepare("SELECT task_key FROM automation_tasks ORDER BY id ASC")
    .all() as { task_key: string }[];
  return rows.map((r) => r.task_key);
}
