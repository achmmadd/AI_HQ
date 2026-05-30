"use client";

import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

/** Plan-modus: eerst stappenplan, daarna uitvoeren op verzoek. */
export function MotorPlanButton({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? "Plan-modus uit" : "Plan-modus aan"}
      title={
        active
          ? "Plan aan — Motor maakt eerst een plan. Tik om uit."
          : "Plan — eerst stappenplan, daarna uitvoeren (zeg “ga door”)"
      }
      onClick={onToggle}
      className={cn(
        "ios-tap-highlight relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
        active
          ? "bg-violet-500/25 text-violet-200 ring-2 ring-violet-400/45"
          : "text-text-secondary hover:bg-violet-500/10 hover:text-violet-300",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <ClipboardList className={cn("h-[18px] w-[18px]", active && "scale-105")} />
    </button>
  );
}
