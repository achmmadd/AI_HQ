import db from "@/lib/db/database";

let migrated = false;

/** Migratie shim (database.ts is root-owned). */
export function ensureBuildProjectsTable(): void {
  if (migrated) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS build_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      klant TEXT NOT NULL DEFAULT 'system',
      spec_json TEXT NOT NULL,
      files_json TEXT NOT NULL,
      conversation_id INTEGER REFERENCES conversations(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_build_projects_klant ON build_projects(klant);
    CREATE INDEX IF NOT EXISTS idx_build_projects_slug ON build_projects(slug);
  `);
  migrated = true;
}
