import db from "@/lib/db/database";
import { ensureBuildProjectsTable } from "@/lib/db/build-projects-schema";
import { ensureWorkLinksSchema } from "@/lib/db/work-links-schema";
import type { ProjectSpec } from "@/lib/project-types";

ensureBuildProjectsTable();
ensureWorkLinksSchema();

export function upsertProjectResumeNote(
  buildProjectId: number,
  summary: string
): void {
  const text = summary.trim().slice(0, 2000);
  if (!text) return;
  db.prepare(
    `INSERT INTO project_resume_notes (build_project_id, summary, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(build_project_id) DO UPDATE SET
       summary = excluded.summary,
       updated_at = datetime('now')`
  ).run(buildProjectId, text);
}

export function buildProjectSummary(
  spec: ProjectSpec,
  lastAction?: string
): string {
  const pages = spec.pages?.length ? spec.pages.join(", ") : "Home";
  const feats = spec.features?.length
    ? spec.features.slice(0, 6).join("; ")
    : "";
  const stack = spec.stack ? ` Stack: ${spec.stack}.` : "";
  const action = lastAction?.trim()
    ? ` Laatste wijziging: ${lastAction.trim().slice(0, 200)}.`
    : "";
  return (
    `Project "${spec.title}" (${spec.klant}): pagina's ${pages}.${feats ? ` Features: ${feats}.` : ""}${stack}${action}`
  ).trim();
}

export function getProjectResumeNote(buildProjectId: number): string | null {
  const row = db
    .prepare(
      `SELECT summary FROM project_resume_notes WHERE build_project_id = ?`
    )
    .get(buildProjectId) as { summary: string } | undefined;
  return row?.summary?.trim() || null;
}

export function getRecentProjectSummariesForKlant(
  klant: string,
  limit = 4
): { projectId: number; title: string; summary: string; updated_at: string }[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.title, n.summary, n.updated_at
       FROM build_projects p
       INNER JOIN project_resume_notes n ON n.build_project_id = p.id
       WHERE p.klant = ?
       ORDER BY n.updated_at DESC
       LIMIT ?`
    )
    .all(klant, limit) as {
    id: number;
    title: string;
    summary: string;
    updated_at: string;
  }[];
  return rows.map((r) => ({
    projectId: r.id,
    title: r.title,
    summary: r.summary,
    updated_at: r.updated_at,
  }));
}

export function linkAppToProject(opts: {
  appSlug: string;
  buildProjectId: number;
  customAppId?: number;
}): void {
  db.prepare(
    `INSERT INTO app_project_links (app_slug, build_project_id, custom_app_id)
     VALUES (?, ?, ?)
     ON CONFLICT(app_slug) DO UPDATE SET
       build_project_id = excluded.build_project_id,
       custom_app_id = COALESCE(excluded.custom_app_id, app_project_links.custom_app_id)`
  ).run(opts.appSlug, opts.buildProjectId, opts.customAppId ?? null);
}

export function getBuildProjectIdForAppSlug(
  appSlug: string
): number | null {
  const row = db
    .prepare(
      `SELECT build_project_id FROM app_project_links WHERE app_slug = ?`
    )
    .get(appSlug) as { build_project_id: number } | undefined;
  return row?.build_project_id ?? null;
}

export function getAppSlugForProject(
  buildProjectId: number
): string | null {
  const row = db
    .prepare(
      `SELECT app_slug FROM app_project_links WHERE build_project_id = ? LIMIT 1`
    )
    .get(buildProjectId) as { app_slug: string } | undefined;
  return row?.app_slug ?? null;
}
