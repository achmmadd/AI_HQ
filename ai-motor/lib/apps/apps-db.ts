import db from "@/lib/db/database";

export type AppRow = {
  id: number;
  slug: string;
  naam: string;
  type: "widget" | "internal" | "customer";
  frontend_code: string | null;
  backend_routes: string | null; // JSON
  db_schema: string | null; // JSON
  auth_required: number;
  version: number;
  status: "concept" | "published" | "archived";
  klant: string;
  created_at: string;
  updated_at: string;
};

export type AppDataRow = {
  id: number;
  app_slug: string;
  table_name: string;
  row_json: string;
  klant: string;
  created_at: string;
  updated_at: string;
};

let schemaReady = false;

export function ensureAppsSchema(): void {
  if (schemaReady) return;
  schemaReady = true;

  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      naam TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'widget' CHECK (type IN ('widget', 'internal', 'customer')),
      frontend_code TEXT,
      backend_routes TEXT,
      db_schema TEXT,
      auth_required INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'concept' CHECK (status IN ('concept', 'published', 'archived')),
      klant TEXT NOT NULL DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (klant, slug)
    );

    CREATE TABLE IF NOT EXISTS app_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_slug TEXT NOT NULL,
      table_name TEXT NOT NULL,
      row_json TEXT NOT NULL,
      klant TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_apps_klant_slug ON apps (klant, slug);
    CREATE INDEX IF NOT EXISTS idx_app_data_scope ON app_data (klant, app_slug, table_name);
  `);
}

/** Returns a published app by slug (any klant for Fase 3 reachability; prefers first match). */
export function getPublishedApp(slug: string): AppRow | undefined {
  ensureAppsSchema();
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  return db
    .prepare(
      `SELECT * FROM apps WHERE slug = ? AND status = 'published' LIMIT 1`
    )
    .get(safe) as AppRow | undefined;
}

/** Fase 5: list non-archived apps for a klant (for garage + chat edit flows). */
export function listAppsForKlant(klant: string): AppRow[] {
  ensureAppsSchema();
  return db
    .prepare(
      `SELECT * FROM apps WHERE klant = ? AND status != 'archived' ORDER BY updated_at DESC`
    )
    .all(klant) as AppRow[];
}

/** Fase 5: get full app row scoped to klant. */
export function getAppBySlug(slug: string, klant: string): AppRow | undefined {
  ensureAppsSchema();
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  return db
    .prepare(`SELECT * FROM apps WHERE klant = ? AND slug = ? LIMIT 1`)
    .get(klant, safe) as AppRow | undefined;
}

/** Fase 5: real count of stored rows in app_data for this app+klant (for garage "X rijen"). */
export function countAppDataRows(slug: string, klant: string): number {
  ensureAppsSchema();
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM app_data WHERE app_slug = ? AND klant = ?`
    )
    .get(safe, klant) as { c: number } | undefined;
  return row?.c ?? 0;
}

/** Fase 5: fetch rows for "Bekijk data" (read-only, optional filter by table). */
export function getAppDataRows(
  slug: string,
  klant: string,
  tableName?: string
): AppDataRow[] {
  ensureAppsSchema();
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  let sql = `SELECT * FROM app_data WHERE app_slug = ? AND klant = ?`;
  const params: any[] = [safe, klant];
  if (tableName) {
    sql += ` AND table_name = ?`;
    params.push(tableName.trim());
  }
  sql += ` ORDER BY id DESC LIMIT 200`;
  return db.prepare(sql).all(...params) as AppDataRow[];
}
