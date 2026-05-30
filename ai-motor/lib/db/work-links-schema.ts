import db from "@/lib/db/database";

let migrated = false;

/** Koppeling custom_apps ↔ build_projects + gebruikerscontext (shim, database.ts root-owned). */
export function ensureWorkLinksSchema(): void {
  if (migrated) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_project_links (
      app_slug TEXT PRIMARY KEY,
      build_project_id INTEGER NOT NULL,
      custom_app_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_app_project_links_project
      ON app_project_links(build_project_id);

    CREATE TABLE IF NOT EXISTS project_resume_notes (
      build_project_id INTEGER PRIMARY KEY,
      summary TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS motor_user_context (
      klant TEXT PRIMARY KEY,
      display_name TEXT,
      goals TEXT,
      preferences TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  migrated = true;
}
