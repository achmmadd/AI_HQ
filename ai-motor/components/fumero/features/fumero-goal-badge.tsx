"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { dispatchFumeroCmd, FUMERO_CMD_EVENTS } from "@/lib/fumero/command-palette";
import {
  FUMERO_GOAL_UPDATED_EVENT,
  goalDisplayLabel,
} from "@/lib/fumero/max-goal-shared";
import { fetchJsonOptional } from "@/lib/fetch-json-client";
import { cn } from "@/lib/utils";

export function FumeroGoalBadge({
  klant = "fumero",
  className,
  onEdit,
}: {
  klant?: string;
  className?: string;
  onEdit?: (prefill: string) => void;
}) {
  const [goals, setGoals] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const json = await fetchJsonOptional<{ goals?: string | null }>(
      `/api/fumero/goal?klant=${encodeURIComponent(klant)}`,
      { credentials: "include" }
    );
    setGoals(json?.goals?.trim() || null);
  }, [klant]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(FUMERO_GOAL_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FUMERO_GOAL_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const label = goals ? goalDisplayLabel(goals) || null : null;
  const hasGoal = Boolean(label);

  return (
    <button
      type="button"
      title={hasGoal ? label! : "Doel instellen met /goal …"}
      className={cn(
        "inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        hasGoal
          ? "border-[var(--fumero-success-border)] bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)] hover:bg-[var(--fumero-accent-muted)]"
          : "border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)] hover:border-[var(--fumero-border-strong)] hover:text-[var(--fumero-text)]",
        className
      )}
      onClick={() => {
        if (onEdit) {
          onEdit(goals ? `/goal ${goals.split("\n")[0]?.replace(/^-\s*/, "") ?? ""}` : "/goal ");
          return;
        }
        dispatchFumeroCmd(FUMERO_CMD_EVENTS.focusComposer, {
          prompt: goals ? "/goal " : "/goal ",
        });
      }}
    >
      <Target className="h-3 w-3 shrink-0" />
      <span className="truncate">{hasGoal ? label : "Doel instellen"}</span>
    </button>
  );
}
