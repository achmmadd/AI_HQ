import db from "@/lib/db/database";
import { generateArtifactHtml } from "@/lib/artifact-generate";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import { getTemplate, buildTemplatePreviewHtml, type FumeroDeployType } from "@/lib/fumero/tool-templates";
import {
  ensureFumeroToolsSchema,
  getConceptVersion,
  getPublishedVersion,
  getToolById,
  getVersion,
  listFumeroTools,
  listVersions,
  nextVersionNumber,
  removeCustomAppSync,
  slugifyToolName,
  syncCustomAppFromPublished,
  type FumeroToolRow,
  type FumeroToolVersionRow,
} from "@/lib/fumero/tools-db";

export type GarageToolDto = {
  id: number;
  name: string;
  slug: string;
  deploy_type: FumeroDeployType;
  template_id: string | null;
  archived: boolean;
  published_version: number | null;
  concept_version: number | null;
  version_count: number;
  stats_views: number;
  stats_interactions: number;
  updated_at: string;
};

export type ToolDetailDto = {
  tool: FumeroToolRow;
  versions: FumeroToolVersionRow[];
  concept: FumeroToolVersionRow | null;
  published: FumeroToolVersionRow | null;
};

const FUMERO_INTERACTIVE_HINT =
  " VERPLICHT: één <script>-blok met vanilla JS (addEventListener op knoppen/inputs) zodat de widget direct klikbaar en bruikbaar is in een iframe — geen React, geen type=module.";

const FUMERO_BRAND_HINT =
  "Fumero ops-stijl: rustig, professioneel B2B, Geist/system-ui font, witte (#FFFFFF) of lichtgrijze (#FAFAFA) achtergrond, groen (#69C400) alleen voor primaire knoppen/positieve accenten, geen emoji in de UI-chrome. Mobielvriendelijk en toegankelijk.";

function seedHtmlForTemplate(
  templateId: string | undefined,
  name: string,
  prompt: string,
  deployType: FumeroDeployType
): string | null {
  if (!templateId) return null;
  const seeded = buildTemplatePreviewHtml({
    templateId,
    name,
    prompt,
    deployType,
  });
  return /<script[\s>]/i.test(seeded) ? seeded : null;
}

function templateBuildHint(templateId?: string): string {
  if (templateId === "calculator") {
    return (
      "VERPLICHT: puur rekenmachine-UI — geen keuzehulp, quiz-stappen of product-CTA. " +
      "Toetsenbord: CSS display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px — knoppen in 4 kolommen, niet verticaal gestapeld. " +
      "Styling: achtergrond #141414, display #1e1e1e, groen #69C400 op = en highlights, Geist font, ruime whitespace (24px padding)."
    );
  }
  return "";
}

function buildPrompt(deployType: FumeroDeployType, userPrompt: string, templateId?: string) {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  const typeHint =
    deployType === "internal"
      ? "Interne medewerkers-app (alleen ingelogde gebruikers, mag data-invoer en lijsten bevatten)."
      : deployType === "customer"
        ? "Publieke klantpagina (bv. loyalty, bestelstatus) — geen interne data tonen."
        : templateId === "calculator"
          ? "Standalone rekenmachine-widget (max ~360px breed, geen e-commerce flows)."
          : "Compacte embeddable website-widget voor fumero.nl (past in een smalle kolom, max ~480px breed).";
  const extra = templateBuildHint(templateId);
  return `${typeHint} ${extra} ${tpl?.promptSeed ?? ""} ${userPrompt}`.trim();
}

/**
 * @param currentCode  Indien meegegeven: iteratie-modus — het model past de
 *                      bestaande HTML aan i.p.v. opnieuw te beginnen.
 */
export async function generateToolHtml(
  deployType: FumeroDeployType,
  prompt: string,
  templateId?: string,
  currentCode?: string
): Promise<{ html: string } | { error: string }> {
  const full = buildPrompt(deployType, prompt, templateId);

  const layoutPreserveHint =
    currentCode && currentCode.trim().length > 40
      ? " BEHOUD de bestaande layout-structuur: CSS grid/flex, kolombreedtes, spacing en component-hiërarchie — pas alleen aan wat de gebruiker vraagt."
      : "";

  const iterationContext =
    currentCode && currentCode.trim().length > 40
      ? `\n\nDit is de HUIDIGE HTML van de tool. Pas deze aan volgens de instructie hierboven en lever het VOLLEDIGE bijgewerkte HTML-document opnieuw (behoud wat goed werkt).${layoutPreserveHint}\n\n${currentCode.trim()}`
      : "";

  const built = await generateArtifactHtml(
    `Bouw één compleet, zelfstandig HTML-document (inline CSS, responsive). ${FUMERO_BRAND_HINT}${FUMERO_INTERACTIVE_HINT} ${full}${iterationContext}`,
    "fumero",
    "tools",
    2,
    { preferStrongBuilder: true }
  );
  if (!built.html) {
    const seed = seedHtmlForTemplate(templateId, "Tool", prompt, deployType);
    if (seed) return { html: seed };
    return { error: formatFumeroBuilderError(built.error || "Genereren mislukt") };
  }
  if (!/<script[\s>]/i.test(built.html)) {
    const seed = seedHtmlForTemplate(templateId, "Tool", prompt, deployType);
    if (seed) return { html: seed };
  }
  return { html: built.html };
}

export function listGarageTools(): GarageToolDto[] {
  ensureFumeroToolsSchema();
  return listFumeroTools(true).map((tool) => {
    const versions = listVersions(tool.id);
    const published = versions.filter((v) => v.status === "published").pop();
    const concept = versions.filter((v) => v.status === "concept").pop();
    const stats = versions.reduce(
      (acc, v) => ({
        views: acc.views + Number(v.stats_views || 0),
        interactions: acc.interactions + Number(v.stats_interactions || 0),
      }),
      { views: 0, interactions: 0 }
    );
    return {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      deploy_type: tool.deploy_type as FumeroDeployType,
      template_id: tool.template_id,
      archived: tool.archived === 1,
      published_version: published?.version ?? null,
      concept_version: concept?.version ?? null,
      version_count: versions.length,
      stats_views: stats.views,
      stats_interactions: stats.interactions,
      updated_at: tool.updated_at,
    };
  });
}

export function getToolDetail(toolId: number): ToolDetailDto | null {
  const tool = getToolById(toolId);
  if (!tool) return null;
  const versions = listVersions(toolId);
  return {
    tool,
    versions,
    concept: getConceptVersion(toolId) ?? null,
    published: getPublishedVersion(toolId) ?? null,
  };
}

export function createTool(opts: {
  name: string;
  prompt: string;
  deployType: FumeroDeployType;
  templateId?: string;
  code?: string;
}): { toolId: number; versionId: number } | { error: string } {
  ensureFumeroToolsSchema();
  const slug = slugifyToolName(opts.name);
  const ins = db
    .prepare(
      `INSERT INTO fumero_tools (name, slug, deploy_type, template_id, archived, klant)
       VALUES (?, ?, ?, ?, 0, 'fumero')`
    )
    .run(opts.name, slug, opts.deployType, opts.templateId ?? null);
  const toolId = Number(ins.lastInsertRowid);
  const code = opts.code ?? `<div style="padding:16px;font-family:system-ui">Concept — ${opts.name}</div>`;
  const ver = db
    .prepare(
      `INSERT INTO fumero_tool_versions (tool_id, version, code, prompt, status)
       VALUES (?, 1, ?, ?, 'concept')`
    )
    .run(toolId, code, opts.prompt);
  return { toolId, versionId: Number(ver.lastInsertRowid) };
}

export async function updateConceptCode(
  toolId: number,
  prompt: string,
  code?: string,
  opts?: { iterate?: boolean }
): Promise<{ version: FumeroToolVersionRow } | { error: string }> {
  const tool = getToolById(toolId);
  if (!tool) return { error: "Tool niet gevonden" };

  let concept = getConceptVersion(toolId);
  let html = code;
  if (!html) {
    // Iteratie-modus: huidige concept-code als context meesturen zodat het
    // model de bestaande tool aanpast i.p.v. opnieuw begint.
    const currentCode = opts?.iterate
      ? (concept?.code ?? getPublishedVersion(toolId)?.code)
      : undefined;
    const gen = await generateToolHtml(
      tool.deploy_type as FumeroDeployType,
      prompt,
      tool.template_id ?? undefined,
      currentCode ?? undefined
    );
    if ("error" in gen) return gen;
    html = gen.html;
  }

  if (!concept) {
    const v = nextVersionNumber(toolId);
    const ins = db
      .prepare(
        `INSERT INTO fumero_tool_versions (tool_id, version, code, prompt, status)
         VALUES (?, ?, ?, ?, 'concept')`
      )
      .run(toolId, v, html, prompt);
    concept = getVersion(Number(ins.lastInsertRowid))!;
  } else {
    db.prepare(
      `UPDATE fumero_tool_versions SET code = ?, prompt = ? WHERE id = ?`
    ).run(html, prompt, concept.id);
    concept = getVersion(concept.id)!;
  }

  db.prepare(`UPDATE fumero_tools SET updated_at = datetime('now') WHERE id = ?`).run(toolId);
  return { version: concept };
}

export function publishTool(toolId: number): { ok: true } | { error: string } {
  const tool = getToolById(toolId);
  if (!tool) return { error: "Tool niet gevonden" };
  const concept = getConceptVersion(toolId);
  if (!concept) return { error: "Geen conceptversie om te publiceren" };

  db.prepare(
    `UPDATE fumero_tool_versions SET status = 'archived'
     WHERE tool_id = ? AND status = 'published'`
  ).run(toolId);

  db.prepare(
    `UPDATE fumero_tool_versions SET status = 'published', published_at = datetime('now')
     WHERE id = ?`
  ).run(concept.id);

  const published = getVersion(concept.id)!;
  if (tool.deploy_type === "internal") {
    syncCustomAppFromPublished(tool, published);
  }

  db.prepare(`UPDATE fumero_tools SET updated_at = datetime('now') WHERE id = ?`).run(toolId);
  return { ok: true };
}

export function duplicateToolVersion(
  toolId: number,
  fromVersionId?: number
): { versionId: number } | { error: string } {
  const tool = getToolById(toolId);
  if (!tool) return { error: "Tool niet gevonden" };

  const source =
    (fromVersionId ? getVersion(fromVersionId) : null) ??
    getConceptVersion(toolId) ??
    getPublishedVersion(toolId);
  if (!source) return { error: "Geen bronversie" };

  const existingConcept = getConceptVersion(toolId);
  if (existingConcept) {
    db.prepare(
      `UPDATE fumero_tool_versions SET status = 'archived' WHERE id = ?`
    ).run(existingConcept.id);
  }

  const v = nextVersionNumber(toolId);
  const ins = db
    .prepare(
      `INSERT INTO fumero_tool_versions (tool_id, version, code, prompt, status)
       VALUES (?, ?, ?, ?, 'concept')`
    )
    .run(toolId, v, source.code, source.prompt ?? "", "concept");

  db.prepare(`UPDATE fumero_tools SET updated_at = datetime('now') WHERE id = ?`).run(toolId);
  return { versionId: Number(ins.lastInsertRowid) };
}

export function archiveTool(toolId: number): { ok: true } | { error: string } {
  const tool = getToolById(toolId);
  if (!tool) return { error: "Tool niet gevonden" };
  db.prepare(
    `UPDATE fumero_tools SET archived = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(toolId);
  removeCustomAppSync(tool.slug);
  return { ok: true };
}

export function getPublishedBySlug(slug: string): {
  tool: FumeroToolRow;
  version: FumeroToolVersionRow;
} | null {
  ensureFumeroToolsSchema();
  const tool = db
    .prepare(`SELECT * FROM fumero_tools WHERE slug = ? AND archived = 0`)
    .get(slug) as FumeroToolRow | undefined;
  if (!tool) return null;
  const version = getPublishedVersion(tool.id);
  if (!version) return null;
  return { tool, version };
}
