import type { CampaignGoal } from "@/lib/photo-studio/campaign/types";
import {
  parseCampaignGoal,
  parseWizardStep,
  sanitizeWizardStepAfterRefresh,
  type CampaignWizardSessionState,
  type WizardStep,
} from "@/lib/photo-studio/campaign/wizard-steps";

export type { CampaignWizardSessionState } from "@/lib/photo-studio/campaign/wizard-steps";

export const CAMPAIGN_WIZARD_STORAGE_KEY = "fumero-campaign-wizard-v1";
/** Session-scoped job resume (generate/preview refresh within same tab). */
export const CAMPAIGN_WIZARD_SESSION_KEY = "fumero-campaign-wizard-session-v1";

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

export function readCampaignWizardSession(
  storage: StorageLike | null | undefined
): CampaignWizardSessionState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CAMPAIGN_WIZARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignWizardSessionState>;
    if (
      (parsed.step !== "generate" && parsed.step !== "preview") ||
      typeof parsed.jobId !== "string" ||
      !parsed.jobId.trim() ||
      typeof parsed.selectedKitId !== "string" ||
      !parsed.selectedKitId.trim()
    ) {
      return null;
    }
    const goal = parseCampaignGoal(parsed.goal as string) ?? CAMPAIGN_WIZARD_DEFAULT.goal;
    const startedAt =
      typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)
        ? parsed.startedAt
        : Date.now();
    if (Date.now() - startedAt > 600_000) return null;
    return {
      step: parsed.step,
      jobId: parsed.jobId.trim(),
      packId: typeof parsed.packId === "string" ? parsed.packId.trim() : undefined,
      selectedKitId: parsed.selectedKitId.trim(),
      goal,
      startedAt,
    };
  } catch {
    return null;
  }
}

export function writeCampaignWizardSession(
  state: CampaignWizardSessionState,
  storage: StorageLike | null | undefined
): void {
  if (!storage) return;
  try {
    storage.setItem(CAMPAIGN_WIZARD_SESSION_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearCampaignWizardSession(storage: StorageLike | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(CAMPAIGN_WIZARD_SESSION_KEY);
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
