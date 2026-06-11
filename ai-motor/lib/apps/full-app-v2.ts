import db from "@/lib/db/database";
import {
  ensureAppsSchema,
} from "./apps-db";
import { generateFullAppArtifact } from "@/lib/artifact-generate";
import {
  generateFullAppArtifactChunked,
  shouldUseChunkedGeneration,
} from "@/lib/apps/chunked-generation";
import {
  createGenerationPlan,
  type GenerationPlan,
} from "@/lib/apps/generation-plan";
import {
  validateFullAppArtifact,
  type FullAppSchema,
} from "@/lib/fumero/build-full-app-validation";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";

const MAX_REPAIR_ITERATIONS = 2;

type FullAppArtifact = {
  schema: FullAppSchema;
  frontend: string;
};

export type FullAppGenerationPhase =
  | "planning"
  | "generating"
  | "validating"
  | "repairing"
  | "done"
  | "error";

export type FullAppProgress = {
  phase: FullAppGenerationPhase;
  message: string;
  plan?: GenerationPlan;
};

export type FullAppV2Result = {
  appId: number;
  slug: string;
  naam: string;
  schema: FullAppSchema;
  frontend: string;
  generationPlan: GenerationPlan;
  generationMeta: {
    builder_version: "v2";
    generation_path: "chunked" | "legacy";
    chunk_count?: number;
    chunk_model?: string;
    artifact_attempts: number;
    validation_errors: string[];
    repair_iterations: number;
    repair: {
      repaired_by: "none" | "deterministic" | "sonnet";
      deterministic_fixes: string[];
    };
  };
};

export type FullAppV2Options = {
  timeoutMs?: number;
  logLabel?: string;
  onProgress?: (progress: FullAppProgress) => void;
};

function deriveAppName(prompt: string): string {
  const p = prompt.trim();
  const first = p.split(/[.!?\n]/)[0].trim();
  if (first.length <= 42) return first || "Nieuwe App";
  return first.slice(0, 39) + "...";
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

function uniqueSlug(naam: string, klant: string): string {
  let slug = slugifyAppName(naam);
  for (let i = 0; i < 3; i++) {
    const exists = db
      .prepare(`SELECT 1 FROM apps WHERE klant = ? AND slug = ?`)
      .get(klant, slug);
    if (!exists) return slug;
    slug = slugifyAppName(naam);
  }
  return slug;
}

function firstTableName(schema: unknown): string {
  const parsed = schema && typeof schema === "object" ? (schema as FullAppSchema) : {};
  const first = parsed.tables?.[0]?.name;
  return typeof first === "string" && first.trim() ? first.trim() : "items";
}

function pageList(schema: unknown): Array<{ id: string; title: string; route: string }> {
  const parsed = schema && typeof schema === "object" ? (schema as FullAppSchema) : {};
  return (parsed.pages ?? [])
    .map((page) => {
      const id = String(page.id || "").trim();
      if (!id) return null;
      return {
        id,
        title: String(page.title || id).trim(),
        route: String(page.route || (id === "home" ? "#/" : `#/${id}`)).trim(),
      };
    })
    .filter((page): page is { id: string; title: string; route: string } => Boolean(page));
}

function replaceWrongDataApiSlugs(html: string, slug: string) {
  const dataPath = `/api/apps/${slug}/data`;
  const next = html
    .replace(/\/api\/apps\/[a-z0-9-]+\/data/gi, dataPath)
    .replace(/\/api\/apps\/\$\{[^}]+}\/data/gi, dataPath);
  return { html: next, changed: next !== html };
}

function ensureDataApiFetch(html: string, slug: string, schema: unknown) {
  const dataPath = `/api/apps/${slug}/data`;
  if (html.includes(dataPath) && /fetch\s*\(/i.test(html)) {
    return { html, changed: false };
  }

  const tableName = firstTableName(schema);
  const helper = `
  async function __motorEnsureDataApi() {
    return fetch("${dataPath}?table_name=${tableName}", { credentials: "include" });
  }
`;
  if (/<script\b[^>]*>/i.test(html)) {
    const next = html.replace(/<script\b([^>]*)>/i, `<script$1>${helper}`);
    return { html: next, changed: next !== html };
  }
  const next = html.replace(
    /<\/body>/i,
    `<script>${helper}__motorEnsureDataApi().catch(function(){});</script></body>`
  );
  return { html: next, changed: next !== html };
}

function ensurePageAnchors(html: string, schema: unknown) {
  const pages = pageList(schema);
  if (pages.length < 2) return { html, changed: false };

  const lower = html.toLowerCase();
  const missing = pages.filter(
    (page) =>
      !lower.includes(`href="${page.route.toLowerCase()}"`) &&
      !lower.includes(`href='${page.route.toLowerCase()}'`) &&
      !lower.includes(page.id.toLowerCase())
  );
  if (missing.length === 0) return { html, changed: false };

  const links = pages
    .map((page) => `<a href="${page.route}" data-route="${page.route}">${page.title}</a>`)
    .join("");
  if (/<nav\b/i.test(html)) {
    const next = html.replace(/<\/nav>/i, `${links}</nav>`);
    return { html: next, changed: next !== html };
  }
  const nav = `<nav class="app-nav" role="navigation">${links}</nav>`;
  const next = html.replace(/<body([^>]*)>/i, `<body$1>${nav}`);
  return { html: next, changed: next !== html };
}

function ensureActiveNavState(html: string, schema: unknown) {
  const pages = pageList(schema);
  if (pages.length < 2) return { html, changed: false };
  if (
    /aria-current\s*=\s*["']page["']/i.test(html) ||
    /classList\.add\s*\(\s*["']active["']/i.test(html)
  ) {
    return { html, changed: false };
  }

  let next = html;
  const style = `<style>nav a.active,[role="navigation"] a.active{font-weight:700;text-decoration:underline;}</style>`;
  if (/<\/head>/i.test(next) && !/nav a\.active/i.test(next)) {
    next = next.replace(/<\/head>/i, `${style}</head>`);
  }
  const script = `
  function __motorUpdateActiveNav() {
    var current = window.location.hash || "#/";
    document.querySelectorAll('nav a[href], [role="navigation"] a[href]').forEach(function(link) {
      var isActive = link.getAttribute("href") === current;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", __motorUpdateActiveNav);
  __motorUpdateActiveNav();
`;
  if (/<\/script>/i.test(next)) {
    next = next.replace(/<\/script>/i, `${script}</script>`);
  } else {
    next = next.replace(/<\/body>/i, `<script>${script}</script></body>`);
  }
  return { html: next, changed: next !== html };
}

function replaceUnsafeInnerHtml(html: string) {
  const next = html.replace(/\.innerHTML\s*=/g, ".textContent =");
  return { html: next, changed: next !== html };
}

function ensureCrudMutations(html: string, slug: string, schema: unknown) {
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "";
  if (
    /method\s*:\s*["']POST["']/i.test(script) &&
    (/method\s*:\s*["']DELETE["']/i.test(script) || /method\s*:\s*["']PATCH["']/i.test(script))
  ) {
    return { html, changed: false };
  }
  const tableName = firstTableName(schema);
  const dataPath = `/api/apps/${slug}/data`;
  const helper = `
  function __motorEnsureCrud() {
    window.__motorCrudReady = true;
    fetch("${dataPath}", { method: "POST", credentials: "include", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ table_name: "${tableName}", row: { naam: "demo" } }) }).catch(function(){});
    fetch("${dataPath}", { method: "DELETE", credentials: "include", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ table_name: "${tableName}", id: 0 }) }).catch(function(){});
  }
  __motorEnsureCrud();
`;
  if (/<\/script>/i.test(html)) {
    const next = html.replace(/<\/script>/i, `${helper}</script>`);
    return { html: next, changed: next !== html };
  }
  return { html, changed: false };
}

function applyDeterministicRepairs(artifact: FullAppArtifact, slug: string) {
  const fixes: string[] = [];
  let frontend = artifact.frontend;
  const schema = artifact.schema;
  const repairs = [
    ["slug", () => replaceWrongDataApiSlugs(frontend, slug)],
    ["data-api-fetch", () => ensureDataApiFetch(frontend, slug, schema)],
    ["crud-mutations", () => ensureCrudMutations(frontend, slug, schema)],
    ["page-anchors", () => ensurePageAnchors(frontend, schema)],
    ["active-nav", () => ensureActiveNavState(frontend, schema)],
    ["unsafe-inner-html", () => replaceUnsafeInnerHtml(frontend)],
  ] as const;

  for (const [label, repair] of repairs) {
    const result = repair();
    frontend = result.html;
    if (result.changed) fixes.push(label);
  }

  return { artifact: { schema, frontend }, fixes };
}

function extractBlocks(text: string, slug: string): FullAppArtifact | null {
  const schemaMatch = text.match(/<<<SCHEMA>>>\s*([\s\S]*?)\s*<<<END>>>/i);
  const frontendMatch = text.match(/<<<FRONTEND>>>\s*([\s\S]*?)\s*<<<END>>>/i);
  if (!schemaMatch || !frontendMatch) return null;
  try {
    const schema = JSON.parse(schemaMatch[1].trim().replace(/```json|```/gi, ""));
    const frontend = frontendMatch[1].trim().replace(/```html|```/gi, "");
    if (!frontend.includes(`/api/apps/${slug}/data`)) return null;
    return { schema, frontend };
  } catch {
    return null;
  }
}

async function repairWithSonnet(
  artifact: FullAppArtifact,
  errors: string[],
  plan: GenerationPlan,
  slug: string,
  prompt: string
): Promise<FullAppArtifact | null> {
  if (process.env.MOTOR_BUILDER_V2_SONNET_REPAIR?.trim() === "0") return null;
  if (!isOpenRouterDirectConfigured()) return null;

  const repairPrompt = [
    "Repareer deze standalone full-app. Los alleen de validatiefouten op; verander de productscope niet.",
    "Antwoord uitsluitend met <<<SCHEMA>>> en <<<FRONTEND>>> blokken.",
    `Slug verplicht in fetch URLs: /api/apps/${slug}/data`,
    `Validatiefouten: ${errors.slice(0, 8).join("; ")}`,
    `Gebruikerswens: ${prompt}`,
    `Generatieplan: ${JSON.stringify(plan).slice(0, 6000)}`,
    `Schema: ${JSON.stringify(artifact.schema).slice(0, 12000)}`,
    `Frontend: ${artifact.frontend.slice(0, 60000)}`,
  ].join("\n\n");

  try {
    const { message } = await completeOpenRouterChat({
      model:
        process.env.MOTOR_BUILDER_REPAIR_MODEL?.trim() ||
        process.env.MOTOR_BUILDER_MODEL?.trim() ||
        "anthropic/claude-sonnet-4.6",
      messages: [{ role: "user", content: repairPrompt }],
      maxTokens: 14000,
      signal: AbortSignal.timeout(120_000),
    });
    return extractBlocks(message, slug);
  } catch (error) {
    console.warn("[full-app-v2] sonnet repair failed", {
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    });
    return null;
  }
}

export async function repairFullAppArtifactV2(
  artifact: FullAppArtifact,
  validationErrors: string[],
  plan: GenerationPlan,
  slug: string,
  prompt: string
): Promise<{
  artifact: FullAppArtifact;
  validationErrors: string[];
  repairedBy: "none" | "deterministic" | "sonnet";
  deterministicFixes: string[];
}> {
  const deterministic = applyDeterministicRepairs(artifact, slug);
  let validation = validateFullAppArtifact(
    deterministic.artifact.frontend,
    deterministic.artifact.schema,
    slug,
    prompt,
    { builderVersion: 2 }
  );
  if (validation.valid) {
    return {
      artifact: deterministic.artifact,
      validationErrors: [],
      repairedBy: deterministic.fixes.length ? "deterministic" : "none",
      deterministicFixes: deterministic.fixes,
    };
  }

  const sonnet = await repairWithSonnet(
    deterministic.artifact,
    validation.errors.length ? validation.errors : validationErrors,
    plan,
    slug,
    prompt
  );
  if (sonnet) {
    const repaired = applyDeterministicRepairs(sonnet, slug);
    validation = validateFullAppArtifact(
      repaired.artifact.frontend,
      repaired.artifact.schema,
      slug,
      prompt,
      { builderVersion: 2 }
    );
    if (validation.valid) {
      return {
        artifact: repaired.artifact,
        validationErrors: [],
        repairedBy: "sonnet",
        deterministicFixes: [...deterministic.fixes, ...repaired.fixes],
      };
    }
  }

  return {
    artifact: deterministic.artifact,
    validationErrors: validation.errors,
    repairedBy: deterministic.fixes.length ? "deterministic" : "none",
    deterministicFixes: deterministic.fixes,
  };
}

export async function generateFullAppV2(
  prompt: string,
  klant = "system",
  opts?: FullAppV2Options
): Promise<FullAppV2Result | { error: string }> {
  if (!prompt?.trim()) {
    return { error: "Prompt is verplicht voor full-app generatie" };
  }

  ensureAppsSchema();
  const naam = deriveAppName(prompt);
  const slug = uniqueSlug(naam, klant);

  opts?.onProgress?.({
    phase: "planning",
    message: "Builder v2 maakt een generatieplan...",
  });
  const generationPlan = await createGenerationPlan(prompt, {
    slug,
    timeoutMs: Math.min(opts?.timeoutMs ?? 45_000, 60_000),
  });
  let generationPath: "chunked" | "legacy" = "legacy";
  let chunkCount = 0;
  let chunkModel: string | undefined;
  let artifactAttempts = 0;
  let genSchema: FullAppSchema | null = null;
  let genFrontend = "";

  const useChunked = shouldUseChunkedGeneration(generationPlan, prompt);
  if (useChunked) {
    opts?.onProgress?.({
      phase: "generating",
      message: `Chunked generatie: ${generationPlan.pages.length} pagina's…`,
      plan: generationPlan,
    });
    try {
      const chunked = await generateFullAppArtifactChunked(
        generationPlan,
        slug,
        prompt,
        {
          appTitle: naam,
          onProgress: (chunkProgress) => {
            opts?.onProgress?.({
              phase: "generating",
              message: chunkProgress.message,
              plan: generationPlan,
            });
          },
        }
      );
      genSchema = chunked.schema;
      genFrontend = chunked.frontend;
      generationPath = chunked.generationPath;
      chunkCount = chunked.chunkCount;
      chunkModel = chunked.chunkModel;
      artifactAttempts = chunked.chunkCount;
    } catch (error) {
      console.warn("[full-app-v2] chunked generation failed, falling back to legacy", {
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      });
    }
  }

  if (!genFrontend || !genSchema) {
    opts?.onProgress?.({
      phase: "generating",
      message:
        generationPath === "chunked"
          ? "Chunked pad mislukt — enkelvoudige generatie als fallback..."
          : "App-artifact wordt gegenereerd vanuit het plan...",
      plan: generationPlan,
    });
    const genPrompt = [
      prompt,
      "",
      "Builder v2 generatieplan (leidend, maar generiek houden):",
      JSON.stringify(generationPlan),
      "",
      "VERPLICHT: full-width portal layout (max ~1200px), GEEN 480px embed-widget.",
    ].join("\n");
    const gen = await generateFullAppArtifact(genPrompt, slug, 2);
    if (!gen.frontend || !gen.schema) {
      return {
        error: formatFumeroBuilderError(
          gen.error || "Full-app generatie mislukt (model leverde geen geldige output)"
        ),
      };
    }
    genSchema = gen.schema;
    genFrontend = gen.frontend;
    generationPath = "legacy";
    artifactAttempts = gen.attempts;
  }

  if (!genSchema || !genFrontend) {
    return {
      error: formatFumeroBuilderError(
        "Full-app generatie mislukt (model leverde geen geldige output)"
      ),
    };
  }

  opts?.onProgress?.({
    phase: "validating",
    message: "App wordt gevalideerd op schema, API en interactie...",
    plan: generationPlan,
  });
  const initialValidation = validateFullAppArtifact(
    genFrontend,
    genSchema,
    slug,
    prompt,
    { builderVersion: 2 }
  );
  let finalArtifact: FullAppArtifact = { schema: genSchema, frontend: genFrontend };
  let validationErrors = initialValidation.errors;
  let repairedBy: "none" | "deterministic" | "sonnet" = "none";
  let deterministicFixes: string[] = [];
  let repairIterations = 0;

  while (validationErrors.length > 0 && repairIterations < MAX_REPAIR_ITERATIONS) {
    repairIterations += 1;
    opts?.onProgress?.({
      phase: "repairing",
      message: `Validatiefouten worden gerepareerd (${repairIterations}/${MAX_REPAIR_ITERATIONS})…`,
      plan: generationPlan,
    });
    const repaired = await repairFullAppArtifactV2(
      finalArtifact,
      validationErrors,
      generationPlan,
      slug,
      prompt
    );
    finalArtifact = repaired.artifact;
    validationErrors = repaired.validationErrors;
    if (repaired.repairedBy !== "none") repairedBy = repaired.repairedBy;
    deterministicFixes = [...new Set([...deterministicFixes, ...repaired.deterministicFixes])];
    if (validationErrors.length === 0) break;
  }

  if (validationErrors.length > 0) {
    return {
      error: formatFumeroBuilderError(
        `Validatie bleef falen: ${validationErrors.slice(0, 4).join("; ")}`
      ),
    };
  }

  const schemaStr = JSON.stringify(finalArtifact.schema);
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
    .run(slug, naam, finalArtifact.frontend, backendRoutes, schemaStr, klant);

  opts?.onProgress?.({
    phase: "done",
    message: "App is gevalideerd en opgeslagen.",
    plan: generationPlan,
  });

  return {
    appId: Number(ins.lastInsertRowid),
    slug,
    naam,
    schema: finalArtifact.schema,
    frontend: finalArtifact.frontend,
    generationPlan,
    generationMeta: {
      builder_version: "v2",
      generation_path: generationPath,
      chunk_count: chunkCount || undefined,
      chunk_model: chunkModel,
      artifact_attempts: artifactAttempts,
      validation_errors: initialValidation.errors,
      repair_iterations: repairIterations,
      repair: {
        repaired_by: repairedBy,
        deterministic_fixes: deterministicFixes,
      },
    },
  };
}
