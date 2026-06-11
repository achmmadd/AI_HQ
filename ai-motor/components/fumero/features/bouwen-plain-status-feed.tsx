"use client";
import { Check } from "lucide-react";
import { bouwenHumanStatusLabel } from "@/lib/fumero/bouwen-status-labels";
import { cn } from "@/lib/utils";
function BouwenTypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} aria-hidden>
      {" "}
      <span className="motors-typing-dot bg-[var(--fumero-accent)]/70" />{" "}
      <span className="motors-typing-dot bg-[var(--fumero-accent)]/70" />{" "}
      <span className="motors-typing-dot bg-[var(--fumero-accent)]/70" />{" "}
    </span>
  );
} /** Compacte status in gewone taal; technische stappen onder Details. */
export function BouwenPlainStatusFeed({
  statusLabel,
  activities,
  stuckHint,
  done = false,
  building = false,
  className,
}: {
  statusLabel?: string | null;
  activities: string[];
  stuckHint?: string | null;
  done?: boolean;
  building?: boolean;
  className?: string;
}) {
  const humanCurrent = bouwenHumanStatusLabel(statusLabel, { done, building });
  const technicalLines = [
    ...new Set(
      activities
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line !== humanCurrent),
    ),
  ];
  const showDetails =
    !done &&
    technicalLines.length > 0 &&
    technicalLines.some((line) => line !== statusLabel?.trim());
  return (
    <div className={cn("space-y-2", className)}>
      {" "}
      <div
        className="flex items-center gap-2 text-[13px] font-medium leading-snug text-[var(--fumero-text)]"
        aria-live="polite"
      >
        {" "}
        {done ? (
          <Check
            className="h-4 w-4 shrink-0 text-[var(--fumero-accent)]"
            aria-hidden
          />
        ) : (
          <BouwenTypingDots className="shrink-0" />
        )}{" "}
        <span>{humanCurrent}</span>{" "}
      </div>{" "}
      {showDetails ? (
        <details className="text-[11px] text-[var(--fumero-text-muted)]">
          {" "}
          <summary className="cursor-pointer select-none text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]">
            {" "}
            Details{" "}
          </summary>{" "}
          <ul className="mt-1.5 max-h-36 space-y-0.5 overflow-y-auto border-l border-[var(--fumero-border)] pl-3">
            {" "}
            {technicalLines.map((line) => (
              <li key={line}>{line}</li>
            ))}{" "}
          </ul>{" "}
        </details>
      ) : null}{" "}
      {stuckHint ? (
        <p
          className="text-[11px] text-[var(--fumero-text-muted)]"
          aria-live="polite"
        >
          {" "}
          {stuckHint}{" "}
        </p>
      ) : null}{" "}
    </div>
  );
}
