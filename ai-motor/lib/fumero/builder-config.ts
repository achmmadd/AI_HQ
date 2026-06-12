/** Fumero tool/app builder — model label + user-facing errors (Phase 2). */

/** Default Anthropic builder model (Coder / Fumero tools). */
export const DEFAULT_BUILDER_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/** OpenRouter slug for builder when not using Anthropic direct. */
export const DEFAULT_BUILDER_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

export function getBuilderAnthropicModel(): string {
  const explicit = process.env.ANTHROPIC_MODEL?.trim();
  if (explicit) return explicit;
  const orModel = process.env.MOTOR_BUILDER_MODEL?.trim();
  if (orModel?.startsWith("anthropic/")) {
    const id = orModel.slice("anthropic/".length);
    if (id === "claude-sonnet-4") return DEFAULT_BUILDER_ANTHROPIC_MODEL;
    if (id === "claude-sonnet-4.6" || id === "claude-sonnet-4-6") {
      return DEFAULT_BUILDER_ANTHROPIC_MODEL;
    }
    return id;
  }
  return DEFAULT_BUILDER_ANTHROPIC_MODEL;
}

/** Subtle badge text for Fumero chat cards when building tools/apps. */
export function getFumeroBuilderLabel(): string {
  if (process.env.MOTOR_BUILDER_USE_ANTHROPIC?.trim() === "1") return "Sonnet";
  const model = process.env.MOTOR_BUILDER_MODEL?.trim().toLowerCase() ?? "";
  if (model.includes("sonnet")) return "Sonnet";
  if (model) return "Smokey";
  return "Smokey";
}

/** Turn raw builder/API errors into actionable Dutch copy (no JSON dumps). */
export function formatFumeroBuilderError(raw: string): string {
  const msg = raw.trim();
  if (!msg) {
    return "Genereren mislukt. Probeer het opnieuw of beschrijf je wens korter.";
  }
  if (msg.startsWith("{") || msg.startsWith("[")) {
    return "Genereren mislukt. Controleer je verbinding en probeer opnieuw.";
  }
  if (
    /Unexpected token\s*['"]?<\s*['"]?/i.test(msg) ||
    /<!DOCTYPE/i.test(msg) ||
    /webpagina i\.p\.v\. JSON/i.test(msg) ||
    /524|502 Bad Gateway|504 Gateway/i.test(msg)
  ) {
    return "Server time-out tijdens genereren. De bouw loopt op de achtergrond — vernieuw niet te snel; bij herhaald falen, probeer een kortere prompt.";
  }
  if (/timeout|timed out|aborted|abort/i.test(msg)) {
    return "Genereren duurde te lang. Probeer het opnieuw of maak een kleinere aanpassing.";
  }
  if (/Geen HTML|te kort|markdown-fence/i.test(msg)) {
    return "Het model leverde geen geldige preview. Beschrijf je tool opnieuw met iets meer detail.";
  }
  if (/OpenRouter\s+429|rate-limited|rate limit/i.test(msg)) {
    return "Model tijdelijk druk — probeer Flash of Pro, of over een minuut opnieuw.";
  }
  if (/OpenRouter|Anthropic|n8n mislukt|503|502|500/i.test(msg)) {
    return "De builder is tijdelijk niet beschikbaar. Wacht even en probeer opnieuw.";
  }
  if (/React|JSX|type=module|import\b/i.test(msg)) {
    return "De gegenereerde code is niet compatibel. Formuleer je wens als HTML-widget zonder frameworks.";
  }
  if (msg.length > 140) return `${msg.slice(0, 137)}…`;
  return msg;
}

export function cacheBustPreviewUrl(
  url: string | null | undefined,
  epoch?: number
): string | null {
  if (!url) return null;
  if (!epoch) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_v=${epoch}`;
}
