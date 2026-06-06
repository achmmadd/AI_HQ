const ONBOARDING_KEY = "motorsai-onboarding-v1";

export type OnboardingState = {
  completedAt: string;
  workspace: "fumero" | "bokas" | "personal";
};

export function readOnboardingState(): OnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingState;
    if (!parsed.completedAt || !parsed.workspace) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isOnboardingDone(): boolean {
  return readOnboardingState() != null;
}

export function markOnboardingDone(workspace: OnboardingState["workspace"]): void {
  if (typeof window === "undefined") return;
  const state: OnboardingState = {
    completedAt: new Date().toISOString(),
    workspace,
  };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}
