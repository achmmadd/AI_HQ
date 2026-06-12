import db from "@/lib/db/database";

let done = false;

export function ensureCampaignSchema(): void {
  if (done) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS fumero_campaign_packs (
      id TEXT PRIMARY KEY,
      klant TEXT NOT NULL DEFAULT 'fumero',
      status TEXT NOT NULL DEFAULT 'draft',
      data_json TEXT NOT NULL,
      zip_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_fumero_campaign_packs_updated
      ON fumero_campaign_packs(klant, updated_at DESC);
  `);
  done = true;
}
