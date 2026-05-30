import db from "@/lib/db/database";
import { ensureBuildProjectsTable } from "@/lib/db/build-projects-schema";
import { ensureWorkLinksSchema } from "@/lib/db/work-links-schema";
import { getAppSlugForProject, getBuildProjectIdForAppSlug } from "@/lib/project-resume";
import { parseProjectSpec } from "@/lib/project-store";
import type { BuildProjectRow } from "@/lib/project-types";
import { stackDisplayName } from "@/lib/project-stack";

ensureBuildProjectsTable();
ensureWorkLinksSchema();

export type MyWorkItem = {
  kind: "linked" | "project" | "app";
  title: string;
  slug: string;
  klant: string;
  updated_at: string;
  build_project_id: number | null;
  custom_app_id: number | null;
  stack: string | null;
  status: string | null;
};

export function listMyWork(klant?: string): MyWorkItem[] {
  const apps = db
    .prepare(
      klant
        ? `SELECT id, naam, slug, status, klant, created_at FROM custom_apps WHERE klant = ? ORDER BY created_at DESC`
        : `SELECT id, naam, slug, status, klant, created_at FROM custom_apps ORDER BY created_at DESC`
    )
    .all(...(klant ? [klant] : [])) as {
    id: number;
    naam: string;
    slug: string;
    status: string;
    klant: string;
    created_at: string;
  }[];

  const projects = db
    .prepare(
      klant
        ? `SELECT * FROM build_projects WHERE klant = ? ORDER BY updated_at DESC`
        : `SELECT * FROM build_projects ORDER BY updated_at DESC`
    )
    .all(...(klant ? [klant] : [])) as BuildProjectRow[];

  const seenProject = new Set<number>();
  const items: MyWorkItem[] = [];

  for (const app of apps) {
    const pid = getBuildProjectIdForAppSlug(app.slug);
    let stack: string | null = null;
    if (pid) {
      seenProject.add(pid);
      const row = projects.find((p) => p.id === pid);
      if (row) {
        const spec = parseProjectSpec(row);
        stack = spec.stack ? stackDisplayName(spec.stack) : null;
      }
    }
    items.push({
      kind: pid ? "linked" : "app",
      title: app.naam,
      slug: app.slug,
      klant: app.klant,
      updated_at: app.created_at,
      build_project_id: pid,
      custom_app_id: app.id,
      stack,
      status: app.status,
    });
  }

  for (const row of projects) {
    if (seenProject.has(row.id)) continue;
    const spec = parseProjectSpec(row);
    items.push({
      kind: "project",
      title: row.title,
      slug: row.slug,
      klant: row.klant,
      updated_at: row.updated_at,
      build_project_id: row.id,
      custom_app_id: null,
      stack: spec.stack ? stackDisplayName(spec.stack) : null,
      status: null,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return items;
}

export function resolveProjectIdFromSlug(slug: string): number | null {
  const fromApp = getBuildProjectIdForAppSlug(slug);
  if (fromApp) return fromApp;
  const row = db
    .prepare(`SELECT id FROM build_projects WHERE slug = ?`)
    .get(slug) as { id: number } | undefined;
  return row?.id ?? null;
}

export { getAppSlugForProject };
