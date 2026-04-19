import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export async function runAnalyticsReportWeekly(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const usageWeek = db
    .prepare(
      `SELECT COUNT(*) as c FROM usage_logs
       WHERE created_at >= datetime('now', '-7 days')`
    )
    .get() as { c: number };

  const chatWeek = db
    .prepare(
      `SELECT COUNT(*) as c FROM chat_history
       WHERE created_at >= datetime('now', '-7 days')`
    )
    .get() as { c: number };

  const tokens = db
    .prepare(
      `SELECT
         COALESCE(SUM(prompt_tokens), 0) AS p,
         COALESCE(SUM(completion_tokens), 0) AS comp,
         COALESCE(SUM(cost_usd), 0) AS cost
       FROM usage_logs
       WHERE created_at >= datetime('now', '-7 days')`
    )
    .get() as { p: number; comp: number; cost: number };

  const byKlant = db
    .prepare(
      `SELECT klant, COUNT(*) as n
       FROM chat_history
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY klant
       ORDER BY n DESC
       LIMIT 8`
    )
    .all() as { klant: string; n: number }[];

  const ordersToday = db
    .prepare(
      `SELECT COUNT(*) as c FROM fumero_orders
       WHERE date(scraped_at) >= date('now', '-7 days')`
    )
    .get() as { c: number };

  const invLow = db
    .prepare(
      `SELECT COUNT(*) as c FROM inventory WHERE qty < low_stock_threshold`
    )
    .get() as { c: number };

  const klantLine = byKlant
    .map((r) => `${r.klant ?? "?"}:${r.n}`)
    .join(", ");

  const detail =
    `Weekrapport (7d): usage_rows=${usageWeek.c}, chat_berichten=${chatWeek.c}, ` +
    `prompt_tokens=${tokens.p}, completion_tokens=${tokens.comp}, cost_usd≈${tokens.cost.toFixed(4)}, ` +
    `fumero_orders_scrapes(7d)=${ordersToday.c}, lage_voorraad=${invLow.c}. ` +
    `Chat per klant: ${klantLine || "—"}.`;

  void sendTelegramMessage(`📊 ${detail}`);

  return { ok: true, detail };
}
