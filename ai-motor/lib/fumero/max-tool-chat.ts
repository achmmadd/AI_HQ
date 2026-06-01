import {
  FUMERO_TOOL_TEMPLATES,
  getTemplate,
  type FumeroDeployType,
  type FumeroToolTemplateId,
} from "@/lib/fumero/tool-templates";

/** Keywords die tool-builder in chat starten (geen redirect). */
const TOOL_INTENT_RE =
  /\b(maak\s+(een\s+)?(widget|tool|rekenmachine|calculator)|bouw\s+(een\s+)?(tool|rekenmachine|calculator|widget|chatbot|website)|bouwen\s+(?:een\s+)?(?:chat\s*bot|chatbot|tool|widget)|build\s+(a\s+)?(tool|calculator|widget)|create\s+(a\s+)?(tool|calculator|widget)|keuzehulp|chatbot|chat\s*bot|popup|loyalty|quiz|leeftijdscheck|rekenmachine|calculator|embed\s*widget|website\s*widget|scrape.*(?:tool|chatbot|widget))\b/i;

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
  if (hasExplicitCoderBuildIntent(t, opts)) return false;
  if (t.endsWith("?")) return true;
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

/** Fase 2: detectie voor volledige data-gedreven apps (gaat naar nieuwe apps-tabel + /api/apps/[slug]/data). */
export function detectFullAppIntent(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (!/\b(app|applicatie|webapp)\b/.test(p)) return false;
  // Data-centric signalen (voorrad, producten toevoegen/opslaan/lijsten etc.)
  if (/\b(toevoegen|toevoeg|opslaan|bijhouden|registreren|overzicht|lijst|lijsten|zien|bekijken|wijzigen|aanpassen|verwijderen|crud|data|database|producten?|voorraad|inventaris|klanten?|bestellingen?|orders?|taken?|todo)\b/.test(p)) return true;
  // Expliciete "maak/bouw een app" formulering
  if (/\b(maak|bouw)\s+(een\s+)?(volledige\s+)?(app|applicatie)\b/.test(p)) return true;
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
    label: "Chat widget",
    prompt: "Chat widget voor productvragen op de website",
    templateId: "chat",
  },
  {
    label: "Rekenmachine",
    prompt: "Maak een rekenmachine met groot display en donkere knoppen.",
    templateId: "calculator",
  },
  {
    label: "Keuzehulp",
    prompt: "Keuzehulp met 3-5 stappen en duidelijke product-CTA",
    templateId: "quiz",
  },
  {
    label: "Leeftijdscheck",
    prompt: "Leeftijdscheck 18+ gate, NL copy, geen persoonsgegevens opslaan",
    templateId: "age",
  },
  {
    label: "Loyalty",
    prompt: "Loyalty dashboard: punten, tier en beloningen",
    templateId: "loyalty",
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
  if (/\b(chat\s*widget|chatbot|chat\s*bot)\b/.test(lower)) return "chat";
  if (/\bkeuzehulp|quiz\b/.test(lower)) return "quiz";
  if (/\bleeftijd|18\+\b/.test(lower)) return "age";
  if (/\bloyalty|punten|beloningen\b/.test(lower)) return "loyalty";
  if (/\bbundle\b/.test(lower)) return "bundle";
  if (/\breview|beoordeling\b/.test(lower)) return "review";
  return undefined;
}

export function toolIntentAssistantIntro(): string {
  return (
    "Ik zet de **tool-editor** in deze thread klaar — je blijft in chat, geen apart scherm.\n\n" +
    "Kies een sjabloon hieronder of beschrijf je tool (bv. kleuren, stappen, teksten). " +
    "Daarna zie je een live preview, kun je verfijnen met **Pas aan**, en **Deploy** zet hem in de garage."
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
  | { type: "tool_publish" };

export function resolveMaxToolChatAction(
  prompt: string,
  opts: {
    hasActiveTool: boolean;
    awaitingTemplate?: boolean;
    /** Coder mode: never fall through to generic chat — unclear → template picker. */
    coderMode?: boolean;
  }
): MaxToolChatAction | null {
  const t = prompt.trim();
  if (!t) return null;

  if (opts.coderMode) {
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
    if (quick?.templateId === "custom" || (!quick && !tpl && !detectFumeroToolIntent(t))) {
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
