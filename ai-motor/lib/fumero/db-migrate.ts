import db from "@/lib/db/database";

let migrationDone = false;
let migrationLock: Promise<void> | null = null;

function runFumeroSchemaMigration(): void {
  db.pragma("busy_timeout = 5000");

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fumero_briefings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        opportunities_json TEXT NOT NULL,
        status_json TEXT NOT NULL,
        context_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fumero_email_flows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        trigger_text TEXT,
        tone TEXT,
        steps_json TEXT NOT NULL,
        source_prompt TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        n8n_workflow_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const contentCols = db
      .prepare("PRAGMA table_info(content_posts)")
      .all() as Array<{ name: string }>;
    if (!contentCols.some((c) => c.name === "media_url")) {
      db.exec(`ALTER TABLE content_posts ADD COLUMN media_url TEXT`);
    }

    const ins = db.prepare(
      `INSERT OR IGNORE INTO automation_tasks (
        task_key, title, description, schedule_kind, schedule_time, schedule_weekday,
        enabled, approval_required, integration
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)`
    );
    ins.run(
      "fumero_max_briefing",
      "Max ochtendbriefing",
      "AI briefing voor Fumero Studio om 07:00.",
      "daily",
      "07:00",
      null,
      "openrouter"
    );
    ins.run(
      "fumero_max_research",
      "Max nachtresearch",
      "Nachtelijke research (SEO/social kansen) voor Max.",
      "daily",
      "02:00",
      null,
      "openrouter"
    );
  });

  migrate();
  migrationDone = true;
}

/** Sync — alleen op dezelfde worker; gebruik liever ensureFumeroSchemaAsync in API-routes. */
export function ensureFumeroSchema(): void {
  if (migrationDone) return;
  runFumeroSchemaMigration();
}

/** Wacht op lopende migratie (parallelle overview/marketing/briefing calls). */
export async function ensureFumeroSchemaAsync(): Promise<void> {
  if (migrationDone) return;
  if (!migrationLock) {
    migrationLock = Promise.resolve()
      .then(() => {
        if (!migrationDone) runFumeroSchemaMigration();
      })
      .finally(() => {
        migrationLock = null;
      });
  }
  await migrationLock;
}
