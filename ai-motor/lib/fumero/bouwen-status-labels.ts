import {
  CODER_BUILD_PHASES,
  type CoderBuildPhase,
} from "@/lib/fumero/coder-build-phases";

export const BOUWEN_DONE_LABEL = "Klaar";

const PHASE_SET = new Set<string>(CODER_BUILD_PHASES);

/** Menselijke status voor Bouwen — geen technische logs als standaard. */
export function bouwenHumanStatusLabel(
  technical: string | null | undefined,
  opts?: { building?: boolean; done?: boolean },
): string {
  if (opts?.done) return BOUWEN_DONE_LABEL;
  const raw = technical?.trim();
  if (!raw) return CODER_BUILD_PHASES[0];
  if (PHASE_SET.has(raw)) return raw;

  const t = raw.toLowerCase();

  if (
    t === "planning" ||
    t.includes("generatieplan") ||
    t.includes("planning")
  ) {
    return "Je verzoek bekijken";
  }
  if (t === "generating" || t === "generating…") {
    return "De pagina aanpassen";
  }
  if (t === "validating" || t === "repairing" || t === "done") {
    return t === "done" ? "Preview klaarzetten" : "Het resultaat controleren";
  }

  if (
    t.includes("control") ||
    t.includes("check") ||
    t.includes("ux") ||
    t.includes("verifi") ||
    t.includes("preview klaar")
  ) {
    return "Het resultaat controleren";
  }
  if (
    t.includes("scrape") ||
    t.includes("site-check") ||
    t.includes("ophalen") ||
    t.includes("context") ||
    t.includes("verwerk") ||
    t.includes("opdracht") ||
    t.includes("bekijk") ||
    t.includes("denk")
  ) {
    return "Je verzoek bekijken";
  }
  if (
    t.includes("public") ||
    t.includes("online zet") ||
    t.includes("deploy") ||
    (t.includes("live") && !t.includes("ophalen"))
  ) {
    return "Online zetten…";
  }
  if (
    t.includes("bouw") ||
    t.includes("gener") ||
    t.includes("aanpass") ||
    t.includes("verfijn") ||
    t.includes("stream") ||
    t.includes("antwoord") ||
    t.includes("pagina") ||
    t.includes("tool") ||
    t.includes("app")
  ) {
    return "De pagina aanpassen";
  }

  return opts?.building ? "De pagina aanpassen" : "Je verzoek bekijken";
}

export function bouwenPhaseFromIndex(index: number): CoderBuildPhase {
  const clamped = Math.max(0, Math.min(CODER_BUILD_PHASES.length - 1, index));
  return CODER_BUILD_PHASES[clamped]!;
}

/** Index van een menselijke bouwfase (onbekend → 0). */
export function bouwenPhaseIndex(phase: string): number {
  if (PHASE_SET.has(phase)) {
    return CODER_BUILD_PHASES.indexOf(phase as CoderBuildPhase);
  }
  return 0;
}

/**
 * Map status naar bouwfase — alleen vooruit binnen één sessie (geen 100→25 reset).
 */
export function monotonicCoderBuildPhase(
  currentMaxIndex: number,
  status: string | null | undefined,
  opts?: { building?: boolean },
): { phase: CoderBuildPhase; index: number } {
  const human = bouwenHumanStatusLabel(status, opts);
  const idx = bouwenPhaseIndex(human);
  const nextIndex = Math.max(currentMaxIndex, idx);
  return { phase: bouwenPhaseFromIndex(nextIndex), index: nextIndex };
}
