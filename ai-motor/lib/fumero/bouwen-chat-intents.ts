/** Bevestiging / doorgaan na plan of verduidelijking — start bouw, geen template picker. */
const BOUWEN_CONTINUE_RE =
  /^(ga\s+door|voer\s+uit|doe\s+(maar|het)|start(?:\s+maar)?|begin(?:\s+maar)?|akkoord|prima|ok(?:é|e)?|yes|ja(?:\s+hoor)?|yep|go|build|deploy|bouwen)\.?$/i;

export const BOUWEN_CONTINUE_INLINE_RE =
  /\b(ga\s+door|voer\s+(het\s+)?uit|start\s+(de\s+)?bouw|begin\s+met\s+bouwen|bouw\s+(maar|het|nu))\b/i;

/** Preview-paneel openen (niet verfijnen / niet opnieuw bouwen). */
const PREVIEW_PANEL_OPEN_RE =
  /\b(open|toon|laat\s+(?:me\s+)?zien|bekijk).{0,40}\b(preview(?:paneel|-paneel)?|live\s*preview|voorbeeld)\b|\bpreview(?:paneel|-paneel)?\s+open(en)?\b|\bopen\s+(?:het\s+)?(?:in\s+)?(?:het\s+)?preview(?:\s*paneel|\s*panel)?\b|^\s*preview\s*(paneel|panel)?\s*\.?\s*$/i;

export function isBouwenContinueIntent(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (BOUWEN_CONTINUE_RE.test(t)) return true;
  if (BOUWEN_CONTINUE_INLINE_RE.test(t)) return true;
  return false;
}

/** Antwoord na verduidelijking mét expliciete doorgaan-trigger in dezelfde zin. */
export function isBouwenClarifyAnswerWithBuild(prompt: string): boolean {
  return isBouwenContinueIntent(prompt);
}

export function isPreviewPanelOpenIntent(prompt: string): boolean {
  const t = prompt.trim();
  if (!t || t.length > 120) return false;
  return PREVIEW_PANEL_OPEN_RE.test(t);
}

/** Samenvoegen van oorspronkelijke bouw-wens + antwoorden na verduidelijking. */
export function mergeBouwenClarifyPrompt(
  seedPrompt: string,
  clarifications: string[],
  latest?: string
): string {
  const parts = [seedPrompt.trim(), ...clarifications.map((c) => c.trim())];
  if (latest?.trim() && !isBouwenContinueIntent(latest)) {
    parts.push(latest.trim());
  }
  return [...new Set(parts.filter(Boolean))].join("\n\n");
}
