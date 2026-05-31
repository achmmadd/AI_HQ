import { anthropicComplete } from "@/lib/anthropic-messages";
import { getBuilderAnthropicModel } from "@/lib/fumero/builder-config";
import {
  assertDifyConfigured,
  generateArtifactHtml as generateArtifactHtmlViaDify,
} from "@/lib/artifact-html";
import {
  extractAppCodeFromFactoryOutput,
  normalizeAppCodeForPreview,
} from "@/lib/builder-code";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import { DEFAULT_CODE_MODEL_OPENROUTER } from "@/lib/code-agent/code-models";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";

import { loadFumeroBuilderDesignContext } from "@/lib/fumero/design-builder-context";

const BUILDER_HINT =
  "Lever één volledig HTML5-document met <!DOCTYPE html>, <html>, <head>, <body>, minstens één <script> zonder type=module, vanilla DOM (geen React/JSX). Tailwind mag via CDN in <head>. Geen markdown-fences; alleen ruwe HTML.";

function builderUseAnthropic(): boolean {
  return process.env.MOTOR_BUILDER_USE_ANTHROPIC?.trim() === "1";
}

function getBuilderOpenRouterModel(): string {
  return (
    process.env.MOTOR_BUILDER_MODEL?.trim() ||
    process.env.MOTOR_CODE_MODEL?.trim() ||
    DEFAULT_CODE_MODEL_OPENROUTER
  );
}

/** Code-generatie timeout (langer dan chat). Default 150s. */
function builderOpenRouterTimeoutMs(): number {
  const raw = process.env.MOTOR_BUILDER_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 150_000;
  return Number.isFinite(n) && n > 10_000 ? n : 150_000;
}

/** Minstens één goedkope builder-backend (Dify, OpenRouter of n8n Factory). */
export function assertArtifactBuilderConfigured(): boolean {
  if (assertDifyConfigured()) return true;
  if (isOpenRouterDirectConfigured()) return true;
  return true;
}

/**
 * Lenient gate voor builder-output: accepteert geldige (ook statische /
 * inline-handler) HTML-widgets en blokkeert alleen React/JSX/ES-modules die
 * niet in de srcDoc-sandbox draaien. De strikte `validateAppCode` uit
 * builder-code.ts weigerde correcte HTML zonder expliciete vanilla DOM-API's
 * (bv. een FAQ-accordion met <details> of inline onclick) — dat brak de
 * volledige generatie-keten.
 */
function rejectsForUnsupportedRuntime(code: string): string | null {
  if (/type\s*=\s*["']module["']/i.test(code)) {
    return "type=module wordt niet ondersteund in de preview-sandbox";
  }
  if (/^\s*import\s+[\s\S]*?\bfrom\b/m.test(code)) {
    return "ES-module imports worden niet ondersteund; gebruik plain <script>";
  }
  if (/^\s*export\s+(default|const|function|class|\{)/m.test(code)) {
    return "export-statements worden niet ondersteund in app-HTML";
  }
  if (/\bReactDOM\b|\bcreateRoot\s*\(/.test(code)) {
    return "React/ReactDOM wordt niet ondersteund; lever plain HTML + vanilla JS";
  }
  if (/\buseState\s*\(|\buseEffect\s*\(/.test(code)) {
    return "React-hooks worden niet ondersteund; lever plain HTML + vanilla JS";
  }
  return null;
}

function parseHtmlFromLlmText(
  text: string
): { html: string } | { error: string } {
  let code = extractAppCodeFromFactoryOutput(text);
  code = code
    .replace(/```(?:jsx?|tsx?|html?|javascript|react)?\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  if (!/<[a-z!/][\s\S]*>/i.test(code)) {
    return { error: "Geen HTML in het antwoord gevonden" };
  }

  const runtimeError = rejectsForUnsupportedRuntime(code);
  if (runtimeError) return { error: runtimeError };

  code = normalizeAppCodeForPreview(code);
  if (!code || code.length < 60) {
    return { error: "Gegenereerde HTML is te kort of leeg" };
  }
  return { html: code };
}

async function generateViaOpenRouter(
  userPrompt: string,
  maxAttempts: number
): Promise<{ html: string; attempts: number; error?: string }> {
  let lastError = "";
  const model = getBuilderOpenRouterModel();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint =
      attempt > 1
        ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: één volledig HTML-bestand met vanilla JS (geen React/JSX), geen import/export, geen markdown-fences.`
        : "";
    const query = `${BUILDER_HINT}\n\nBouw deze app: ${userPrompt.trim()}${retryHint}`;

    try {
      const { message } = await completeOpenRouterChat({
        model,
        messages: [{ role: "user", content: query }],
        // Code-generatie duurt langer dan een chat-turn; ruimere timeout + tokens
        // zodat een volledig HTML-document niet halverwege wordt afgekapt.
        maxTokens: 8000,
        signal: AbortSignal.timeout(builderOpenRouterTimeoutMs()),
      });
      const parsed = parseHtmlFromLlmText(message);
      if ("html" in parsed) {
        return { html: parsed.html, attempts: attempt };
      }
      lastError = parsed.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    html: "",
    attempts: maxAttempts,
    error: `OpenRouter mislukt na ${maxAttempts} pogingen: ${lastError}`,
  };
}

async function generateViaN8n(
  userPrompt: string,
  klant: string,
  afdeling: string,
  maxAttempts: number
): Promise<{ html: string; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint =
      attempt > 1
        ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: één volledig HTML-bestand met vanilla JS (geen React/JSX), geen import/export, geen markdown-fences.`
        : "";
    const query = `${BUILDER_HINT}\n\nBouw deze app: ${userPrompt.trim()}${retryHint}`;

    const { ok, data } = await callFactoryN8n({
      prompt: query,
      klant,
      afdeling,
      intent: "build",
      type: "artifact_html",
    });
    if (!ok) {
      lastError = extractMessage(data) || "n8n Factory webhook failed";
      continue;
    }

    const parsed = parseHtmlFromLlmText(extractMessage(data));
    if ("html" in parsed) {
      return { html: parsed.html, attempts: attempt };
    }
    lastError = parsed.error;
  }

  return {
    html: "",
    attempts: maxAttempts,
    error: `n8n mislukt na ${maxAttempts} pogingen: ${lastError}`,
  };
}

async function generateViaAnthropic(
  userPrompt: string,
  maxAttempts: number
): Promise<{ html: string; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint =
      attempt > 1
        ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: één volledig HTML-bestand met vanilla JS (geen React/JSX), geen import/export, geen markdown-fences.`
        : "";
    const query = `${BUILDER_HINT}\n\nBouw deze app: ${userPrompt.trim()}${retryHint}`;

    try {
      const { text } = await anthropicComplete({
        system: "Je bent een HTML/CSS/JS builder. Antwoord alleen met geldige HTML.",
        messages: [{ role: "user", content: query }],
        maxTokens: 8000,
        model: getBuilderAnthropicModel(),
      });
      const parsed = parseHtmlFromLlmText(text);
      if ("html" in parsed) {
        return { html: parsed.html, attempts: attempt };
      }
      lastError = parsed.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    html: "",
    attempts: maxAttempts,
    error: `Anthropic mislukt na ${maxAttempts} pogingen: ${lastError}`,
  };
}

export type ArtifactGenerateOptions = {
  /** Fumero serious builds: Anthropic Sonnet → OpenRouter builder vóór Dify/n8n. */
  preferStrongBuilder?: boolean;
};

export async function generateArtifactHtml(
  userPrompt: string,
  klant: string,
  afdeling: string,
  maxAttempts = 3,
  opts?: ArtifactGenerateOptions
): Promise<{ html: string; attempts: number; error?: string }> {
  const errors: string[] = [];
  const preferStrong = opts?.preferStrongBuilder === true;
  const fumeroDesign =
    klant === "fumero" && (afdeling === "tools" || afdeling === "fumero")
      ? loadFumeroBuilderDesignContext()
      : "";
  const promptWithDesign = fumeroDesign
    ? `${userPrompt}\n\n${fumeroDesign}`
    : userPrompt;

  if (preferStrong) {
    if (builderUseAnthropic()) {
      const anthropic = await generateViaAnthropic(promptWithDesign, maxAttempts);
      if (anthropic.html) return anthropic;
      if (anthropic.error) errors.push(anthropic.error);
    }
    if (isOpenRouterDirectConfigured()) {
      const openrouter = await generateViaOpenRouter(promptWithDesign, maxAttempts);
      if (openrouter.html) return openrouter;
      if (openrouter.error) errors.push(openrouter.error);
    }
  }

  if (assertDifyConfigured()) {
    const dify = await generateArtifactHtmlViaDify(
      promptWithDesign,
      klant,
      afdeling,
      maxAttempts
    );
    if (dify.html) return dify;
    if (dify.error) errors.push(dify.error);
  }

  if (isOpenRouterDirectConfigured()) {
    const openrouter = await generateViaOpenRouter(promptWithDesign, maxAttempts);
    if (openrouter.html) return openrouter;
    if (openrouter.error) errors.push(openrouter.error);
  }

  const n8n = await generateViaN8n(promptWithDesign, klant, afdeling, maxAttempts);
  if (n8n.html) return n8n;
  if (n8n.error) errors.push(n8n.error);

  if (!preferStrong && builderUseAnthropic()) {
    const anthropic = await generateViaAnthropic(promptWithDesign, maxAttempts);
    if (anthropic.html) return anthropic;
    if (anthropic.error) errors.push(anthropic.error);
  }

  return {
    html: "",
    attempts: maxAttempts,
    error:
      errors.join(" | ") ||
      "Geen builder-backend beschikbaar (Dify, OpenRouter, n8n).",
  };
}

/* ===================== FASE 2: Full-App Factory generator =====================
   Reuses the Anthropic / OpenRouter builder legs (MOTOR_BUILDER_* + Claude Sonnet).
   Enforces strict <<<SCHEMA>>> + <<<FRONTEND>>> contract so generated apps can
   read/write real data via the /api/apps/[slug]/data endpoint (Fase1).
*/

const APP_FACTORY_SYSTEM = "Je bent een precieze full-stack app generator voor interne/b2b tools. Antwoord ALLEEN met de exacte <<<SCHEMA>>> en <<<FRONTEND>>> blokken (geen markdown, geen extra tekst, geen uitleg).";

const APP_FACTORY_BASE_INSTRUCTIONS = `
Bouw een VOLLEDIGE standalone web-applicatie (geen widget, geen "embed", geen chat-only ding).
Mobiel-first, responsive, productie-kwaliteit UX.

STRICTE OUTPUT CONTRACT — KOPIEER EXACT DIT FORMAAT (niets erbuiten de blokken):

<<<SCHEMA>>>
{"tables":[{"name":"products","columns":[{"name":"id","type":"integer","pk":true},{"name":"naam","type":"text","required":true},{"name":"aantal","type":"integer","default":0},{"name":"sku","type":"text"}]}]}
<<<END>>>
<<<FRONTEND>>>
<!DOCTYPE html>
<html lang="nl"><head>...</head><body>...</body></html>
<<<END>>>

REGELS VOOR DE GENERATIE:
- Volledig HTML5 document: <!DOCTYPE html>, <html>, <head> (meta viewport), <body>, exact één <script> (geen type=module, geen import/export statements).
- Tailwind via CDN is toegestaan: <script src="https://cdn.tailwindcss.com"></script> + inline config script voor kleuren.
- Fumero ops-stijl (indien van toepassing): rustig professioneel B2B, system-ui font, witte of #FAFAFA achtergrond, #69C400 alleen voor primaire acties/knoppen, geen emoji in chrome/UI-chrome, goede contrasten en toegankelijkheid.
- De app-slug is: __SLUG__ — HARDCODE deze letterlijk in ALLE fetch URLs: "/api/apps/__SLUG__/data"
- ALLE data-operaties (create/read/update/delete) MOETEN via echte fetch() naar de data-API gaan. Nooit localStorage, mocks of hardcoded demo data.
  Voorbeelden (exacte payloads):
    - Lijst:  GET /api/apps/__SLUG__/data?table_name=products   →  { app_slug, table_name, klant, rows: [{__id, ...velden, __created_at, __updated_at}, ...] }
    - Toevoegen: POST /api/apps/__SLUG__/data   body: {table_name:"products", row:{naam:"..", aantal:5}}  →  {ok,id,row}
    - Wijzig: PATCH /...   body: {table_name, id: <__id>, row: {aantal: 12}}
    - Verwijder: DELETE /...  body of query: {table_name, id: <__id>}
- db_schema JSON moet valide zijn, "tables" array met >=1 entry, kolommen beschrijven precies wat de frontend gebruikt (id, naam, etc).
- UI moet minimaal bevatten: formulier om records toe te voegen, overzichtslijst/tabel met alle records, inline edit (bijv. aantal aanpassen), delete knop met confirm, search/filter, lege-state, loading indicators, nette error handling (toasts of inline meldingen).
- Gebruik de gebruikerswens: __USER_PROMPT__
- Na je antwoord moet de frontend-code de exacte /api/apps/__SLUG__/data URL's bevatten — anders faalt validatie.

Lever ALLEEN de twee <<< >>> blokken. Geen enkele andere tekst.
`.trim();

function buildFullAppPrompt(userPrompt: string, slug: string): string {
  return APP_FACTORY_BASE_INSTRUCTIONS
    .replace(/__SLUG__/g, slug)
    .replace(/__USER_PROMPT__/g, userPrompt.trim());
}

function parseAppFactoryOutput(
  text: string,
  expectedSlug: string
): { schema: any; frontend: string } | { error: string } {
  const schemaRe = /<<<SCHEMA>>>\s*([\s\S]*?)\s*<<<END>>>/i;
  const feRe = /<<<FRONTEND>>>\s*([\s\S]*?)\s*<<<END>>>/i;

  const sMatch = text.match(schemaRe);
  if (!sMatch) {
    return { error: "Geen <<<SCHEMA>>> blok gevonden. Volg exact het vereiste formaat." };
  }
  let schemaStr = sMatch[1].trim().replace(/```json|```/gi, "").trim();
  let schema: any;
  try {
    schema = JSON.parse(schemaStr);
  } catch (e: any) {
    return { error: `Ongeldige JSON in <<<SCHEMA>>>: ${e?.message || e}` };
  }
  if (!schema || !Array.isArray(schema.tables) || schema.tables.length < 1) {
    return { error: "Schema moet { \"tables\": [ { \"name\": \"..\", \"columns\": [...] }, ... ] } bevatten met minstens 1 tabel" };
  }

  const fMatch = text.match(feRe);
  if (!fMatch) {
    return { error: "Geen <<<FRONTEND>>> blok gevonden." };
  }
  let frontend = fMatch[1].trim().replace(/```html|```/gi, "").trim();

  if (!/<!DOCTYPE|<html[\s>]/i.test(frontend)) {
    return { error: "Frontend moet een volledig HTML-document zijn (<!DOCTYPE of <html>)" };
  }
  const dataPath = `/api/apps/${expectedSlug}/data`;
  if (!frontend.includes(dataPath)) {
    return { error: `Frontend mist verwijzingen naar ${dataPath} — alle fetch-calls moeten de exacte slug gebruiken` };
  }
  if (!/fetch\s*\(/i.test(frontend)) {
    return { error: "Geen fetch()-aanroepen gevonden voor de data API" };
  }

  const runtimeError = rejectsForUnsupportedRuntime(frontend);
  if (runtimeError) {
    return { error: runtimeError };
  }
  if (frontend.length < 600) {
    return { error: "Gegenereerde frontend HTML is te kort (<600 chars)" };
  }
  return { schema, frontend };
}

export async function generateFullAppArtifact(
  userPrompt: string,
  slug: string,
  maxAttempts = 2
): Promise<{ schema: any; frontend: string; attempts: number; error?: string }> {
  if (!userPrompt?.trim()) {
    return { schema: null, frontend: "", attempts: 0, error: "Lege prompt voor full-app" };
  }
  const base = buildFullAppPrompt(userPrompt, slug);
  let lastError = "";

  // 1. Sterke Claude Sonnet pad (MOTOR_BUILDER_USE_ANTHROPIC + ANTHROPIC_MODEL of default sonnet)
  if (builderUseAnthropic()) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryHint =
        attempt > 1
          ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: lever EXACT de <<<SCHEMA>>> + <<<FRONTEND>>> blokken met correcte fetches naar /api/apps/${slug}/data en valide JSON schema.`
          : "";
      const query = `${base}${retryHint}`;

      try {
        const { text } = await anthropicComplete({
          system: APP_FACTORY_SYSTEM,
          messages: [{ role: "user", content: query }],
          maxTokens: 14000,
          model: getBuilderAnthropicModel(),
        });
        const parsed = parseAppFactoryOutput(text, slug);
        if ("schema" in parsed) {
          return { schema: parsed.schema, frontend: parsed.frontend, attempts: attempt };
        }
        lastError = parsed.error;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // 2. OpenRouter builder model (MOTOR_BUILDER_MODEL) als fallback
  if (isOpenRouterDirectConfigured()) {
    const model = getBuilderOpenRouterModel();
    const timeout = builderOpenRouterTimeoutMs();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryHint =
        attempt > 1
          ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: lever EXACT de <<<SCHEMA>>> + <<<FRONTEND>>> blokken met correcte fetches naar /api/apps/${slug}/data en valide JSON schema.`
          : "";
      const query = `${base}${retryHint}`;

      try {
        const { message } = await completeOpenRouterChat({
          model,
          messages: [{ role: "user", content: query }],
          maxTokens: 14000,
          signal: AbortSignal.timeout(timeout),
        });
        const parsed = parseAppFactoryOutput(message, slug);
        if ("schema" in parsed) {
          return { schema: parsed.schema, frontend: parsed.frontend, attempts: attempt };
        }
        lastError = parsed.error;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return {
    schema: null,
    frontend: "",
    attempts: maxAttempts,
    error: lastError || "Geen geschikte builder-backend beschikbaar voor full-app (Anthropic/OpenRouter).",
  };
}
