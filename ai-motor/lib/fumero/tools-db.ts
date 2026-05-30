import db from "@/lib/db/database";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";

export type FumeroToolRow = {
  id: number;
  name: string;
  slug: string;
  deploy_type: FumeroDeployType;
  template_id: string | null;
  archived: number;
  klant: string;
  created_at: string;
  updated_at: string;
};

export type FumeroToolVersionRow = {
  id: number;
  tool_id: number;
  version: number;
  code: string;
  prompt: string | null;
  status: "concept" | "published" | "archived";
  stats_views: number;
  stats_interactions: number;
  published_at: string | null;
  created_at: string;
};

let schemaReady = false;

export function ensureFumeroToolsSchema(): void {
  if (schemaReady) return;
  schemaReady = true;

  db.exec(`
    CREATE TABLE IF NOT EXISTS fumero_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      deploy_type TEXT NOT NULL DEFAULT 'widget',
      template_id TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      klant TEXT NOT NULL DEFAULT 'fumero',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fumero_tool_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      code TEXT NOT NULL,
      prompt TEXT,
      status TEXT NOT NULL DEFAULT 'concept',
      stats_views INTEGER NOT NULL DEFAULT 0,
      stats_interactions INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tool_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_fumero_tool_versions_tool
      ON fumero_tool_versions(tool_id);
  `);

  migrateLegacyCustomApps();
}

function migrateLegacyCustomApps() {
  const legacy = db
    .prepare(
      `SELECT id, naam, slug, code, status, created_at
       FROM custom_apps WHERE klant = 'fumero'`
    )
    .all() as Array<{
    id: number;
    naam: string;
    slug: string;
    code: string;
    status: string;
    created_at: string;
  }>;

  for (const row of legacy) {
    const exists = db
      .prepare(`SELECT 1 FROM fumero_tools WHERE slug = ?`)
      .get(row.slug);
    if (exists) continue;

    const ins = db
      .prepare(
        `INSERT INTO fumero_tools (name, slug, deploy_type, template_id, archived, klant, created_at, updated_at)
         VALUES (?, ?, 'widget', 'chat', 0, 'fumero', ?, ?)`
      )
      .run(row.naam, row.slug, row.created_at, row.created_at);
    const toolId = Number(ins.lastInsertRowid);
    const verStatus = row.status === "live" ? "published" : "concept";
    db.prepare(
      `INSERT INTO fumero_tool_versions (tool_id, version, code, prompt, status, published_at, created_at)
       VALUES (?, 1, ?, '', ?, CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END, ?)`
    ).run(toolId, row.code, verStatus, verStatus, row.created_at);
  }
}

export function slugifyToolName(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "tool"}-${suffix}`;
}

export function getToolById(id: number): FumeroToolRow | undefined {
  ensureFumeroToolsSchema();
  return db.prepare(`SELECT * FROM fumero_tools WHERE id = ?`).get(id) as
    | FumeroToolRow
    | undefined;
}

export function getToolBySlug(slug: string): FumeroToolRow | undefined {
  ensureFumeroToolsSchema();
  return db.prepare(`SELECT * FROM fumero_tools WHERE slug = ?`).get(slug) as
    | FumeroToolRow
    | undefined;
}

export function listFumeroTools(includeArchived = false): FumeroToolRow[] {
  ensureFumeroToolsSchema();
  const q = includeArchived
    ? `SELECT * FROM fumero_tools WHERE klant = 'fumero' ORDER BY datetime(updated_at) DESC`
    : `SELECT * FROM fumero_tools WHERE klant = 'fumero' AND archived = 0 ORDER BY datetime(updated_at) DESC`;
  return db.prepare(q).all() as FumeroToolRow[];
}

export function listVersions(toolId: number): FumeroToolVersionRow[] {
  ensureFumeroToolsSchema();
  return db
    .prepare(
      `SELECT * FROM fumero_tool_versions WHERE tool_id = ? ORDER BY version ASC`
    )
    .all(toolId) as FumeroToolVersionRow[];
}

export function getVersion(id: number): FumeroToolVersionRow | undefined {
  ensureFumeroToolsSchema();
  return db
    .prepare(`SELECT * FROM fumero_tool_versions WHERE id = ?`)
    .get(id) as FumeroToolVersionRow | undefined;
}

export function getPublishedVersion(toolId: number): FumeroToolVersionRow | undefined {
  ensureFumeroToolsSchema();
  return db
    .prepare(
      `SELECT * FROM fumero_tool_versions
       WHERE tool_id = ? AND status = 'published'
       ORDER BY version DESC LIMIT 1`
    )
    .get(toolId) as FumeroToolVersionRow | undefined;
}

export function getConceptVersion(toolId: number): FumeroToolVersionRow | undefined {
  ensureFumeroToolsSchema();
  return db
    .prepare(
      `SELECT * FROM fumero_tool_versions
       WHERE tool_id = ? AND status = 'concept'
       ORDER BY version DESC LIMIT 1`
    )
    .get(toolId) as FumeroToolVersionRow | undefined;
}

export function nextVersionNumber(toolId: number): number {
  const row = db
    .prepare(`SELECT MAX(version) as m FROM fumero_tool_versions WHERE tool_id = ?`)
    .get(toolId) as { m: number | null };
  return Number(row.m || 0) + 1;
}

export function syncCustomAppFromPublished(tool: FumeroToolRow, ver: FumeroToolVersionRow) {
  if (tool.deploy_type !== "internal") return;
  const existing = db
    .prepare(`SELECT id FROM custom_apps WHERE slug = ?`)
    .get(tool.slug) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE custom_apps SET naam = ?, code = ?, status = 'live', klant = 'fumero' WHERE slug = ?`
    ).run(tool.name, ver.code, tool.slug);
  } else {
    db.prepare(
      `INSERT INTO custom_apps (naam, slug, code, status, klant) VALUES (?, ?, ?, 'live', 'fumero')`
    ).run(tool.name, tool.slug, ver.code);
  }
}

export function removeCustomAppSync(slug: string) {
  db.prepare(`UPDATE custom_apps SET status = 'archived' WHERE slug = ? AND klant = 'fumero'`).run(
    slug
  );
}
