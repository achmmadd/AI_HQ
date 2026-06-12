import type { CampaignGoal } from "@/lib/photo-studio/campaign/types";
import {
  parseCampaignGoal,
  parseWizardStep,
  sanitizeWizardStepAfterRefresh,
  type WizardStep,
} from "@/lib/photo-studio/campaign/wizard-steps";

export const CAMPAIGN_WIZARD_STORAGE_KEY = "fumero-campaign-wizard-v1";

export type CampaignWizardPersistedState = {
  step: WizardStep;
  selectedKitId: string | null;
  goal: CampaignGoal;
};

export const CAMPAIGN_WIZARD_DEFAULT: CampaignWizardPersistedState = {
  step: "brand",
  selectedKitId: null,
  goal: "verkoop",
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readCampaignWizardState(
  storage: StorageLike | null | undefined
): CampaignWizardPersistedState {
  if (!storage) return { ...CAMPAIGN_WIZARD_DEFAULT };
  try {
    const raw = storage.getItem(CAMPAIGN_WIZARD_STORAGE_KEY);
    if (!raw) return { ...CAMPAIGN_WIZARD_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<CampaignWizardPersistedState>;
    const step = sanitizeWizardStepAfterRefresh(
      parseWizardStep(parsed.step) ?? CAMPAIGN_WIZARD_DEFAULT.step
    );
    const goal = parseCampaignGoal(parsed.goal) ?? CAMPAIGN_WIZARD_DEFAULT.goal;
    const selectedKitId =
      typeof parsed.selectedKitId === "string" && parsed.selectedKitId.trim()
        ? parsed.selectedKitId.trim()
        : null;
    return { step, selectedKitId, goal };
  } catch {
    return { ...CAMPAIGN_WIZARD_DEFAULT };
  }
}

export function writeCampaignWizardState(
  state: CampaignWizardPersistedState,
  storage: StorageLike | null | undefined
): void {
  if (!storage) return;
  try {
    storage.setItem(CAMPAIGN_WIZARD_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearCampaignWizardState(storage: StorageLike | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(CAMPAIGN_WIZARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildCampaignWizardSearchParams(
  state: Pick<CampaignWizardPersistedState, "step" | "selectedKitId"> &
    Partial<Pick<CampaignWizardPersistedState, "goal">>
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("step", state.step);
  if (state.selectedKitId) params.set("kit", state.selectedKitId);
  if (state.goal && state.goal !== "verkoop") params.set("goal", state.goal);
  return params;
}

export function readCampaignWizardFromSearchParams(
  params: URLSearchParams
): Partial<CampaignWizardPersistedState> {
  const step = parseWizardStep(params.get("step"));
  const goal = parseCampaignGoal(params.get("goal"));
  const kit = params.get("kit")?.trim();
  return {
    ...(step ? { step: sanitizeWizardStepAfterRefresh(step) } : {}),
    ...(kit ? { selectedKitId: kit } : {}),
    ...(goal ? { goal } : {}),
  };
}
