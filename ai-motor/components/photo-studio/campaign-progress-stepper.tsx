"use client";

import { Check, Loader2 } from "lucide-react";
import {
  CAMPAIGN_PROGRESS_STEPS,
  campaignStepIndex,
} from "@/lib/photo-studio/campaign/progress-steps";
import { cn } from "@/lib/utils";

type Props = {
  phase: string | null;
  message?: string | null;
  className?: string;
};

export function CampaignProgressStepper({ phase, message, className }: Props) {
  const activeIndex = campaignStepIndex(phase);

  return (
    <div className={cn("w-full max-w-lg space-y-4", className)}>
      <ol className="space-y-2">
        {CAMPAIGN_PROGRESS_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 fumero-text-body-sm transition-colors",
                done
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                  : active
                    ? "border-[var(--fumero-accent)] bg-[var(--fumero-accent-muted)] text-[var(--fumero-text)]"
                    : "border-[var(--fumero-border)] text-[var(--fumero-text-muted)]"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {done ? (
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--fumero-accent)]" aria-hidden />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </span>
              <span className={cn(active && "font-semibold")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      {message ? (
        <p className="text-center fumero-text-caption text-[var(--fumero-text-muted)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
