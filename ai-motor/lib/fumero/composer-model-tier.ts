/** Fumero chat model tier — Gemini-style Flash / Normaal / Pro. */

export type FumeroComposerModelTier = "flash" | "normaal" | "pro";

export const FUMERO_MODEL_TIER_STORAGE_KEY = "fumero-composer-model-tier";

export const FUMERO_MODEL_TIERS: Array<{
  id: FumeroComposerModelTier;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "flash",
    label: "Snel",
    shortLabel: "Snel",
    description: "Snelste antwoorden voor korte vragen",
  },
  {
    id: "normaal",
    label: "Normaal",
    shortLabel: "Normaal",
    description: "Gebalanceerd — dagelijkse taken en uitleg",
  },
  {
    id: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Diepgaander — complexe vragen en analyses",
  },
];

export function isFumeroComposerModelTier(v: unknown): v is FumeroComposerModelTier {
  return v === "flash" || v === "normaal" || v === "pro";
}

export function parseFumeroComposerModelTier(v: unknown): FumeroComposerModelTier | undefined {
  return isFumeroComposerModelTier(v) ? v : undefined;
}

export function readStoredFumeroModelTier(): FumeroComposerModelTier {
  if (typeof window === "undefined") return "flash";
  try {
    const raw = localStorage.getItem(FUMERO_MODEL_TIER_STORAGE_KEY);
    return parseFumeroComposerModelTier(raw) ?? "flash";
  } catch {
    return "flash";
  }
}

export function writeStoredFumeroModelTier(tier: FumeroComposerModelTier): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FUMERO_MODEL_TIER_STORAGE_KEY, tier);
  } catch {
    /* ignore */
  }
}

export function fumeroModelTierLabel(tier: FumeroComposerModelTier): string {
  return FUMERO_MODEL_TIERS.find((t) => t.id === tier)?.label ?? tier;
}
