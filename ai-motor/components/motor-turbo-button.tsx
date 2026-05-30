"use client";

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Turbo = browser & automation. Uit = gewone Motor-chat. */
export function MotorTurboButton({
  active,
  onToggle,
  disabled,
  available,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  available: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || (!available && !active)}
      aria-pressed={active}
      aria-label={active ? "Turbo uit" : "Turbo aan"}
      title={
        !available
          ? "Turbo niet beschikbaar op de server"
          : active
            ? "Turbo aan — tik om terug naar Motor"
            : "Turbo — browser & automation"
      }
      onClick={() => {
        if (!available && !active) return;
        onToggle();
      }}
      className={cn(
        "ios-tap-highlight relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
        active
          ? "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/35 ring-2 ring-amber-400/40"
          : "text-text-secondary hover:bg-amber-500/10 hover:text-amber-400",
        (disabled || (!available && !active)) && "cursor-not-allowed opacity-40"
      )}
    >
      <Zap
        className={cn(
          "h-[18px] w-[18px] transition-transform",
          active && "fill-current scale-110"
        )}
      />
      {active && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-background"
          aria-hidden
        />
      )}
    </button>
  );
}
