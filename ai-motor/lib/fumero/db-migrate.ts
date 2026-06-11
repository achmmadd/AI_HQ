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

      CREATE TABLE IF NOT EXISTS command_center_task_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        klant TEXT NOT NULL DEFAULT 'fumero',
        item_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'in_behandeling', 'wacht_goedkeuring', 'afgerond', 'genegeerd')),
        actor TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cc_task_states_klant
        ON command_center_task_states(klant, updated_at DESC);
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
      "Smokey ochtendbriefing",
      "AI briefing voor Fumero Studio om 07:00.",
      "daily",
      "07:00",
      null,
      "openrouter"
    );
    ins.run(
      "fumero_max_research",
      "Smokey nachtresearch",
      "Nachtelijke research (SEO/social kansen) voor Smokey.",
      "daily",
      "02:00",
      null,
      "openrouter"
    );
    ins.run(
      "fumero_kennisbank_refresh",
      "Kennisbank refresh (shop-pagina's)",
      "Scrape vaste fumero.nl-pagina's via Jina → Qdrant collectie fumero_kennisbank. Maandag 09:00.",
      "weekly",
      "09:00",
      1,
      "jina"
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
