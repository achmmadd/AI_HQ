import db from "@/lib/db/database";
import { ensureBuildProjectsTable } from "@/lib/db/build-projects-schema";

ensureBuildProjectsTable();
import type { BuildProjectRow, ProjectFiles, ProjectSpec } from "@/lib/project-types";

export function toSlugBase(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "project"
  );
}

export function insertProject(opts: {
  title: string;
  slug: string;
  klant: string;
  spec: ProjectSpec;
  files: ProjectFiles;
  conversationId?: number | null;
}): number {
  const result = db
    .prepare(
      `INSERT INTO build_projects (title, slug, klant, spec_json, files_json, conversation_id)
       VALUES (?,?,?,?,?,?)`
    )
    .run(
      opts.title,
      opts.slug,
      opts.klant,
      JSON.stringify(opts.spec),
      JSON.stringify(opts.files),
      opts.conversationId ?? null
    );
  return Number(result.lastInsertRowid);
}

export function updateProjectFiles(
  id: number,
  files: ProjectFiles,
  spec?: ProjectSpec
): void {
  if (spec) {
    db.prepare(
      `UPDATE build_projects SET files_json = ?, spec_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(files), JSON.stringify(spec), id);
  } else {
    db.prepare(
      `UPDATE build_projects SET files_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(files), id);
  }
}

export function getProjectById(id: number): BuildProjectRow | null {
  const row = db
    .prepare(`SELECT * FROM build_projects WHERE id = ?`)
    .get(id) as BuildProjectRow | undefined;
  return row ?? null;
}

export function getProjectBySlug(slug: string): BuildProjectRow | null {
  const row = db
    .prepare(`SELECT * FROM build_projects WHERE slug = ?`)
    .get(slug) as BuildProjectRow | undefined;
  return row ?? null;
}

export function parseProjectFiles(row: BuildProjectRow): ProjectFiles {
  try {
    const parsed = JSON.parse(row.files_json) as ProjectFiles;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* fallback */
  }
  return {};
}

export function parseProjectSpec(row: BuildProjectRow): ProjectSpec {
  try {
    return JSON.parse(row.spec_json) as ProjectSpec;
  } catch {
    return {
      title: row.title,
      pages: ["Home"],
      features: [],
      klant: row.klant,
    };
  }
}
