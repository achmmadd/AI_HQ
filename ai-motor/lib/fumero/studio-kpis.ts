/** KPI helpers for Fumero Studio chat home. */

export type FumeroStudioKpis = {
  libraryCount: number | null;
  activeAutomations: number | null;
  openOrdersCount: number | null;
  briefingAgeLabel: string | null;
};

export function formatBriefingAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const ageMs = Date.now() - ts;
  if (ageMs < 0) return "zojuist";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 uur" : `${hours} uur`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 dag" : `${days} dagen`;
}
