"use client";

import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  progress: number;
  etaSeconds: number;
  onCancel?: () => void;
  className?: string;
};

/** Apple-clean thin progress bar + ETA + optional cancel during generation. */
export function ContentStudioGenerationProgress({
  progress,
  etaSeconds,
  onCancel,
  className,
}: Props) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("space-y-1.5", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--fumero-text-subtle)]">
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin text-[var(--fumero-accent)]" aria-hidden />
          Genereren…
        </span>
        <span className="tabular-nums">~{etaSeconds} sec</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--fumero-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--fumero-accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-[var(--fumero-text-muted)] transition-colors hover:bg-[var(--fumero-surface-muted)] hover:text-[var(--fumero-text)]"
        >
          <X className="h-3 w-3" />
          Annuleren
        </button>
      ) : null}
    </div>
  );
}
