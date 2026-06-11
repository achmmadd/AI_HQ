import {
  checkJsSyntaxWithNode,
  extractScriptBodies,
  validateGeneratedHtml,
} from "@/lib/fumero/build-validation";
import {
  MIN_UX_PUBLISH_SCORE,
  runBuildSmokeTest,
  type SmokeTestResult,
} from "@/lib/fumero/build-smoke-test";
import {
  isMultiPagePrompt,
  isShopPrompt,
} from "@/lib/fumero/build-prompt-heuristics";
import { isDummyPlaceholderHtml } from "@/lib/fumero/reference-html-guards";
import { runRuleBasedUxCheck } from "@/lib/connectors/specialists";

export { isMultiPagePrompt, isShopPrompt } from "@/lib/fumero/build-prompt-heuristics";

export type FullAppPage = {
  id: string;
  title?: string;
  route?: string;
  auth?: boolean;
};

export type FullAppSchema = {
  tables?: Array<{
    name: string;
    columns?: unknown[];
    seed_rows?: Record<string, unknown>[];
  }>;
  pages?: FullAppPage[];
  auth?: { required?: boolean; age_gate?: boolean };
  meta?: Record<string, unknown>;
};

export function parseFullAppSchema(schema: unknown): FullAppSchema | null {
  if (!schema || typeof schema !== "object") return null;
  return schema as FullAppSchema;
}

function hasNavElement(html: string): boolean {
  return (
    /<nav\b/i.test(html) ||
    /role\s*=\s*["']navigation["']/i.test(html) ||
    /class\s*=\s*["'][^"']*\b(app-)?nav\b/i.test(html)
  );
}

function hasPageRouting(html: string): boolean {
  const script = extractScriptBodies(html).join("\n");
  const hashRouter =
    /location\.hash|hashchange|#\/|#shop|#checkout|#dashboard/i.test(html + script);
  const dataPageRouter =
    /data-page\s*=|dataset\.page|getAttribute\s*\(\s*["']data-page["']\s*\)/i.test(
      html + script
    );
  return hashRouter || dataPageRouter;
}

function hasActiveNavState(html: string): boolean {
  const script = extractScriptBodies(html).join("\n");
  return (
    /\bactive\b/i.test(html) &&
    (/classList\.(add|remove|toggle)\s*\(\s*["']active["']/i.test(script) ||
      /\.active\b/i.test(html) ||
      /aria-current\s*=\s*["']page["']/i.test(html))
  );
}

export function validateFullAppSchema(
  schema: FullAppSchema,
  opts?: { requireMultiPage?: boolean }
): string[] {
  const errors: string[] = [];
  const tables = schema.tables;
  if (!Array.isArray(tables) || tables.length < 1) {
    errors.push("Schema mist minstens één tabel in tables[]");
    return errors;
  }
  for (const t of tables) {
    if (!t?.name || typeof t.name !== "string") {
      errors.push("Elke tabel moet een name hebben");
      break;
    }
  }

  const pages = schema.pages;
  if (opts?.requireMultiPage) {
    if (!Array.isArray(pages) || pages.length < 2) {
      errors.push(
        "Multi-page prompt vereist pages[] in schema met minstens 2 pagina's (home, shop, checkout, dashboard)"
      );
    } else {
      for (const page of pages) {
        if (!page?.id) {
          errors.push("Elke page in schema moet een id hebben");
          break;
        }
      }
    }
  }

  return errors;
}

function usesLocalStoragePersistence(frontend: string): boolean {
  const script = extractScriptBodies(frontend).join("\n");
  return /\blocalStorage\s*\.\s*(setItem|getItem)\b/.test(script + frontend);
}

function hasCrudMutations(frontend: string): boolean {
  const script = extractScriptBodies(frontend).join("\n");
  const hasPost =
    /method\s*:\s*["']POST["']/i.test(script) ||
    /method\s*:\s*["']post["']/i.test(script);
  const hasPatchOrDelete =
    /method\s*:\s*["']PATCH["']/i.test(script) ||
    /method\s*:\s*["']DELETE["']/i.test(script) ||
    /method\s*:\s*["']patch["']/i.test(script) ||
    /method\s*:\s*["']delete["']/i.test(script);
  return hasPost && hasPatchOrDelete;
}

function hasWidgetWrapperLayout(frontend: string): boolean {
  if (/class\s*=\s*["'][^"']*\bwidget\b/i.test(frontend)) return true;
  if (/max-width\s*:\s*480px/i.test(frontend) && !/max-width\s*:\s*1200px/i.test(frontend)) {
    return true;
  }
  return false;
}

export function validateFullAppSchemaSeedData(schema: FullAppSchema): string[] {
  const errors: string[] = [];
  const tables = schema.tables ?? [];
  if (tables.length < 1) return errors;
  const withSeed = tables.filter(
    (t) => Array.isArray(t.seed_rows) && t.seed_rows.length >= 1
  );
  if (withSeed.length < 1) {
    errors.push("Schema mist demo seed_rows in minstens één tabel");
  }
  return errors;
}

export function validateFullAppFrontend(
  frontend: string,
  slug: string,
  schema?: FullAppSchema,
  opts?: { requireMultiPage?: boolean; requireCrud?: boolean; requirePortalLayout?: boolean }
): string[] {
  const errors: string[] = [];
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const dataPath = `/api/apps/${safeSlug}/data`;

  if (!frontend.includes(dataPath)) {
    errors.push(
      `Frontend mist fetch-URL's naar ${dataPath} — gebruik exact deze slug in alle data-aanroepen`
    );
  }
  if (!/fetch\s*\(/i.test(frontend)) {
    errors.push("Frontend mist fetch()-aanroepen voor de data-API");
  }

  if (usesLocalStoragePersistence(frontend)) {
    errors.push("Frontend gebruikt localStorage voor persistentie — gebruik /api/apps/{slug}/data");
  }

  if (opts?.requireCrud !== false && /fetch\s*\(/i.test(frontend)) {
    if (!hasCrudMutations(frontend)) {
      errors.push("Frontend mist CRUD-mutaties (POST én PATCH/DELETE) naar de data-API");
    }
  }

  if (opts?.requirePortalLayout !== false && opts?.requireMultiPage) {
    if (hasWidgetWrapperLayout(frontend)) {
      errors.push("Portal-app lijkt een embed-widget (480px) — gebruik full-width portal layout");
    }
  }

  if (opts?.requireMultiPage) {
    if (!hasNavElement(frontend)) {
      errors.push("Multi-page app mist shared <nav> of navigatie-element");
    }
    if (!hasPageRouting(frontend)) {
      errors.push(
        "Multi-page app mist client-side routing (hash-router of data-page switching)"
      );
    }
    if (!hasActiveNavState(frontend)) {
      errors.push("Navigatie mist active state (class active of aria-current=page)");
    }
    const pageCount = Array.isArray(schema?.pages) ? schema!.pages!.length : 0;
    if (pageCount >= 2) {
      const combined = frontend.toLowerCase();
      const missing = (schema!.pages ?? []).filter((p) => {
        const id = p.id.toLowerCase();
        return !combined.includes(id) && !(p.route && combined.includes(p.route.toLowerCase()));
      });
      if (missing.length > pageCount / 2) {
        errors.push(
          `Frontend dekt niet alle schema-pagina's (ontbrekend: ${missing
            .map((p) => p.id)
            .slice(0, 4)
            .join(", ")})`
        );
      }
    }
  }

  return errors;
}

export type ValidateFullAppResult = {
  valid: boolean;
  errors: string[];
};

export function validateFullAppArtifact(
  frontend: string,
  schema: unknown,
  slug: string,
  prompt?: string,
  opts?: { builderVersion?: number }
): ValidateFullAppResult {
  const errors: string[] = [];
  const parsed = parseFullAppSchema(schema);
  if (!parsed) {
    return { valid: false, errors: ["Ongeldig db_schema JSON"] };
  }

  const requireMultiPage = isMultiPagePrompt(prompt ?? "");
  const isV2 = opts?.builderVersion === 2 || parsed.meta?.builder_version === 2;
  errors.push(...validateFullAppSchema(parsed, { requireMultiPage }));
  if (isV2) {
    errors.push(...validateFullAppSchemaSeedData(parsed));
  }
  errors.push(
    ...validateFullAppFrontend(frontend, slug, parsed, {
      requireMultiPage,
      requireCrud: isV2,
      requirePortalLayout: isV2,
    })
  );

  const htmlValidation = validateGeneratedHtml(frontend);
  if (!htmlValidation.valid) {
    errors.push(...htmlValidation.errors);
  }

  const unique = [...new Set(errors)];
  return { valid: unique.length === 0, errors: unique };
}

export function runFullAppSmokeTest(
  frontend: string,
  schema: unknown,
  slug: string,
  prompt?: string
): SmokeTestResult {
  const errors: string[] = [];

  if (isDummyPlaceholderHtml(frontend)) {
    errors.push("Placeholder-HTML gedetecteerd — geen definitieve app-output");
  }

  const validation = validateFullAppArtifact(frontend, schema, slug, prompt);
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  const baseSmoke = runBuildSmokeTest(frontend);
  if (!baseSmoke.passed) {
    errors.push(...baseSmoke.errors);
  }

  const ux = runRuleBasedUxCheck(frontend);
  const uxFailedItems = ux.items.filter((i) => !i.pass).map((i) => i.label);
  const uxScore = ux.score;
  if (uxScore < MIN_UX_PUBLISH_SCORE) {
    errors.push(
      `UX-score te laag (${uxScore}/${MIN_UX_PUBLISH_SCORE} minimaal) — ${uxFailedItems
        .slice(0, 3)
        .join(", ")}`
    );
  }

  const scripts = extractScriptBodies(frontend);
  const script = scripts.join("\n\n");
  if (script) {
    const syntaxErr = checkJsSyntaxWithNode(script);
    if (syntaxErr) {
      errors.push(`JavaScript syntax: ${syntaxErr.split("\n")[0]}`);
    }
  }

  const unique = [...new Set(errors)];
  return {
    passed: unique.length === 0,
    errors: unique,
    uxScore,
    uxFailedItems,
  };
}

export function getFullAppPreviewValidation(
  frontend: string,
  schema: unknown,
  slug: string,
  prompt?: string
): { preview_interactive: boolean; validation_errors: string[] } {
  const result = validateFullAppArtifact(frontend, schema, slug, prompt);
  return {
    preview_interactive: result.valid,
    validation_errors: result.errors,
  };
}

export function getFullAppUxCheck(frontend: string): {
  score: number;
  items: ReturnType<typeof runRuleBasedUxCheck>["items"];
} {
  const { score, items } = runRuleBasedUxCheck(frontend);
  return { score, items };
}

/** NL publish-gate message (één regel, zoals publishTool). */
export function formatFullAppPublishError(errors: string[]): string {
  const top = errors.slice(0, 4).join("; ");
  return `Publiceren geblokkeerd: ${top}`;
}

/** Fase 2: publish gate when auth_required=1 on app record. */
export function validateAuthRequiredApp(
  frontend: string,
  schema: unknown,
  slug: string
): string[] {
  const errors: string[] = [];
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const authBase = `/api/apps/${safeSlug}/auth`;
  if (!frontend.includes(`${authBase}/login`) && !frontend.includes(`${authBase}/session`)) {
    errors.push(
      `Auth vereist maar frontend mist auth API (${authBase}/login of /session)`
    );
  }
  const combined = frontend.toLowerCase();
  if (!combined.includes("login") && !combined.includes("inlog")) {
    errors.push("Auth vereist maar geen login-pagina of -flow gevonden");
  }
  if (!/18\s*jaar\s*en\s*ouder/i.test(frontend)) {
    errors.push('Auth vereist maar 18+-gate ontbreekt ("18 jaar en ouder")');
  }
  const parsed = parseFullAppSchema(schema);
  const pages = parsed?.pages ?? [];
  const hasLoginPage = pages.some((p) => /login|register/i.test(p.id));
  if (pages.length >= 2 && !hasLoginPage && !combined.includes("#/login")) {
    errors.push("Auth vereist maar schema mist login/register page");
  }
  return errors;
}

/** Fase 4: shop publish checklist (KB facts + tables). */
export function validateShopApp(frontend: string, schema: unknown): string[] {
  const errors: string[] = [];
  const parsed = parseFullAppSchema(schema);
  const tableNames = new Set((parsed?.tables ?? []).map((t) => t.name));
  for (const required of ["products", "orders"]) {
    if (!tableNames.has(required)) {
      errors.push(`Shop mist verplichte tabel "${required}" in schema`);
    }
  }
  const lower = frontend.toLowerCase();
  if (!lower.includes("checkout") && !lower.includes("afreken")) {
    errors.push("Shop mist checkout-pagina of -flow");
  }
  const badPayment =
    /\bideal\b/i.test(frontend) && !/geen\s+ideal|niet\s+ideal|no\s+ideal/i.test(frontend);
  const badPaypal = /\bpaypal\b/i.test(frontend);
  const badCard = /\bcredit\s*card\b|\bcreditcard\b/i.test(frontend);
  if (badPayment || badPaypal || badCard) {
    errors.push("Shop copy mag geen iDEAL, PayPal of creditcard vermelden (alleen bank + crypto)");
  }
  if (!/€\s*49|49\s*euro|minimum.*49/i.test(frontend)) {
    errors.push("Shop mist minimum bestelling €49 in checkout-copy");
  }
  if (!/18\s*jaar\s*en\s*ouder/i.test(frontend)) {
    errors.push('Shop mist 18+-vermelding ("18 jaar en ouder")');
  }
  return errors;
}
