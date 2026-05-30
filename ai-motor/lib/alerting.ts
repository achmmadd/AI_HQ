import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

const ALERT_COOLDOWN_MINUTES = 15;

type AlertRow = {
  last_alert_at: string;
};

function mayAlert(service: string): boolean {
  const row = db
    .prepare(
      `SELECT last_alert_at
       FROM health_alert_state
       WHERE service = ?`
    )
    .get(service) as AlertRow | undefined;

  if (!row) return true;

  const lastMs = Date.parse(`${row.last_alert_at}Z`);
  if (!Number.isFinite(lastMs)) return true;

  return Date.now() - lastMs >= ALERT_COOLDOWN_MINUTES * 60_000;
}

function recordAlert(service: string): void {
  db.prepare(
    `INSERT INTO health_alert_state (service, last_alert_at, last_status)
     VALUES (?, datetime('now'), 'down')
     ON CONFLICT(service) DO UPDATE SET
       last_alert_at = excluded.last_alert_at,
       last_status = excluded.last_status`
  ).run(service);
}

export async function sendAlert(message: string): Promise<void> {
  await sendTelegramMessage(message);
}

export async function sendServiceDownAlert(service: string, detail?: string): Promise<boolean> {
  const normalized = service.trim().toLowerCase();
  if (!normalized || !mayAlert(normalized)) return false;

  const suffix = detail?.trim() ? `\nDetail: ${detail.trim().slice(0, 500)}` : "";
  await sendAlert(`Motor AI waarschuwing: ${normalized} is offline.${suffix}`);
  recordAlert(normalized);
  return true;
}
