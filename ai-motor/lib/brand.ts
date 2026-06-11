/** Canonical MotorsAI brand & workspace labels for all user-facing UI. */

export const MOTORSAI = {
  name: "MotorsAI",
  tagline: "Enterprise AI-automatisering voor het Nederlandse MKB",
  accent: "#69C400",
  contactEmail: "info@motorsai.nl",
} as const;

/** Personal / platform workspace label in nav & settings. */
export const MOTORSAI_WORKSPACE_LABEL = "MotorsAI";

export const WORKSPACE_LABELS = {
  fumero: "Fumero Studio",
  bokas: "Bokas",
  personal: MOTORSAI_WORKSPACE_LABEL,
} as const;
