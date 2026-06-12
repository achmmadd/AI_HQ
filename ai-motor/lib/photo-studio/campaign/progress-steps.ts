/** Human-readable Campaign Studio progress steps for the wizard UI. */
export const CAMPAIGN_PROGRESS_STEPS = [
  { id: "strategy", label: "Strategie maken" },
  { id: "copy", label: "Copy maken" },
  { id: "static", label: "Visuals voorbereiden" },
  { id: "video", label: "Media genereren" },
  { id: "zip", label: "Pack klaar" },
] as const;

export type CampaignProgressStepId = (typeof CAMPAIGN_PROGRESS_STEPS)[number]["id"];

export function campaignStepIndex(phase: string | null | undefined): number {
  if (!phase) return 0;
  const idx = CAMPAIGN_PROGRESS_STEPS.findIndex((s) => s.id === phase);
  return idx >= 0 ? idx : 0;
}

export function campaignPhaseLabel(phase: string | null | undefined): string {
  const step = CAMPAIGN_PROGRESS_STEPS.find((s) => s.id === phase);
  return step?.label ?? "Voorbereiden…";
}
