import { loadFumeroBuilderDesignContext } from "@/lib/fumero/design-builder-context";
import { isMultiPagePrompt } from "@/lib/fumero/build-prompt-heuristics";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";
import type { FullAppSchema } from "@/lib/fumero/build-full-app-validation";
import type {
  GenerationPlan,
  GenerationPlanPage,
  GenerationPlanDataTable,
} from "@/lib/apps/generation-plan";

export type PageChunk = {
  pageId: string;
  sectionHtml: string;
  scriptFragment: string;
  tables: string[];
};

export type ChunkedGenerationProgress = {
  phase: "generating";
  message: string;
  pageIndex: number;
  pageTotal: number;
  pageId: string;
};

export type ChunkedGenerationResult = {
  schema: FullAppSchema;
  frontend: string;
  chunkCount: number;
  generationPath: "chunked";
  chunkModel: string;
  pageChunks: PageChunk[];
};

const PORTAL_BASE_CSS = `
  *, ::before, ::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Geist", system-ui, -apple-system, sans-serif;
    background: #FAFAFA;
    color: #171717;
    line-height: 1.5;
    min-height: 100vh;
    width: 100%;
  }
  .app-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 12px 24px;
    background: #fff;
    border-bottom: 1px solid #E5E5E5;
    width: 100%;
  }
  .app-nav a {
    padding: 8px 14px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    color: #525252;
  }
  .app-nav a:hover { background: #F5F5F5; color: #171717; }
  .app-nav a.active {
    background: rgba(105, 196, 0, 0.12);
    color: #3d7a00;
    font-weight: 600;
  }
  .brand { font-weight: 700; color: #69C400; margin-right: 12px; font-size: 15px; }
  main { width: 100%; max-width: 1200px; margin: 0 auto; padding: 24px 20px 48px; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .lead { color: #525252; margin-bottom: 20px; max-width: 60ch; }
  .card {
    background: #fff;
    border: 1px solid #E5E5E5;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: #69C400;
    color: #fff;
  }
  .btn-secondary { background: #fff; color: #171717; border: 1px solid #E5E5E5; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #E5E5E5; }
  .page { display: none; }
  .page.active { display: block; }
  .empty { color: #737373; font-size: 14px; padding: 24px 0; text-align: center; }
  .error { color: #b91c1c; font-size: 13px; margin-top: 8px; }
  .form-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .form-row input, .form-row select { flex: 1; min-width: 140px; padding: 8px 10px; border: 1px solid #E5E5E5; border-radius: 8px; }
`.trim();

function chunkModel(): string {
  return (
    process.env.MOTOR_BUILDER_CHUNK_MODEL?.trim() ||
    process.env.MOTOR_CODE_MODEL?.trim() ||
    "deepseek/deepseek-v4-flash"
  );
}

function chunkTimeoutMs(): number {
  const raw = process.env.MOTOR_BUILDER_CHUNK_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 90_000;
  return Number.isFinite(n) && n > 5_000 ? n : 90_000;
}

export function shouldUseChunkedGeneration(
  plan: GenerationPlan,
  prompt: string
): boolean {
  if (process.env.MOTOR_BUILDER_V2_CHUNKED?.trim() === "0") return false;
  if (plan.pages.length >= 2) return true;
  if (isMultiPagePrompt(prompt)) return true;
  if (plan.dataTables.length >= 2) return true;
  if (/\b(portaal|portal|dashboard|admin|crm|erp|saas)\b/i.test(prompt)) return true;
  return false;
}

function demoRowForTable(table: GenerationPlanDataTable, index: number): Record<string, unknown> {
  const row: Record<string, unknown> = { id: index + 1 };
  for (const col of table.columns) {
    if (col.name === "id") continue;
    const t = (col.type || "text").toLowerCase();
    if (t === "boolean" || t === "bool") row[col.name] = index % 2 === 0;
    else if (t === "integer" || t === "int" || t === "number") row[col.name] = (index + 1) * 10;
    else if (t === "date") row[col.name] = "2026-06-01";
    else if (/naam|name|titel|title/.test(col.name)) row[col.name] = `Demo ${table.name} ${index + 1}`;
    else if (/status/.test(col.name)) row[col.name] = index === 0 ? "actief" : "concept";
    else if (/email/.test(col.name)) row[col.name] = `demo${index + 1}@example.nl`;
    else if (/rol|role/.test(col.name)) row[col.name] = index === 0 ? "admin" : "medewerker";
    else row[col.name] = `waarde-${index + 1}`;
  }
  return row;
}

/** Deterministic schema chunk from GenerationPlan (geen LLM). */
export function generateSchemaChunk(plan: GenerationPlan, slug: string): FullAppSchema {
  return buildSchemaFromPlan(plan, slug);
}

export function buildSchemaFromPlan(plan: GenerationPlan, slug: string): FullAppSchema {
  const tables = plan.dataTables.map((table) => ({
    name: table.name,
    columns: table.columns.map((col) => ({
      name: col.name,
      type: col.type,
      required: col.required === true,
      pk: col.name === "id",
    })),
    seed_rows: [demoRowForTable(table, 0), demoRowForTable(table, 1)],
  }));

  const pages = plan.pages.map((page) => ({
    id: page.id,
    title: page.title,
    route: page.route,
  }));

  return {
    tables,
    pages,
    meta: {
      slug,
      appType: plan.appType,
      summary: plan.summary,
      builder_version: 2,
      generation: "chunked",
    },
  };
}

export function tablesForPage(
  plan: GenerationPlan,
  page: GenerationPlanPage
): string[] {
  const pageKey = page.id.toLowerCase();
  const matched = plan.dataTables.filter((table) => {
    const name = table.name.toLowerCase();
    return (
      pageKey.includes(name) ||
      name.includes(pageKey.replace(/-/g, "_")) ||
      page.purpose.toLowerCase().includes(name)
    );
  });
  if (matched.length > 0) return matched.map((t) => t.name);
  if (/admin|dashboard|beheer|overzicht|home/.test(pageKey)) {
    return plan.dataTables.map((t) => t.name);
  }
  return [plan.dataTables[0]?.name].filter(Boolean) as string[];
}

function parsePageChunkOutput(text: string, page: GenerationPlanPage): {
  sectionHtml: string;
  scriptFragment: string;
} | null {
  const sectionMatch = text.match(/<<<SECTION>>>\s*([\s\S]*?)\s*<<<END>>>/i);
  const scriptMatch = text.match(/<<<SCRIPT>>>\s*([\s\S]*?)\s*<<<END>>>/i);
  let sectionHtml = sectionMatch?.[1]?.trim() ?? "";
  if (!sectionHtml && /<section\b/i.test(text)) {
    const fallback = text.match(/<section[\s\S]*<\/section>/i);
    sectionHtml = fallback?.[0]?.trim() ?? "";
  }
  if (!sectionHtml) return null;
  if (!/data-page\s*=/.test(sectionHtml)) {
    sectionHtml = sectionHtml.replace(
      /<section\b/i,
      `<section id="page-${page.id}" class="page" data-page="${page.id}"`
    );
  }
  const scriptFragment = (scriptMatch?.[1] ?? "").trim().replace(/```(?:js|javascript)?/gi, "");
  return { sectionHtml, scriptFragment };
}

export function buildDeterministicPageChunk(
  plan: GenerationPlan,
  page: GenerationPlanPage,
  slug: string
): PageChunk {
  const tables = tablesForPage(plan, page);
  const primary = tables[0] || plan.dataTables[0]?.name || "items";
  const dataPath = `/api/apps/${slug}/data`;
  const isCrudPage = !/home|login|register/.test(page.id);

  const crudBlock = isCrudPage
    ? `
    <div class="card">
      <h2 style="font-size:1rem;margin-bottom:12px;">${page.title} beheren</h2>
      <div class="form-row">
        <input id="${page.id}-naam" type="text" placeholder="Naam" aria-label="Naam">
        <button type="button" class="btn" id="${page.id}-add">Toevoegen</button>
      </div>
      <div id="${page.id}-loading" class="empty">Laden…</div>
      <table id="${page.id}-table" hidden>
        <thead><tr><th>ID</th><th>Naam</th><th>Acties</th></tr></thead>
        <tbody id="${page.id}-body"></tbody>
      </table>
      <p id="${page.id}-error" class="error" hidden></p>
    </div>`
    : `<div class="card"><p class="lead">${page.purpose}</p><button type="button" class="btn" id="${page.id}-cta">Start</button></div>`;

  const sectionHtml = `<section id="page-${page.id}" class="page" data-page="${page.id}">
    <h1>${page.title}</h1>
    <p class="lead">${page.purpose}</p>
    ${crudBlock}
  </section>`;

  const scriptFragment = isCrudPage
    ? `
  function initPage_${page.id.replace(/[^a-z0-9_]/gi, "_")}() {
    var tableName = "${primary}";
    var api = "${dataPath}";
    var loading = document.getElementById("${page.id}-loading");
    var tbody = document.getElementById("${page.id}-body");
    var table = document.getElementById("${page.id}-table");
    var errEl = document.getElementById("${page.id}-error");
    function showErr(msg) { if (errEl) { errEl.textContent = msg; errEl.hidden = false; } }
    function loadRows() {
      fetch(api + "?table_name=" + encodeURIComponent(tableName), { credentials: "include" })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (loading) loading.hidden = true;
          if (table) table.hidden = false;
          var rows = (data && data.rows) || [];
          if (!tbody) return;
          tbody.textContent = "";
          rows.forEach(function(row){
            var tr = document.createElement("tr");
            var tdId = document.createElement("td"); tdId.textContent = String(row.__id || row.id || "");
            var tdNaam = document.createElement("td"); tdNaam.textContent = String(row.naam || row.titel || row.name || "");
            var tdAct = document.createElement("td");
            var del = document.createElement("button"); del.type = "button"; del.className = "btn btn-secondary"; del.textContent = "Verwijder";
            del.addEventListener("click", function(){
              fetch(api, { method: "DELETE", credentials: "include", headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ table_name: tableName, id: row.__id || row.id }) }).then(loadRows).catch(function(e){ showErr(e.message); });
            });
            tdAct.appendChild(del);
            tr.appendChild(tdId); tr.appendChild(tdNaam); tr.appendChild(tdAct);
            tbody.appendChild(tr);
          });
        })
        .catch(function(e){ showErr(e.message || "Laden mislukt"); });
    }
    var addBtn = document.getElementById("${page.id}-add");
    if (addBtn) addBtn.addEventListener("click", function(){
      var inp = document.getElementById("${page.id}-naam");
      var naam = inp && "value" in inp ? String(inp.value || "").trim() : "";
      if (!naam) { showErr("Vul een naam in"); return; }
      fetch(api, { method: "POST", credentials: "include", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ table_name: tableName, row: { naam: naam } }) })
        .then(function(){ if (inp && "value" in inp) inp.value = ""; loadRows(); })
        .catch(function(e){ showErr(e.message || "Opslaan mislukt"); });
    });
    loadRows();
  }`
    : `
  function initPage_${page.id.replace(/[^a-z0-9_]/gi, "_")}() {
    var cta = document.getElementById("${page.id}-cta");
    if (cta) cta.addEventListener("click", function(){ window.location.hash = "#/dashboard"; });
  }`;

  return { pageId: page.id, sectionHtml, scriptFragment, tables };
}

export async function generatePageChunk(
  plan: GenerationPlan,
  page: GenerationPlanPage,
  slug: string,
  userPrompt: string,
  opts?: { signal?: AbortSignal; designContext?: string }
): Promise<PageChunk> {
  const tables = tablesForPage(plan, page);
  const fallback = buildDeterministicPageChunk(plan, page, slug);
  if (!isOpenRouterDirectConfigured()) return fallback;

  const design = opts?.designContext ?? loadFumeroBuilderDesignContext();
  const prompt = [
    "Genereer ALLEEN de pagina-sectie voor een full-width portal-app (GEEN widget, GEEN max-width 480px).",
    design,
    `App-slug: ${slug} — gebruik EXACT /api/apps/${slug}/data voor alle fetch()-calls.`,
    "Geen localStorage. CRUD via GET/POST/PATCH/DELETE naar de data-API.",
    `Pagina: ${page.title} (id=${page.id}, route=${page.route})`,
    `Doel: ${page.purpose}`,
    `Tabellen: ${tables.join(", ") || "items"}`,
    `Gebruikerswens: ${userPrompt.slice(0, 1200)}`,
    "Outputformaat (geen markdown):",
    "<<<SECTION>>>",
    `<section id="page-${page.id}" class="page" data-page="${page.id}">...</section>`,
    "<<<END>>>",
    "<<<SCRIPT>>>",
    `function initPage_${page.id.replace(/[^a-z0-9_]/gi, "_")}() { /* fetch CRUD */ }`,
    "<<<END>>>",
  ].join("\n");

  try {
    const { message } = await completeOpenRouterChat({
      model: chunkModel(),
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4000,
      signal: opts?.signal ?? AbortSignal.timeout(chunkTimeoutMs()),
    });
    const parsed = parsePageChunkOutput(message, page);
    if (!parsed) return fallback;
    if (!parsed.sectionHtml.includes(`/api/apps/${slug}/data`) && tables.length > 0) {
      return fallback;
    }
    return {
      pageId: page.id,
      sectionHtml: parsed.sectionHtml,
      scriptFragment: parsed.scriptFragment || fallback.scriptFragment,
      tables,
    };
  } catch (error) {
    console.warn("[chunked-generation] page chunk fallback", {
      page: page.id,
      error: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
    });
    return fallback;
  }
}

function buildSharedScript(
  plan: GenerationPlan,
  slug: string,
  pageChunks: PageChunk[]
): string {
  const pageIds = plan.pages.map((p) => p.id);
  const inits = pageChunks
    .map((chunk) => {
      const fn = `initPage_${chunk.pageId.replace(/[^a-z0-9_]/gi, "_")}`;
      return `    if (id === "${chunk.pageId}" && typeof ${fn} === "function") ${fn}();`;
    })
    .join("\n");

  return `(function(){
  var API = "/api/apps/${slug}/data";
  var pages = ${JSON.stringify(pageIds)};
  var navLinks = document.querySelectorAll(".app-nav a[data-route]");

  function showPage(id) {
    if (!id || id === "#") id = "${pageIds[0] || "home"}";
    pages.forEach(function(p){
      var el = document.querySelector('[data-page="' + p + '"]');
      if (el) el.classList.toggle("active", p === id);
    });
    navLinks.forEach(function(a){
      var route = a.getAttribute("data-route");
      var active = route === id || (route === "home" && id === "${pageIds[0] || "home"}");
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
${inits}
  }

  function routeFromHash() {
    var hash = (window.location.hash || "#/").replace(/^#\\/?/, "") || "${pageIds[0] || "home"}";
    if (hash === "" || hash === "/") hash = "${pageIds[0] || "home"}";
    showPage(hash.split("/")[0] || "${pageIds[0] || "home"}");
  }

  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();

  fetch(API + "?table_name=${plan.dataTables[0]?.name || "items"}", { credentials: "include" }).catch(function(){});
${pageChunks.map((c) => c.scriptFragment).join("\n")}
})();`;
}

export function assembleFullAppArtifact(
  plan: GenerationPlan,
  schema: FullAppSchema,
  slug: string,
  pageChunks: PageChunk[],
  appTitle?: string
): string {
  const title = appTitle || plan.summary.slice(0, 60) || "Portal";
  const navLinks = plan.pages
    .map((page) => {
      const routeKey = page.id === "home" ? "home" : page.id;
      return `<a href="${page.route}" data-route="${routeKey}">${page.title}</a>`;
    })
    .join("\n  ");

  const sections = pageChunks.map((c) => c.sectionHtml).join("\n\n  ");
  const firstPageId = plan.pages[0]?.id || "home";
  const sectionsWithActive = sections.replace(
    new RegExp(`(<section[^>]*data-page="${firstPageId}"[^>]*class="[^"]*)`, "i"),
    '$1 active'
  );

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${PORTAL_BASE_CSS}</style>
</head>
<body>
<nav class="app-nav" role="navigation" aria-label="Hoofdnavigatie">
  <span class="brand">${title.slice(0, 24)}</span>
  ${navLinks}
</nav>
<main>
  ${sectionsWithActive}
</main>
<script>
${buildSharedScript(plan, slug, pageChunks)}
</script>
</body>
</html>`;
}

export async function generateFullAppArtifactChunked(
  plan: GenerationPlan,
  slug: string,
  userPrompt: string,
  opts?: {
    signal?: AbortSignal;
    onProgress?: (progress: ChunkedGenerationProgress) => void;
    appTitle?: string;
  }
): Promise<ChunkedGenerationResult> {
  const schema = buildSchemaFromPlan(plan, slug);
  const pageChunks: PageChunk[] = [];
  const total = plan.pages.length;

  for (let i = 0; i < plan.pages.length; i++) {
    const page = plan.pages[i];
    opts?.onProgress?.({
      phase: "generating",
      message: `Pagina ${i + 1}/${total}: ${page.title}…`,
      pageIndex: i + 1,
      pageTotal: total,
      pageId: page.id,
    });
    const chunk = await generatePageChunk(plan, page, slug, userPrompt, {
      signal: opts?.signal,
    });
    pageChunks.push(chunk);
  }

  const frontend = assembleFullAppArtifact(plan, schema, slug, pageChunks, opts?.appTitle);

  return {
    schema,
    frontend,
    chunkCount: pageChunks.length,
    generationPath: "chunked",
    chunkModel: chunkModel(),
    pageChunks,
  };
}
