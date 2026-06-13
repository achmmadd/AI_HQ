"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import {
  CODER_BUILD_PHASES,
  coderBuildProgressPercent,
} from "@/lib/fumero/coder-build-phases";
import { formatBouwenElapsedDutch } from "@/lib/fumero/tool-generation-progress";
import { cn } from "@/lib/utils";

export function FumeroBuildTimeline({
  activePhase,
  building,
  compact = false,
  showProgress = true,
  progressPct,
  elapsedMs,
}: {
  activePhase?: string;
  building?: boolean;
  compact?: boolean;
  showProgress?: boolean;
  /** Server-side voortgang overschrijft fase-index berekening. */
  progressPct?: number;
  elapsedMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [displayPct, setDisplayPct] = useState<number | null>(null);

  const activeIdx = activePhase
    ? CODER_BUILD_PHASES.findIndex((p) => p === activePhase)
    : building
      ? 0
      : CODER_BUILD_PHASES.length;

  const phaseProgress = coderBuildProgressPercent(activePhase, building ?? false);
  const targetPct =
    progressPct != null
      ? Math.min(99, Math.max(0, progressPct))
      : phaseProgress;

  useEffect(() => {
    if (!building || targetPct == null) {
      setDisplayPct(targetPct);
      return;
    }
    if (reduceMotion) {
      setDisplayPct(targetPct);
      return;
    }
    setDisplayPct((prev) => {
      if (prev == null) return targetPct;
      return Math.max(prev, targetPct);
    });
  }, [building, targetPct, reduceMotion]);

  const elapsedLabel =
    building && elapsedMs != null && elapsedMs > 0
      ? formatBouwenElapsedDutch(elapsedMs)
      : null;

  return (
    <div className="fumero-build-timeline-wrap">
      {showProgress && building ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--fumero-text-muted)]">
            {!reduceMotion ? (
              <span className="motors-typing-dot bg-[var(--fumero-text-subtle)]" aria-hidden />
            ) : null}
            Voortgang
          </span>
          <span className="text-[11px] tabular-nums text-[var(--fumero-text-subtle)]">
            {displayPct != null ? `${displayPct}%` : "…"}
            {elapsedLabel ? (
              <span className="ml-2 text-[var(--fumero-text-muted)]">{elapsedLabel}</span>
            ) : null}
          </span>
        </div>
      ) : null}
      {showProgress && building ? (
        <div
          className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--fumero-surface-muted)]"
          role="progressbar"
          aria-valuenow={displayPct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--fumero-accent)] transition-all duration-700 ease-out"
            style={{ width: `${displayPct ?? 12}%` }}
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
                "flex items-center gap-2.5 text-[12px] leading-snug transition-colors duration-300",
                done && "text-[var(--fumero-success-fg)]",
                current && "font-semibold text-[var(--fumero-text)]",
                !done && !current && "text-[var(--fumero-text-subtle)]"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
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
