"use client";

import { Check, Loader2 } from "lucide-react";
import {
  CODER_BUILD_PHASES,
  coderBuildProgressPercent,
} from "@/lib/fumero/coder-build-phases";
import { cn } from "@/lib/utils";

export function FumeroBuildTimeline({
  activePhase,
  building,
  compact = false,
  showProgress = true,
}: {
  activePhase?: string;
  building?: boolean;
  compact?: boolean;
  showProgress?: boolean;
}) {
  const activeIdx = activePhase
    ? CODER_BUILD_PHASES.findIndex((p) => p === activePhase)
    : building
      ? 0
      : CODER_BUILD_PHASES.length;

  const progress = coderBuildProgressPercent(activePhase, building ?? false);

  return (
    <div className="fumero-build-timeline-wrap">
      {showProgress && building ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--fumero-text-muted)]">Voortgang</span>
          <span className="text-[11px] tabular-nums text-[var(--fumero-text-subtle)]">{progress}%</span>
        </div>
      ) : null}
      {showProgress && building ? (
        <div
          className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--fumero-surface-muted)]"
          role="progressbar"
          aria-valuenow={progress ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--fumero-accent)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <ol
        className={cn(
          "fumero-build-timeline",
          compact ? "space-y-1.5" : "space-y-2"
        )}
        aria-label="Bouwstappen"
      >
        {CODER_BUILD_PHASES.map((phase, i) => {
          const done = building ? i < activeIdx : activeIdx >= CODER_BUILD_PHASES.length || i < activeIdx;
          const current =
            building && (i === activeIdx || (activeIdx < 0 && i === 0));
          return (
            <li
              key={phase}
              className={cn(
                "flex items-center gap-2.5 text-[12px] leading-snug",
                done && "text-[var(--fumero-success-fg)]",
                current && "font-semibold text-[var(--fumero-text)]",
                !done && !current && "text-[var(--fumero-text-subtle)]"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  done && "border-[var(--fumero-accent)] bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)]",
                  current && "border-[var(--fumero-accent)] bg-[var(--fumero-surface)]",
                  !done && !current && "border-[var(--fumero-border)] bg-[var(--fumero-surface)]"
                )}
                aria-hidden
              >
                {done ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : current ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--fumero-accent)]" />
                ) : null}
              </span>
              <span>{phase}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
