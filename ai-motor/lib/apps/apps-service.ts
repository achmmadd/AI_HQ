import db from "@/lib/db/database";
import {
  ensureAppsSchema,
  getPublishedApp,
  listAppsForKlant,
  getAppBySlug,
  countAppDataRows,
  getAppDataRows,
} from "./apps-db";
import { generateFullAppArtifact } from "@/lib/artifact-generate";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export type FullAppResult = {
  appId: number;
  slug: string;
  naam: string;
  schema: any;
  frontend: string;
};

export { getPublishedApp };

function deriveAppName(prompt: string): string {
  const p = prompt.trim();
  const first = p.split(/[.!?\n]/)[0].trim();
  if (first.length <= 42) return first || "Nieuwe App";
  return first.slice(0, 39) + "…";
}

function slugifyAppName(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "app"}-${suffix}`;
}

export async function generateFullApp(
  prompt: string,
  klant: string = "system"
): Promise<FullAppResult | { error: string }> {
  if (!prompt?.trim()) {
    return { error: "Prompt is verplicht voor full-app generatie" };
  }

  ensureAppsSchema();

  const naam = deriveAppName(prompt);
  let slug = slugifyAppName(naam);

  // Uniqueness per klant (race safe via 3 retries)
  for (let i = 0; i < 3; i++) {
    const exists = db
      .prepare(`SELECT 1 FROM apps WHERE klant = ? AND slug = ?`)
      .get(klant, slug);
    if (!exists) break;
    slug = slugifyAppName(naam);
  }

  const gen = await generateFullAppArtifact(prompt, slug, 2);
  if (!gen.frontend || !gen.schema) {
    return {
      error: formatFumeroBuilderError(
        gen.error || "Full-app generatie mislukt (model leverde geen geldige output)"
      ),
    };
  }

  const schemaStr = JSON.stringify(gen.schema);
  const backendRoutes = JSON.stringify({
    data_api: `/api/apps/${slug}/data`,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    note: "Generic app_data storage; strict klant/workspace scoping via requireWorkspaceApi",
  });

  const ins = db
    .prepare(
      `INSERT INTO apps (slug, naam, type, frontend_code, backend_routes, db_schema, auth_required, version, status, klant)
       VALUES (?, ?, 'internal', ?, ?, ?, 0, 1, 'concept', ?)`
    )
    .run(slug, naam, gen.frontend, backendRoutes, schemaStr, klant);

  const appId = Number(ins.lastInsertRowid);

  return {
    appId,
    slug,
    naam,
    schema: gen.schema,
    frontend: gen.frontend,
  };
}

/** Minimal publish for Fase 3: flips status to 'published' so PWA assets + routes activate. No auth here (Fase 4). */
export function publishApp(slug: string, klant: string = "system"): { ok: true } | { error: string } {
  ensureAppsSchema();
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const res = db
    .prepare(
      `UPDATE apps SET status = 'published', updated_at = datetime('now')
       WHERE slug = ? AND klant = ? AND status != 'archived'`
    )
    .run(safeSlug, klant);
  if (res.changes === 0) {
    return { error: "App niet gevonden, al gepubliceerd of gearchiveerd" };
  }
  return { ok: true };
}

/** Fase 5 re-exports for garage/chat (klant-scoped). */
export {
  listAppsForKlant,
  getAppBySlug,
  countAppDataRows,
  getAppDataRows,
};

/** Fase 5: refine existing app using full-app gen path (Claude Sonnet preferred), load current frontend+schema as context for intelligent update, but NEVER touch app_data rows (data preserved). */
export async function refineFullApp(
  slug: string,
  klant: string,
  instruction: string
): Promise<FullAppResult | { error: string }> {
  ensureAppsSchema();
  const current = getAppBySlug(slug, klant);
  if (!current || !current.frontend_code) {
    return { error: "App niet gevonden of geen code om te verfijnen" };
  }

  const schema = current.db_schema ? JSON.parse(current.db_schema) : {};
  const numTables = Array.isArray(schema.tables) ? schema.tables.length : 0;
  const contextNote = `BESTAANDE APP (slug=${slug}, naam=${current.naam}, type=${current.type}, v${current.version}, ${numTables} tabellen, auth=${current.auth_required}). Huidig db_schema: ${JSON.stringify(schema)}. Bestaande data in app_data MOET compatibel blijven — wijzig geen kolomnamen/types die data breken.`;

  const refinePrompt = `${contextNote}\n\nAanpassingsinstructie: ${instruction}\n\nGenereer vernieuwde volledige standalone app met dezelfde data API patroon (/api/apps/${slug}/data). Lever exact <<<SCHEMA>>> + <<<FRONTEND>>> blokken.`;

  const gen = await generateFullAppArtifact(refinePrompt, slug, 2);
  if (!gen.frontend || !gen.schema) {
    return {
      error: formatFumeroBuilderError(
        gen.error || "Refine mislukt (model gaf geen geldige output)"
      ),
    };
  }

  const schemaStr = JSON.stringify(gen.schema);
  const backendRoutes = JSON.stringify({
    data_api: `/api/apps/${slug}/data`,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    note: "Generic app_data storage; strict klant/workspace scoping via requireWorkspaceApi",
  });

  db.prepare(
    `UPDATE apps SET frontend_code = ?, db_schema = ?, backend_routes = ?, version = version + 1, updated_at = datetime('now')
     WHERE klant = ? AND slug = ?`
  ).run(gen.frontend, schemaStr, backendRoutes, klant, slug);

  return {
    appId: current.id,
    slug,
    naam: current.naam,
    schema: gen.schema,
    frontend: gen.frontend,
  };
}
