/** Eenvoudige bouwstappen voor coder-preview (max 4, begrijpelijk voor niet-techneuten). */
export const CODER_BUILD_PHASES = [
  "Je verzoek bekijken",
  "De pagina aanpassen",
  "Het resultaat controleren",
  "Preview klaarzetten",
] as const;

export type CoderBuildPhase = (typeof CODER_BUILD_PHASES)[number];

export function coderBuildPhaseIndex(activePhase: string | undefined): number {
  if (!activePhase) return 0;
  const idx = CODER_BUILD_PHASES.findIndex((p) => p === activePhase);
  return idx >= 0 ? idx : 0;
}

/**
 * Percentage voor één bouwsessie. `null` = laatste fase nog bezig → indeterminate UI.
 * Binnen één sessie monotoon via fase-index (nooit terug).
 */
export function coderBuildProgressPercent(
  activePhase: string | undefined,
  building: boolean
): number | null {
  const total = CODER_BUILD_PHASES.length;
  if (!building) return 100;
  const activeIdx = coderBuildPhaseIndex(activePhase);
  if (activeIdx >= total - 1) return null;
  return Math.min(100, Math.round(((activeIdx + 1) / total) * 100));
}

export function coderBuildProgressIsIndeterminate(
  activePhase: string | undefined,
  building: boolean
): boolean {
  return building && coderBuildProgressPercent(activePhase, building) === null;
}
