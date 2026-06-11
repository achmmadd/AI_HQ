/** KPI helpers for Fumero Studio chat home. */

export type FumeroStudioKpis = {
  libraryCount: number | null;
  activeAutomations: number | null;
  openOrdersCount: number | null;
  briefingAgeLabel: string | null;
  monthlyCostEur: number | null;
  hoursSaved: number | null;
};

export function formatMonthlyCostEur(eur: number | null): string {
  if (eur === null) return "—";
  if (eur < 0.01) return "€0";
  return `€${eur.toFixed(2).replace(".", ",")}`;
}

export function formatHoursSaved(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "< 1 uur";
  const rounded = Math.round(hours * 10) / 10;
  return rounded === 1 ? "1 uur" : `${rounded} uur`;
}

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
