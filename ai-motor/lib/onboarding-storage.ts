import type {
  BusinessTypeId,
  FirstActionId,
  OnboardingGoalId,
} from "@/lib/onboarding-data";
import type { WorkspaceId } from "@/lib/types";

const ONBOARDING_KEY = "motorsai-onboarding-v2";
const DRAFT_KEY = "motorsai-onboarding-draft";

export type OnboardingDraft = {
  step: number;
  goal: OnboardingGoalId | null;
  businessType: BusinessTypeId | null;
  description: string;
  firstAction: FirstActionId | null;
};

export type OnboardingStatus = "completed" | "skipped";

export type OnboardingState = {
  completedAt: string;
  status: OnboardingStatus;
  workspace: WorkspaceId;
  goal?: OnboardingGoalId;
  businessType?: BusinessTypeId;
  companyDescription?: string;
  firstAction?: FirstActionId;
};

export type CompletedOnboardingState = OnboardingState & {
  status: "completed";
  goal: OnboardingGoalId;
  businessType: BusinessTypeId;
};

function parseOnboardingState(raw: string): OnboardingState | null {
  const parsed = JSON.parse(raw) as Partial<OnboardingState>;
  if (!parsed.completedAt || !parsed.workspace) return null;

  if (parsed.status === "skipped") {
    return {
      completedAt: parsed.completedAt,
      status: "skipped",
      workspace: parsed.workspace,
    };
  }

  if (!parsed.goal || !parsed.businessType) return null;

  return {
    completedAt: parsed.completedAt,
    status: parsed.status ?? "completed",
    workspace: parsed.workspace,
    goal: parsed.goal,
    businessType: parsed.businessType,
    companyDescription: parsed.companyDescription,
    firstAction: parsed.firstAction,
  };
}

export function readOnboardingState(): OnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    return parseOnboardingState(raw);
  } catch {
    return null;
  }
}

export function isOnboardingDone(): boolean {
  return readOnboardingState() != null;
}

export function markOnboardingDone(
  state: Omit<CompletedOnboardingState, "completedAt" | "status">
): void {
  if (typeof window === "undefined") return;
  const payload: CompletedOnboardingState = {
    ...state,
    status: "completed",
    completedAt: new Date().toISOString(),
  };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(payload));
}

export function markOnboardingSkipped(workspace: WorkspaceId): void {
  if (typeof window === "undefined") return;
  const payload: OnboardingState = {
    status: "skipped",
    workspace,
    completedAt: new Date().toISOString(),
  };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(payload));
  clearOnboardingDraft();
}

export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!parsed.step || parsed.step < 1 || parsed.step > 6) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearOnboardingDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}
