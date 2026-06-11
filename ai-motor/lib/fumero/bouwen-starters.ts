/** Snelstart-chips voor /fumero/bouwen — re-exported from builder-content */

import { BUILDER_SUGGESTIONS } from "@/lib/fumero/builder-content";

export type BouwenQuickStart = {
  label: string;
  prompt: string;
};

export const BOUWEN_QUICK_STARTS: BouwenQuickStart[] = BUILDER_SUGGESTIONS.map(
  (s) => ({ label: s.label, prompt: s.prompt }),
);
