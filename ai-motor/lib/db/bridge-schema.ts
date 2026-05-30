import db from "@/lib/db/database";

let migrated = false;

export function ensureBridgeSchema(): void {
  if (migrated) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS pc_bridges (
      bridge_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      workspace_hint TEXT,
      last_seen_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pc_bridge_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bridge_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pc_bridge_tasks_bridge
      ON pc_bridge_tasks(bridge_id, status);
  `);
  migrated = true;
}
