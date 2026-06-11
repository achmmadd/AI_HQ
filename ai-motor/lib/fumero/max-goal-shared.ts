import { looksLikeCasualBuildRequest } from "@/lib/fumero/casual-prompt";
import { resolveTemplateFromUserText } from "@/lib/fumero/max-tool-chat";
import { shouldScrapeFromPrompt } from "@/lib/scrape/resolve-scrape-targets";

export const FUMERO_GOAL_UPDATED_EVENT = "fumero-goal-updated";

export function dispatchFumeroGoalUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FUMERO_GOAL_UPDATED_EVENT));
}

/**
 * Doel-tekst kan uit geplakte site-content komen (visual edit / scrape) en
 * rauwe HTML bevatten. Strip tags + entities zodat opslag en UI schoon blijven.
 */
export function sanitizeGoalText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eén nette UI-regel: HTML gestript + afgekapt met ellipsis. */
export function goalDisplayLabel(goals: string, maxChars = 72): string {
  const clean = sanitizeGoalText(goals).replace(/[<>]/g, "");
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).trimEnd()}…`;
}

export type ParsedGoalCommand =
  | { action: "show" }
  | { action: "set"; text: string }
  | { action: "add"; text: string }
  | { action: "clear" };

/** `/goal`, `/goal tekst`, `/goal add …`, `/goal clear` */
export function parseMaxGoalCommand(raw: string): ParsedGoalCommand | null {
  const t = raw.trim();
  if (!/^\/goal\b/i.test(t)) return null;
  const rest = t.replace(/^\/goal\s*/i, "").trim();
  if (!rest) return { action: "show" };
  if (/^clear$/i.test(rest)) return { action: "clear" };
  const addMatch = rest.match(/^add\s+([\s\S]+)/i);
  if (addMatch?.[1]?.trim()) {
    return { action: "add", text: addMatch[1].trim().slice(0, 400) };
  }
  return { action: "set", text: rest.slice(0, 600) };
}

/**
 * Ontbrekende info vóór tool-build → Max stelt vragen in chat (geen stille build).
 */
export function bouwenClarifyingQuestions(
  prompt: string,
  goals: string | null
): string[] | null {
  const t = prompt.trim();
  if (t.length < 6) return null;

  const tpl = resolveTemplateFromUserText(t);
  if (tpl === "calculator" || tpl === "age") return null;

  const wantsKnowledge =
    tpl === "chat" ||
    /\b(chat|bot|kennisbank|faq|klant|vragen|widget|helpdesk)\b/i.test(t);
  const hasSiteInfo =
    shouldScrapeFromPrompt(t, "fumero") ||
    /\bfumero\.nl\b/i.test(t) ||
    /\b(faq|shop|veel.?gestelde)\b/i.test(t);

  const questions: string[] = [];

  if (wantsKnowledge && !hasSiteInfo) {
    questions.push(
      "Welke info of pagina moet ik gebruiken (bv. FAQ, shop, hele fumero.nl)?"
    );
  }

  if (
    looksLikeCasualBuildRequest(t) &&
    !tpl &&
    t.length < 55 &&
    !/\b(rekenmachine|calculator|leeftijd|loyalty|quiz)\b/i.test(t)
  ) {
    questions.push(
      "Wat moet het voor bezoekers doen — vragen beantwoorden, producten tonen, of iets anders?"
    );
  }

  if (questions.length === 0) return null;

  if (!goals?.trim() && wantsKnowledge) {
    questions.push(
      "Wat is je hoofddoel met dit project? (typ `/goal …` — dan onthoud ik het voor later)"
    );
  }

  return questions.slice(0, 3);
}

export function formatBouwenClarifyAssistantMessage(questions: string[]): string {
  return (
    "Voordat ik ga bouwen, mis ik nog even iets — **kun je dit kort aanvullen?**\n\n" +
    questions.map((q, i) => `${i + 1}. ${q}`).join("\n") +
    "\n\n_Antwoord gewoon in chat. Je doel onthoud ik met `/goal …`._"
  );
}

export function buildMaxClarifyChatPrompt(
  userText: string,
  questions: string[],
  goals: string | null
): string {
  const goalLine = goals?.trim()
    ? `Bekend doel: ${goals.trim()}`
    : "Nog geen vast doel in profiel.";
  return [
    "[Bouwen — eerst verduidelijken, nog niet bouwen]",
    goalLine,
    "Stel de gebruiker vriendelijk deze vragen (maximaal 3, kort, Nederlands):",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    "",
    `Origineel bericht gebruiker: ${userText.trim()}`,
  ].join("\n");
}
