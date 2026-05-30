import { isBuildLikePrompt } from "@/lib/build-intent-ext";
import { detectChatIntent } from "@/lib/intent-detection";

/** UI / product-page-achtige vragen die via Dify HTML moeten. */
export function isDesignArtifactPrompt(prompt: string): boolean {
  const l = prompt.toLowerCase();
  if (
    /\b(gallery|product\s*gallery|landing\s*page|lookbook|storefront|webpagina|web\s*page|html\s*page|one-?pager|hero\s*section|mockup|portfolio\s*grid|qr\s*menu|menukaart|digitale\s*menu)\b/i.test(
      l
    )
  ) {
    return true;
  }
  if (/\b(dribbble|behance|design\s*trends?|webdesign)\b/i.test(l)) return true;
  if (
    /\b(kopieer|copy|zoals|like\s+this|based\s+on|geïnspireerd|inspired\s+by)\b/i.test(
      l
    ) &&
    /https?:\/\//i.test(prompt)
  ) {
    return true;
  }
  return (
    /https?:\/\/\S+/i.test(prompt) &&
    /\b(site|page|design|layout|stijl|url|link)\b/i.test(l)
  );
}

/** Expliciet meer research (web/vision) pushen. */
const RESEARCH_KEYWORDS =
  /\b(inspiratie|op\s*internet|web\s*search|zoek\s*(naar|online)|dribbble|behance|screenshot|premium\s*ui|zoals\s*(deze\s*)?site|reference|referentie|inspired\s*by|geïnspireerd)\b/i;

/**
 * Volledige design research (Anthropic web + optioneel vision) is duur (tientallen sec).
 * Alleen doen als gebruiker URL’s geeft, design-achtige taal gebruikt, of expliciet om inspiratie vraagt.
 * Zet MOTOR_BUILDER_ALWAYS_RESEARCH=1 om dit altijd aan te zetten.
 */
export function shouldRunDesignResearch(prompt: string): boolean {
  if (process.env.MOTOR_BUILDER_ALWAYS_RESEARCH?.trim() === "1") {
    return true;
  }
  if (process.env.MOTOR_BUILDER_SKIP_RESEARCH?.trim() === "1") {
    return false;
  }
  const t = prompt.trim();
  if (!t) return false;
  if (/https?:\/\/\S+/i.test(t)) return true;
  if (isDesignArtifactPrompt(t)) return true;
  if (RESEARCH_KEYWORDS.test(t)) return true;
  return false;
}

export function qualifiesForIntelligentBuilder(prompt: string): boolean {
  if (detectChatIntent(prompt) === "build") return true;
  if (isBuildLikePrompt(prompt)) return true;
  if (isDesignArtifactPrompt(prompt)) return true;
  return false;
}

/**
 * Follow-up in dezelfde thread: kleine wijziging op bestaande HTML i.p.v. opnieuw onderzoek + volledige rebuild.
 */
export function shouldUseHtmlIteration(
  prompt: string,
  previousHtml: string | null
): boolean {
  if (!previousHtml?.trim()) return false;
  const l = prompt.toLowerCase();
  if (
    /\b(research|zoek\s*opnieuw|nieuwe\s*inspiratie|dribbble|complete\s*redesign|opnieuw\s*vanaf\s*nul|from scratch)\b/i.test(
      l
    )
  ) {
    return false;
  }
  const fullRebuild =
    /\b(nieuwe app|new app|maak een (nieuwe )?(app|website)|build a new|volledig nieuwe|brand new)\b/i.test(
      l
    ) ||
    ((/\b(bouw|build)\b/i.test(l) || /\bmaak\b/i.test(l)) &&
      /\b(gallery|dashboard|landing|website|webapp|mini.?app|html\s*app)\b/i.test(l) &&
      prompt.length > 40);
  if (fullRebuild) return false;
  if (
    prompt.length < 200 &&
    /\b(maak|zet|verander|change|kleur|color|groter|kleiner|padding|margin|font|dark|light|mode|voeg|verwijder|remove|add|fix|bug|hover|shadow|rounded|border|gradient|animation|animatie)\b/i.test(
      l
    )
  ) {
    return true;
  }
  if (prompt.length < 90) return true;
  return false;
}
