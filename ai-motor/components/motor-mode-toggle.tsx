"use client";

import { cn } from "@/lib/utils";

export type MotorChatMode = "motor" | "motor_pro";

export function MotorModeToggle({
  mode,
  onChange,
  disabled,
  motorProAvailable,
}: {
  mode: MotorChatMode;
  onChange: (mode: MotorChatMode) => void;
  disabled?: boolean;
  motorProAvailable: boolean;
}) {
  return (
    <div
      className="flex shrink-0 rounded-full border border-border/60 bg-surface/80 p-0.5"
      role="group"
      aria-label="Chatmodus"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={mode === "motor"}
        title="Motor — chat, web, bestanden op de NUC"
        className={cn(
          "ios-tap-highlight min-h-[32px] rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
          mode === "motor"
            ? "bg-surface-elevated text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        )}
        onClick={() => onChange("motor")}
      >
        Motor
      </button>
      <button
        type="button"
        disabled={disabled || !motorProAvailable}
        aria-pressed={mode === "motor_pro"}
        title={
          motorProAvailable
            ? "Motor Pro — browser, automation, computer-use"
            : "Motor Pro is niet geconfigureerd"
        }
        className={cn(
          "ios-tap-highlight min-h-[32px] rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
          mode === "motor_pro"
            ? "bg-accent/20 text-accent shadow-sm"
            : "text-text-secondary hover:text-text-primary disabled:opacity-40"
        )}
        onClick={() => onChange("motor_pro")}
      >
        Pro
      </button>
    </div>
  );
}
