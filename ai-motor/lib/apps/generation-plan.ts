import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";

export type GenerationPlanPage = {
  id: string;
  title: string;
  route: string;
  purpose: string;
};

export type GenerationPlanDataTable = {
  name: string;
  purpose: string;
  columns: Array<{ name: string; type: "text" | "number" | "integer" | "boolean" | "date"; required?: boolean }>;
};

export type GenerationPlanComponent = {
  id: string;
  purpose: string;
  pages: string[];
};

export type GenerationPlan = {
  version: 2;
  appType: string;
  summary: string;
  pages: GenerationPlanPage[];
  dataTables: GenerationPlanDataTable[];
  components: GenerationPlanComponent[];
  acceptanceCriteria: string[];
  risks: string[];
  model?: string;
  fallback?: boolean;
};

export type PlanValidationResult =
  | { ok: true; plan: GenerationPlan }
  | { ok: false; errors: string[] };

function plannerModel(): string {
  return (
    process.env.MOTOR_MODEL_PLANNER?.trim() ||
    process.env.MOTOR_LONG_AGENT_MODEL?.trim() ||
    process.env.MOTOR_MODEL_SECONDARY?.trim() ||
    process.env.MOTOR_AGENT_MODEL?.trim() ||
    "moonshotai/kimi-k2"
  );
}

function cleanId(input: string, fallback: string): string {
  const id = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return id || fallback;
}

function cleanTableName(input: string, fallback: string): string {
  const name = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return name || fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

function sanitizePlanText(value: string): string {
  return value
    .replace(/\blocalStorage\b/gi, "de /api/apps/{slug}/data API")
    .replace(/\bzonder backend\b/gi, "met de generieke data-API")
    .replace(/\bzonder internetverbinding of backend\b/gi, "met de generieke data-API")
    .replace(/\bclient-side zonder backend\b/gi, "client-side met de generieke data-API")
    .trim();
}

function sanitizePlanTexts(values: string[]): string[] {
  return values
    .map(sanitizePlanText)
    .filter((value) => value && !/geen mogelijkheid tot back-up|niet beveiligd/i.test(value));
}

function normalizeColumns(value: unknown): GenerationPlanDataTable["columns"] {
  const allowed = new Set(["text", "number", "integer", "boolean", "date"]);
  if (!Array.isArray(value)) return [];
  const columns: GenerationPlanDataTable["columns"] = [];
  for (const [idx, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      const name = cleanTableName(String(rec.name || ""), `field_${idx + 1}`);
      const typeRaw = String(rec.type || "text").toLowerCase();
      const type = allowed.has(typeRaw)
        ? (typeRaw as GenerationPlanDataTable["columns"][number]["type"])
        : "text";
    columns.push({ name, type, required: rec.required === true });
    if (columns.length >= 16) break;
  }
  return columns;
}

export function validateGenerationPlan(input: unknown): PlanValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Plan is geen object"] };
  }
  const raw = input as Record<string, unknown>;
  const pagesRaw = Array.isArray(raw.pages) ? raw.pages : [];
  const tablesRaw = Array.isArray(raw.dataTables) ? raw.dataTables : [];
  const componentsRaw = Array.isArray(raw.components) ? raw.components : [];

  const pages: GenerationPlanPage[] = pagesRaw
    .map((p, idx) => {
      if (!p || typeof p !== "object") return null;
      const rec = p as Record<string, unknown>;
      const id = cleanId(String(rec.id || rec.title || ""), `page-${idx + 1}`);
      const title = String(rec.title || id).trim().slice(0, 80);
      const routeRaw = String(rec.route || `#/${id === "home" ? "" : id}`).trim();
      return {
        id,
        title: title || id,
        route: routeRaw.startsWith("#") ? routeRaw : `#/${id}`,
        purpose: sanitizePlanText(String(rec.purpose || title || id)).slice(0, 220),
      };
    })
    .filter((p): p is GenerationPlanPage => Boolean(p))
    .slice(0, 10);

  const dataTables: GenerationPlanDataTable[] = tablesRaw
    .map((t, idx) => {
      if (!t || typeof t !== "object") return null;
      const rec = t as Record<string, unknown>;
      const name = cleanTableName(String(rec.name || ""), `items_${idx + 1}`);
      const columns = normalizeColumns(rec.columns);
      return {
        name,
        purpose: sanitizePlanText(String(rec.purpose || name)).slice(0, 220),
        columns: columns.length
          ? columns
          : [
              { name: "id", type: "integer" as const, required: true },
              { name: "naam", type: "text" as const, required: true },
              { name: "status", type: "text" as const },
            ],
      };
    })
    .filter((t): t is GenerationPlanDataTable => Boolean(t))
    .slice(0, 8);

  const components: GenerationPlanComponent[] = componentsRaw
    .map((c, idx) => {
      if (!c || typeof c !== "object") return null;
      const rec = c as Record<string, unknown>;
      const id = cleanId(String(rec.id || ""), `component-${idx + 1}`);
      return {
        id,
        purpose: sanitizePlanText(String(rec.purpose || id)).slice(0, 220),
        pages: asStringArray(rec.pages),
      };
    })
    .filter((c): c is GenerationPlanComponent => Boolean(c))
    .slice(0, 12);

  if (pages.length < 1) errors.push("Plan mist pages[]");
  if (dataTables.length < 1) errors.push("Plan mist dataTables[]");

  const plan: GenerationPlan = {
    version: 2,
    appType: String(raw.appType || "custom_app").trim().slice(0, 80) || "custom_app",
    summary: sanitizePlanText(String(raw.summary || "")).slice(0, 500),
    pages,
    dataTables,
    components,
    acceptanceCriteria: sanitizePlanTexts(asStringArray(raw.acceptanceCriteria)),
    risks: sanitizePlanTexts(asStringArray(raw.risks)),
    model: typeof raw.model === "string" ? raw.model : undefined,
    fallback: raw.fallback === true,
  };

  if (!plan.summary) plan.summary = `Genereer een ${plan.appType}`;
  if (plan.acceptanceCriteria.length < 1) {
    plan.acceptanceCriteria = [
      "De app gebruikt de echte /api/apps/{slug}/data API voor CRUD.",
      "De UI heeft loading, empty state en foutmeldingen.",
    ];
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan };
}

function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*|\s*```$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Geen JSON-object in planrespons");
    return JSON.parse(match[0]);
  }
}

function hasAny(prompt: string, words: string[]): boolean {
  const p = prompt.toLowerCase();
  return words.some((w) => p.includes(w));
}

export function createFallbackGenerationPlan(prompt: string): GenerationPlan {
  const p = prompt.toLowerCase();
  const pages: GenerationPlanPage[] = [];
  const addPage = (id: string, title: string, purpose: string) => {
    if (pages.some((page) => page.id === id)) return;
    pages.push({ id, title, route: id === "home" ? "#/" : `#/${id}`, purpose });
  };

  addPage("home", "Overzicht", "Startscherm met belangrijkste acties en recente items");
  if (hasAny(p, ["dashboard", "portaal", "overzicht"])) {
    addPage("dashboard", "Dashboard", "KPI's, filters en samenvattingen");
  }
  if (hasAny(p, ["project", "projecten"])) {
    addPage("projecten", "Projecten", "Projectlijst met status en detailnavigatie");
  }
  if (hasAny(p, ["taak", "taken", "todo", "takenlijst"])) {
    addPage("taken", "Taken", "Taken toevoegen, afvinken, bewerken en verwijderen");
  }
  if (hasAny(p, ["klant", "klanten", "crm"])) {
    addPage("klanten", "Klanten", "Klantgegevens en gekoppelde activiteiten");
  }
  if (hasAny(p, ["team", "leden", "medewerker"])) {
    addPage("team", "Team", "Teamleden, rollen en beschikbaarheid");
  }
  if (hasAny(p, ["admin", "beheer"])) {
    addPage("admin", "Admin", "Beheerweergave met tabellen en snelle acties");
  }

  const dataTables: GenerationPlanDataTable[] = [];
  const addTable = (name: string, purpose: string, columns: GenerationPlanDataTable["columns"]) => {
    if (dataTables.some((table) => table.name === name)) return;
    dataTables.push({ name, purpose, columns });
  };

  if (hasAny(p, ["project", "projecten"])) {
    addTable("projects", "Projecten met status, klant en voortgang", [
      { name: "id", type: "integer", required: true },
      { name: "naam", type: "text", required: true },
      { name: "status", type: "text" },
      { name: "klant", type: "text" },
      { name: "deadline", type: "date" },
    ]);
  }
  if (hasAny(p, ["taak", "taken", "todo", "takenlijst"])) {
    addTable("tasks", "Taken met status, prioriteit en koppeling", [
      { name: "id", type: "integer", required: true },
      { name: "titel", type: "text", required: true },
      { name: "status", type: "text" },
      { name: "prioriteit", type: "text" },
      { name: "done", type: "boolean" },
    ]);
  }
  if (hasAny(p, ["klant", "klanten", "crm"])) {
    addTable("customers", "Klanten en contactinformatie", [
      { name: "id", type: "integer", required: true },
      { name: "naam", type: "text", required: true },
      { name: "email", type: "text" },
      { name: "status", type: "text" },
    ]);
  }
  if (hasAny(p, ["team", "leden", "medewerker"])) {
    addTable("team_members", "Teamleden en rollen", [
      { name: "id", type: "integer", required: true },
      { name: "naam", type: "text", required: true },
      { name: "rol", type: "text" },
      { name: "beschikbaar", type: "boolean" },
    ]);
  }
  if (dataTables.length === 0) {
    addTable("items", "Algemene records voor deze app", [
      { name: "id", type: "integer", required: true },
      { name: "naam", type: "text", required: true },
      { name: "status", type: "text" },
      { name: "notitie", type: "text" },
    ]);
  }

  const components: GenerationPlanComponent[] = [
    {
      id: "record-form",
      purpose: "Formulier voor toevoegen en bewerken van records",
      pages: pages.map((page) => page.id),
    },
    {
      id: "record-list",
      purpose: "Lijst of tabel met zoekfunctie, filters en acties",
      pages: pages.map((page) => page.id),
    },
  ];
  if (pages.length > 1) {
    components.unshift({
      id: "app-navigation",
      purpose: "Shared navigatie met active state en hash routing",
      pages: pages.map((page) => page.id),
    });
  }

  return {
    version: 2,
    appType: hasAny(p, ["dashboard", "portaal"]) ? "portal" : "custom_app",
    summary: prompt.trim().slice(0, 500) || "Generieke data-gedreven app",
    pages,
    dataTables,
    components,
    acceptanceCriteria: [
      "Alle CRUD-acties gebruiken fetch naar /api/apps/{slug}/data.",
      "De app toont loading, empty state, validatie en foutmeldingen.",
      "Navigatie en filters werken zonder page reload.",
    ],
    risks: [
      "LLM-output kan validatie missen; v2 voert gerichte repair uit.",
    ],
    model: "heuristic",
    fallback: true,
  };
}

export async function createGenerationPlan(
  prompt: string,
  context?: { slug?: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<GenerationPlan> {
  const fallback = createFallbackGenerationPlan(prompt);
  if (!isOpenRouterDirectConfigured()) return fallback;

  const model = plannerModel();
  const timeoutMs = Math.min(Math.max(context?.timeoutMs ?? 45_000, 10_000), 120_000);
  const signal = context?.signal ?? AbortSignal.timeout(timeoutMs);
  const plannerPrompt = [
    "Maak een generiek Builder v2 generatieplan voor een standalone data-gedreven web-app.",
    "Antwoord uitsluitend met valide JSON, geen markdown.",
    "Gebruik geen hardcoded template. Leid pages, dataTables, components en criteria af uit de gebruikerswens.",
    "Gebruik altijd de echte /api/apps/{slug}/data API voor opslag. Noem nooit localStorage, offline-only of zonder-backend opslag.",
    "Schema:",
    '{"version":2,"appType":"...","summary":"...","pages":[{"id":"home","title":"...","route":"#/...","purpose":"..."}],"dataTables":[{"name":"items","purpose":"...","columns":[{"name":"id","type":"integer","required":true}]}],"components":[{"id":"record-list","purpose":"...","pages":["home"]}],"acceptanceCriteria":["..."],"risks":["..."]}',
    `Slug: ${context?.slug || "{slug}"}`,
    `Gebruikerswens: ${prompt.trim()}`,
  ].join("\n\n");

  try {
    const { message, model: modelUsed } = await completeOpenRouterChat({
      model,
      messages: [{ role: "user", content: plannerPrompt }],
      maxTokens: 3000,
      signal,
    });
    const validation = validateGenerationPlan({
      ...(extractJsonObject(message) as Record<string, unknown>),
      model: modelUsed,
    });
    if (validation.ok) return validation.plan;
  } catch (error) {
    console.warn("[generation-plan] planner fallback", {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
  }

  return fallback;
}
