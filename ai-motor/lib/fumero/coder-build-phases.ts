/** Eenvoudige bouwstappen voor coder-preview (max 4, begrijpelijk voor niet-techneuten). */
export const CODER_BUILD_PHASES = [
  "Jouw wens bekijken",
  "Pagina bouwen",
  "Knoppen en styling",
  "Preview klaarzetten",
] as const;

export type CoderBuildPhase = (typeof CODER_BUILD_PHASES)[number];

export function coderBuildProgressPercent(
  activePhase: string | undefined,
  building: boolean
): number {
  const total = CODER_BUILD_PHASES.length;
  if (!building) return 100;
  const idx = activePhase
    ? CODER_BUILD_PHASES.findIndex((p) => p === activePhase)
    : 0;
  const activeIdx = idx >= 0 ? idx : 0;
  return Math.min(100, Math.round(((activeIdx + 1) / total) * 100));
}
