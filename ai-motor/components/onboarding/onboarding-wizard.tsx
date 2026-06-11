"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepGoal } from "@/components/onboarding/steps/step-goal";
import { StepBusinessType } from "@/components/onboarding/steps/step-business-type";
import { StepCompanyDescription } from "@/components/onboarding/steps/step-company-description";
import { StepAiGeneration } from "@/components/onboarding/steps/step-ai-generation";
import { StepTeamReveal } from "@/components/onboarding/steps/step-team-reveal";
import { StepFirstAction } from "@/components/onboarding/steps/step-first-action";
import {
  BUSINESS_TYPE_OPTIONS,
  FIRST_ACTION_OPTIONS,
  getTeamForGoal,
  ONBOARDING_STEPS,
  type BusinessTypeId,
  type FirstActionId,
  type OnboardingGoalId,
} from "@/lib/onboarding-data";
import { StepShell } from "@/components/onboarding/step-shell";
import {
  clearOnboardingDraft,
  isOnboardingDone,
  markOnboardingDone,
  markOnboardingSkipped,
  readOnboardingDraft,
  writeOnboardingDraft,
} from "@/lib/onboarding-storage";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useAuthSession } from "@/hooks/useAuthSession";
import type { WorkspaceId } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL_WORKSPACES: WorkspaceId[] = ["fumero", "bokas", "personal"];
const AUTO_ADVANCE_MS = 380;

const NEXT_LABELS: Record<number, string> = {
  1: "Verder",
  2: "Verder",
  3: "Team samenstellen",
  5: "Kies eerste actie",
};

export function OnboardingWizard() {
  const router = useRouter();
  const { scope } = useAuthSession();
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<OnboardingGoalId | null>(null);
  const [businessType, setBusinessType] = useState<BusinessTypeId | null>(null);
  const [description, setDescription] = useState("");
  const [firstAction, setFirstAction] = useState<FirstActionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current != null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const draft = readOnboardingDraft();
    if (draft) {
      setStep(draft.step);
      setGoal(draft.goal);
      setBusinessType(draft.businessType);
      setDescription(draft.description);
      setFirstAction(draft.firstAction);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || isOnboardingDone()) return;
    writeOnboardingDraft({
      step,
      goal,
      businessType,
      description,
      firstAction,
    });
  }, [hydrated, step, goal, businessType, description, firstAction]);

  const allowedWorkspaces = useMemo(() => {
    if (scope === "all") return ALL_WORKSPACES;
    return ALL_WORKSPACES.filter((w) => w === scope);
  }, [scope]);

  const resolvedWorkspace = useMemo((): WorkspaceId => {
    const biz = BUSINESS_TYPE_OPTIONS.find((b) => b.id === businessType);
    if (biz && allowedWorkspaces.includes(biz.workspace)) return biz.workspace;
    return allowedWorkspaces[0] ?? "personal";
  }, [businessType, allowedWorkspaces]);

  const team = useMemo(
    () => getTeamForGoal(goal ?? "team-productivity"),
    [goal]
  );

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return goal != null;
      case 2:
        return businessType != null;
      case 3:
        return description.trim().length >= 20;
      case 4:
        return false;
      case 5:
        return true;
      case 6:
        return firstAction != null;
      default:
        return false;
    }
  }, [step, goal, businessType, description, firstAction]);

  const goNext = useCallback(() => {
    clearAdvanceTimer();
    setStep((s) => Math.min(s + 1, ONBOARDING_STEPS));
  }, [clearAdvanceTimer]);

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      goNext();
    }, AUTO_ADVANCE_MS);
  }, [clearAdvanceTimer, goNext]);

  const selectGoal = useCallback(
    (id: OnboardingGoalId) => {
      setGoal(id);
      if (step === 1) scheduleAdvance();
    },
    [step, scheduleAdvance]
  );

  const selectBusinessType = useCallback(
    (id: BusinessTypeId) => {
      setBusinessType(id);
      if (step === 2) scheduleAdvance();
    },
    [step, scheduleAdvance]
  );

  const goBack = useCallback(() => {
    clearAdvanceTimer();
    if (step === 5) {
      setStep(3);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  }, [step, clearAdvanceTimer]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  const handleSkip = useCallback(() => {
    if (saving) return;
    setWorkspace(resolvedWorkspace);
    markOnboardingSkipped(resolvedWorkspace);
    router.push("/");
  }, [resolvedWorkspace, saving, setWorkspace, router]);

  useEffect(() => {
    if (isOnboardingDone()) {
      router.replace("/");
    }
  }, [router]);

  const saveAndFinish = useCallback(async () => {
    if (!goal || !businessType || !firstAction) return;

    setSaving(true);
    setError(null);
    setWorkspace(resolvedWorkspace);

    const slug =
      resolvedWorkspace === "personal" ? "personal" : resolvedWorkspace;

    if (description.trim()) {
      try {
        const res = await fetch(`/api/workspaces/${slug}/context`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: description.trim() }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Bedrijfscontext opslaan mislukt");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
        setSaving(false);
        return;
      }
    }

    markOnboardingDone({
      workspace: resolvedWorkspace,
      goal,
      businessType,
      companyDescription: description.trim() || undefined,
      firstAction,
    });
    clearOnboardingDraft();

    const action = FIRST_ACTION_OPTIONS.find((a) => a.id === firstAction);
    const href = action?.href(resolvedWorkspace) ?? "/chat";
    router.push(href);
  }, [
    goal,
    businessType,
    firstAction,
    description,
    resolvedWorkspace,
    setWorkspace,
    router,
  ]);

  const showNav = step !== 4;
  const nextLabel = NEXT_LABELS[step] ?? "Verder";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || saving || !canContinue || step === 4) {
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA") return;
      e.preventDefault();
      if (step === 6) {
        void saveAndFinish();
      } else {
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canContinue, goNext, saveAndFinish, saving, step]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-accent/30" />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col bg-background text-foreground"
      style={
        {
          "--accent": "#0071e3",
          "--accent-hover": "#0077ed",
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[480px] rounded-full bg-foreground/[0.03] blur-[100px]" />
      </div>

      <header className="relative z-10 px-6 pt-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-3xl">
          <OnboardingProgress
            currentStep={step}
            onSkip={handleSkip}
            skipDisabled={saving}
          />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <StepShell stepKey="step-1">
                <StepGoal selected={goal} onSelect={selectGoal} />
              </StepShell>
            ) : null}
            {step === 2 ? (
              <StepShell stepKey="step-2">
                <StepBusinessType
                  selected={businessType}
                  allowedWorkspaces={allowedWorkspaces}
                  onSelect={selectBusinessType}
                />
              </StepShell>
            ) : null}
            {step === 3 ? (
              <StepShell stepKey="step-3">
                <StepCompanyDescription
                  value={description}
                  onChange={setDescription}
                  goal={goal}
                  businessType={businessType}
                />
              </StepShell>
            ) : null}
            {step === 4 ? (
              <StepShell stepKey="step-4">
                <StepAiGeneration onComplete={goNext} />
              </StepShell>
            ) : null}
            {step === 5 ? (
              <StepShell stepKey="step-5">
                <StepTeamReveal team={team} />
              </StepShell>
            ) : null}
            {step === 6 ? (
              <StepShell stepKey="step-6">
                <StepFirstAction selected={firstAction} onSelect={setFirstAction} />
              </StepShell>
            ) : null}
          </AnimatePresence>

          {error ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center text-sm text-error"
              role="alert"
            >
              {error}
            </motion.p>
          ) : null}
        </div>
      </main>

      {showNav ? (
        <footer className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10">
          <div
            className={cn(
              "mx-auto flex w-full max-w-3xl gap-3",
              step > 1 && step !== 5 ? "justify-between" : "justify-end"
            )}
          >
            {step > 1 && step !== 5 ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={goBack}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Terug
              </Button>
            ) : null}

            {step === 6 ? (
              <Button
                type="button"
                size="lg"
                disabled={!canContinue || saving}
                onClick={() => void saveAndFinish()}
                className="min-w-[180px] bg-accent hover:bg-accent-hover"
              >
                {saving ? "Afronden…" : "Naar werkplek"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={!canContinue}
                onClick={goNext}
                className="min-w-[140px] bg-accent hover:bg-accent-hover"
              >
                {nextLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
