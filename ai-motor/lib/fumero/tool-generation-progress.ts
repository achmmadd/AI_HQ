/** Voortgang per backend-fase (0–100) voor tool-generatie polling. */
export const TOOL_GEN_PHASE_PROGRESS: Record<string, number> = {
  pending: 4,
  queued: 10,
  analyzing: 18,
  generating: 52,
  validating: 74,
  saving: 91,
  done: 100,
};

export function toolGenerationProgressPct(
  phase: string | null | undefined,
  status?: string | null
): number {
  if (status === "done") return 100;
  if (status === "error") return 0;
  if (!phase) return status === "pending" ? 4 : 10;
  return TOOL_GEN_PHASE_PROGRESS[phase] ?? 35;
}

/** 1 s eerste 30 s, daarna 2 s — streaming-gevoel zonder SSE. */
export function adaptiveToolPollIntervalMs(elapsedMs: number): number {
  return elapsedMs < 30_000 ? 1_000 : 2_000;
}

/** Menselijke elapsed / resterende schatting (NL). */
export function formatBouwenElapsedDutch(elapsedMs: number): string {
  const sec = Math.floor(elapsedMs / 1000);
  if (sec < 20) return "Even geduld…";
  if (sec < 50) return `${sec} sec`;
  const estTotalSec = 150;
  const remain = Math.max(25, estTotalSec - sec);
  const min = Math.ceil(remain / 60);
  if (min <= 1) return "Nog ~1 min";
  return `Nog ~${min} min`;
}

export function toolGenerationElapsedMs(
  createdAt: string | null | undefined,
  startedAt?: string | null
): number {
  const anchor = startedAt || createdAt;
  if (!anchor) return 0;
  const t = Date.parse(anchor);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Date.now() - t);
}
