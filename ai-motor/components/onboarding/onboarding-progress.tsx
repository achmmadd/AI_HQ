"use client";

import { motion } from "framer-motion";
import { ONBOARDING_STEPS } from "@/lib/onboarding-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type OnboardingProgressProps = {
  currentStep: number;
  className?: string;
  onSkip?: () => void;
  skipDisabled?: boolean;
};

export function OnboardingProgress({
  currentStep,
  className,
  onSkip,
  skipDisabled = false,
}: OnboardingProgressProps) {
  const progress = (currentStep / ONBOARDING_STEPS) * 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          MotorsAI
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:inline">
            Stap {currentStep} van {ONBOARDING_STEPS}
          </span>
        </div>
      </div>
      <div className="mb-2 flex justify-end sm:hidden">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Stap {currentStep} van {ONBOARDING_STEPS}
        </span>
      </div>
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
      </div>
      {onSkip ? (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            disabled={skipDisabled}
            className="text-[12px] font-normal normal-case tracking-normal text-muted-foreground transition-colors hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            Overslaan
          </button>
        </div>
      ) : null}
    </div>
  );
}
