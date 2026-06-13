import type { CampaignGoal } from "@/lib/photo-studio/campaign/types";

export type CampaignWizardSessionState = {
  step: "generate" | "preview";
  jobId: string;
  packId?: string;
  selectedKitId: string;
  goal: CampaignGoal;
  startedAt: number;
};

export const WIZARD_STEPS = [
  { id: "brand", label: "Brand Kit" },
  { id: "goal", label: "Campagnedoel" },
  { id: "concepts", label: "Advertentieconcepten" },
  { id: "generate", label: "Genereren" },
  { id: "preview", label: "Preview" },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step);
}

export function wizardPrevStep(step: WizardStep): WizardStep | null {
  const idx = wizardStepIndex(step);
  if (idx <= 0) return null;
  return WIZARD_STEPS[idx - 1]!.id;
}

export function wizardNextStep(step: WizardStep): WizardStep | null {
  const idx = wizardStepIndex(step);
  if (idx < 0 || idx >= WIZARD_STEPS.length - 1) return null;
  return WIZARD_STEPS[idx + 1]!.id;
}

export function canAdvanceWizardStep(
  step: WizardStep,
  ctx: { selectedKitId: string | null; hasStrategy: boolean }
): boolean {
  if (step === "brand") return Boolean(ctx.selectedKitId);
  if (step === "goal") return Boolean(ctx.selectedKitId);
  if (step === "concepts") return Boolean(ctx.selectedKitId && ctx.hasStrategy);
  return false;
}

export function parseWizardStep(raw: string | null | undefined): WizardStep | null {
  if (!raw) return null;
  return WIZARD_STEPS.some((s) => s.id === raw) ? (raw as WizardStep) : null;
}

export function parseCampaignGoal(raw: string | null | undefined): CampaignGoal | null {
  const goals: CampaignGoal[] = ["verkoop", "bereik", "retargeting"];
  return goals.includes(raw as CampaignGoal) ? (raw as CampaignGoal) : null;
}

/** In-flight generation and preview cannot be restored after refresh (pack not in storage). */
export function sanitizeWizardStepAfterRefresh(
  step: WizardStep,
  session?: CampaignWizardSessionState | null
): WizardStep {
  if (session && (step === "generate" || step === "preview")) {
    return session.step;
  }
  return step === "generate" || step === "preview" ? "concepts" : step;
}
