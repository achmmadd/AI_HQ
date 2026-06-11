import {
  FUMERO_TOOL_TEMPLATES,
  getTemplate,
  type FumeroDeployType,
  type FumeroToolTemplateId,
} from "@/lib/fumero/tool-templates";
import {
  isBouwenContinueIntent,
  isPreviewPanelOpenIntent,
} from "@/lib/fumero/bouwen-chat-intents";
import {
  isFumeroSiteCheckChatIntent,
  looksLikeCasualBuildRequest,
} from "@/lib/fumero/casual-prompt";

/** Keywords die tool-builder in chat starten (geen redirect). */
const TOOL_INTENT_RE =
  /\b(maak\s+(een\s+)?(widget|tool|rekenmachine|calculator|formulier|form|landingspagina|landing\s*page|pagina|website|dashboard|chatbot|app|iets|wat)|bouw\s+(een\s+)?(tool|rekenmachine|calculator|widget|chatbot|website|formulier|form|landingspagina|dashboard|app|iets|wat)|bouwen\s+(?:een\s+)?(?:chat\s*bot|chatbot|tool|widget|formulier|pagina|website)|genereer\s+(een\s+)?(widget|tool|formulier|landingspagina|pagina|website|dashboard)|ontwerp\s+(een\s+)?(widget|tool|formulier|landingspagina|pagina|website)|build\s+(a\s+)?(tool|calculator|widget|form|landing|page|website)|create\s+(a\s+)?(tool|calculator|widget|form|landing|page|website)|keuzehulp|chatbot|chat\s*bot|popup|loyalty|quiz|leeftijdscheck|rekenmachine|calculator|embed\s*widget|website\s*widget|klantenservice|helpdesk|kennisbank|widgetje|bestelformulier|contactformulier|offerteformulier|intakeformulier|landingspagina|landing\s*page|one[-\s]?pager|startpagina|contactformulier|bestelformulier)\b/i;

const BUILD_VERB_QUESTION_RE =
  /\b(kan|kun|zou)\s+(je|u)\s+.+\s+(maken|bouwen|zetten|toevoegen|fixen)\b/i;

/** Expliciete build-trigger (plan-modus "Maak", deploy, start). */
export const CODER_BUILD_TRIGGER_RE =
  /\b(maak|bouw|bouwen|genereer|start|deploy|concept|scrape|scrapen)\b/i;

export function isToolRefinePrompt(prompt: string): boolean {
  return /\b(pas|aanpas|verfijn|wijzig|voeg|verwijder|kleur|groen|rood|tekst|update|add|change)\b/i.test(
    prompt.trim()
  );
}

/** Expliciete tool/build-intent — geen vage lange zinnen. */
export function hasExplicitCoderBuildIntent(
  prompt: string,
  opts?: { awaitingTemplate?: boolean }
): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (looksLikeCasualBuildRequest(t)) return true;
  if (BUILD_VERB_QUESTION_RE.test(t)) return true;
  if (CODER_BUILD_TRIGGER_RE.test(t) && detectFumeroToolIntent(t)) return true;
  if (CODER_BUILD_TRIGGER_RE.test(t) && resolveTemplateFromUserText(t)) return true;
  if (detectFumeroToolIntent(t)) return true;
  const quick = resolveTemplateFromQuickReply(t);
  if (quick && quick.templateId !== "custom") return true;
  if (resolveTemplateFromUserText(t)) return true;
  if (opts?.awaitingTemplate) {
    return Boolean(quick || detectFumeroToolIntent(t) || CODER_BUILD_TRIGGER_RE.test(t));
  }
  return false;
}

/** Coder-modus: alleen echte Q&A → chat; alles anders → tool-build pipeline. */
export function isCoderQuestionOnly(
  prompt: string,
  opts?: { awaitingTemplate?: boolean }
): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (opts?.awaitingTemplate) return false;
  if (isFumeroSiteCheckChatIntent(t)) return true;
  if (hasExplicitCoderBuildIntent(t, opts)) return false;
  if (BUILD_VERB_QUESTION_RE.test(t)) return false;
  if (t.endsWith("?") && !looksLikeCasualBuildRequest(t)) return true;
  const lower = t.toLowerCase();
  if (
    /^(wat|hoe|waarom|wanneer|wie|welke|kan|kun|mag|is|zijn|heeft|hebben|help|uitleg|vertel)\b/.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /^(what|how|why|when|who|which|can|could|should|is|are|does|help|explain)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

const FULL_APP_SCOPE_RE =
  /\b(portaal|portal|projectmanagement|projectbeheer|detailpagina|admin(?:[-\s]?overzicht)?|beheeromgeving|backoffice|meerdere\s+pagina['’]?s|multi[-\s]?page|crm|erp|klantenportaal|customer\s+portal|relatiebeheer|data\s*model|datamodel|rollen|roles?|login|inloggen|auth|database|crud|klanten?|clients?|projecten?|taken?|tasks?|bestellingen?|orders?)\b/i;

const FULL_APP_DASHBOARD_RE =
  /\b(dashboard|dashboards).{0,40}(admin|portaal|crm|beheren|klanten|projecten|login|crud|meerdere)\b/i;

const FULL_APP_SYSTEM_RE =
  /\b(beheren|beheer|bijhouden|registreren|opslaan|toevoegen|wijzigen|aanpassen|verwijderen|overzicht|lijsten?|statussen?|workflow|rechten|accounts?)\b/i;

const SMALL_EMBEDDABLE_TOOL_RE =
  /\b(rekenmachine|calculator|chat\s*widget|website\s*widget|embed\s*widget|widgetje|popup|quiz|keuzehulp|leeftijdscheck|game|spel|formulier|form|chatbot|chat\s*bot|landingspagina|landing\s*page|one[-\s]?pager|startpagina|contactformulier|bestelformulier|eenvoudig\s+dashboard|simpel\s+dashboard|kpi.{0,12}dashboard)\b/i;

/**
 * Scope-based routing: infer artifact size like a coding team would.
 * Full business systems, portals, data/admin surfaces and multi-page products
 * go to full_app even when the user never says "app" or "webapp".
 */
export function detectFullAppIntent(prompt: string): boolean {
  const p = prompt.trim();
  if (!p) return false;
  // Compacte single-purpose embeds blijven in de tool/widget-builder.
  if (SMALL_EMBEDDABLE_TOOL_RE.test(p)) return false;
  // Product-/domeinscope is sterker dan widgetwoorden: "chatbot met admin en database" is een full_app.
  if (FULL_APP_SCOPE_RE.test(p)) return true;
  if (FULL_APP_DASHBOARD_RE.test(p)) return true;
  if (/\b(app|applicatie|webapp|software|systeem|platform)\b/i.test(p) && FULL_APP_SYSTEM_RE.test(p)) {
    return true;
  }
  // Expliciete "maak/bouw een app" formulering
  if (/\b(maak|bouw)\s+(een\s+)?(volledige\s+)?(app|applicatie|webapp|software|systeem|platform)\b/i.test(p)) return true;
  return false;
}

export type FumeroToolQuickReply = {
  label: string;
  prompt: string;
  templateId?: FumeroToolTemplateId | "custom";
};

/** Snelle sjablonen wanneer Max tool-intent detecteert. */
export const FUMERO_TOOL_QUICK_REPLIES: FumeroToolQuickReply[] = [
  {
    label: "Chatbot",
    prompt: "Maak een chatbot voor klantvragen op mijn website",
    templateId: "chat",
  },
  {
    label: "Landingspagina",
    prompt: "Bouw een landingspagina met hero, voordelen en contact-CTA",
    templateId: "landing",
  },
  {
    label: "Formulier",
    prompt: "Maak een bestelformulier met naam, e-mail en productkeuze",
    templateId: "form",
  },
  {
    label: "Keuzehulp",
    prompt: "Keuzehulp met 3-5 stappen en duidelijke product-CTA",
    templateId: "quiz",
  },
  {
    label: "Dashboard",
    prompt: "Eenvoudig dashboard met KPI-tegels en overzichtstabel",
    templateId: "dashboard",
  },
  {
    label: "Eigen idee",
    prompt: "Eigen tool — ik beschrijf het zelf in chat",
    templateId: "custom",
  },
];

export function detectFumeroToolIntent(prompt: string): boolean {
  return TOOL_INTENT_RE.test(prompt.trim());
}

export function resolveTemplateFromQuickReply(
  labelOrPrompt: string
): FumeroToolQuickReply | undefined {
  const t = labelOrPrompt.trim().toLowerCase();
  return FUMERO_TOOL_QUICK_REPLIES.find(
    (q) =>
      q.label.toLowerCase() === t ||
      q.prompt.toLowerCase() === t ||
      q.label.toLowerCase().includes(t) ||
      t.includes(q.label.toLowerCase())
  );
}

export function resolveTemplateFromUserText(
  prompt: string
): FumeroToolTemplateId | undefined {
  const lower = prompt.toLowerCase();
  if (/\b(rekenmachine|calculator|calc\b)\b/.test(lower)) return "calculator";
  if (/\b(chat\s*widget|chatbot|chat\s*bot|klantenservice|helpdesk|support|vragen\s*beantwoord)\b/.test(lower)) return "chat";
  if (/\b(faq|veelgestelde|kennisbank)\b/.test(lower)) return "chat";
  if (/\b(landingspagina|landing\s*page|one[-\s]?pager|startpagina)\b/.test(lower)) return "landing";
  if (/\b(bestel|contact|offerte|intake|aanmeld|reserver).{0,12}formulier\b/.test(lower)) return "form";
  if (/\b(formulier|form)\b/.test(lower) && !/\b(inlog|login|auth)\b/.test(lower)) return "form";
  if (/\b(eenvoudig|simpel|kpi).{0,16}dashboard\b/.test(lower)) return "dashboard";
  if (/\bdashboard\b/.test(lower) && !/\b(portaal|crm|admin|login|klanten\s*beheren)\b/.test(lower)) return "dashboard";
  if (/\bkeuzehulp|quiz\b/.test(lower)) return "quiz";
  if (/\bleeftijd|18\+\b/.test(lower)) return "age";
  if (/\bloyalty|punten|beloningen\b/.test(lower)) return "loyalty";
  if (/\bbundle\b/.test(lower)) return "bundle";
  if (/\breview|beoordeling\b/.test(lower)) return "review";
  return undefined;
}

export function toolIntentAssistantIntro(): string {
  return (
    "Vertel gewoon wat je wilt — geen perfecte prompt nodig.\n\n" +
    "Kies een sjabloon of typ bv. *chatbot voor klantvragen*, *landingspagina voor mijn zaak* of *bestelformulier*. " +
    "Preview rechts · daarna **Pas aan** of **Online zetten**."
  );
}

export function deriveToolName(prompt: string, templateId?: string): string {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  if (tpl) return tpl.title;
  if (/\b(rekenmachine|calculator)\b/i.test(prompt)) return "Rekenmachine";
  const trimmed = prompt.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  if (words.length > 0 && words.length <= 48) return words;
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45)}…`;
}

export function mergeToolPrompt(
  base: string,
  instruction: string,
  templateSeed?: string
): string {
  const parts = [templateSeed, base, instruction].filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? instruction;
  if (parts.length === 2 && !base) return `${parts[0]}\n\n${parts[1]}`;
  return [base, `Aanpassing: ${instruction}`].filter(Boolean).join("\n\n");
}

/** Eerste generatie: sjabloon + gebruikersintent + keuze. */
export function buildInitialToolPrompt(
  seed: string,
  choice: string,
  templateSeed?: string
): string {
  const lines = [templateSeed, seed, choice]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim());
  const uniq = [...new Set(lines)];
  return uniq.join("\n\n");
}

export function deployTypeForTemplate(
  templateId?: string
): FumeroDeployType {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  return tpl?.defaultDeployType ?? "widget";
}

export function formatToolDeployedMarkdown(
  name: string,
  liveUrl?: string | null
): string {
  const urlLine = liveUrl
    ? `\n\nLive URL: \`${liveUrl}\``
    : "";
  return `**${name}** is live.${urlLine}\n\nEmbed-code staat in de tool-kaart — kopieer met één klik.`;
}

/** Expliciete tool-flow acties (niet door LLM-router). */
export type MaxToolChatAction =
  | { type: "tool_intent_pick" }
  | { type: "tool_build" }
  | { type: "tool_iterate" }
  | { type: "tool_publish" }
  | { type: "open_preview" };

export { isBouwenContinueIntent, isPreviewPanelOpenIntent };

export function resolveMaxToolChatAction(
  prompt: string,
  opts: {
    hasActiveTool: boolean;
    awaitingTemplate?: boolean;
    /** Na bouw-verduidelijking: korte bevestigingen → bouwen, niet template picker. */
    awaitingClarify?: boolean;
    hasPreview?: boolean;
    /** Coder mode: never fall through to generic chat — unclear → template picker. */
    coderMode?: boolean;
  }
): MaxToolChatAction | null {
  const t = prompt.trim();
  if (!t) return null;

  if (isPreviewPanelOpenIntent(t) && opts.hasPreview) {
    return { type: "open_preview" };
  }

  if (opts.awaitingClarify) {
    if (isBouwenContinueIntent(t)) {
      return { type: "tool_build" };
    }
    return null;
  }

  if (opts.coderMode) {
    if (isFumeroSiteCheckChatIntent(t)) {
      return null;
    }
    if (isBouwenContinueIntent(t)) {
      return null;
    }
    if (isCoderQuestionOnly(t, { awaitingTemplate: opts.awaitingTemplate })) {
      return null;
    }
    if (opts.hasActiveTool) {
      return { type: "tool_iterate" };
    }
    if (opts.awaitingTemplate) {
      const quick = resolveTemplateFromQuickReply(t);
      if (quick?.templateId === "custom") {
        return { type: "tool_intent_pick" };
      }
      if (quick || detectFumeroToolIntent(t) || CODER_BUILD_TRIGGER_RE.test(t)) {
        return { type: "tool_build" };
      }
      return { type: "tool_intent_pick" };
    }
    const quick = resolveTemplateFromQuickReply(t);
    const tpl = resolveTemplateFromUserText(t);
    if (
      looksLikeCasualBuildRequest(t) ||
      detectFumeroToolIntent(t) ||
      tpl ||
      (quick && quick.templateId !== "custom")
    ) {
      return { type: "tool_build" };
    }
    if (
      quick?.templateId === "custom" ||
      (t.length < 10 && !isBouwenContinueIntent(t))
    ) {
      return { type: "tool_intent_pick" };
    }
    return { type: "tool_build" };
  }

  if (opts.awaitingTemplate) {
    const quick = resolveTemplateFromQuickReply(t);
    if (quick || detectFumeroToolIntent(t) || t.length > 8) {
      return { type: "tool_build" };
    }
    return { type: "tool_intent_pick" };
  }

  if (opts.hasActiveTool) {
    if (detectFumeroToolIntent(t) && !/\b(pas|maak|voeg|wijzig|kleur|groen|rood|tekst)\b/i.test(t)) {
      return null;
    }
    return { type: "tool_iterate" };
  }

  if (detectFumeroToolIntent(t)) {
    const quick = resolveTemplateFromQuickReply(t);
    const tpl = resolveTemplateFromUserText(t);
    if (tpl === "calculator" || quick?.templateId === "calculator") {
      return { type: "tool_build" };
    }
    if (quick?.templateId === "custom" || (!quick && !tpl)) {
      return { type: "tool_intent_pick" };
    }
    return { type: "tool_build" };
  }

  const quick = resolveTemplateFromQuickReply(t);
  if (quick) return { type: "tool_build" };

  return null;
}

export function listToolTemplatesForChat() {
  return FUMERO_TOOL_TEMPLATES;
}
