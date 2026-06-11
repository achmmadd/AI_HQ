export type PendingBouwenClarify = {
  seedPrompt: string;
  clarifications: string[];
};

const STORAGE_KEY = "fumero-pending-bouwen-clarify";

export function readPendingBouwenClarify(): PendingBouwenClarify | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBouwenClarify;
    if (
      typeof parsed?.seedPrompt !== "string" ||
      !Array.isArray(parsed.clarifications)
    ) {
      return null;
    }
    return {
      seedPrompt: parsed.seedPrompt,
      clarifications: parsed.clarifications.filter(
        (c): c is string => typeof c === "string"
      ),
    };
  } catch {
    return null;
  }
}

export function writePendingBouwenClarify(state: PendingBouwenClarify | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!state) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}
