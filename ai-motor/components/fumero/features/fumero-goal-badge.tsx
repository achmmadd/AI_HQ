"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { dispatchFumeroCmd, FUMERO_CMD_EVENTS } from "@/lib/fumero/command-palette";
import { FUMERO_GOAL_UPDATED_EVENT } from "@/lib/fumero/max-goal-shared";
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
    try {
      const res = await fetch(
        `/api/fumero/goal?klant=${encodeURIComponent(klant)}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { goals?: string | null };
      setGoals(json.goals?.trim() || null);
    } catch {
      /* ignore */
    }
  }, [klant]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(FUMERO_GOAL_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FUMERO_GOAL_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const label = goals
    ? goals.replace(/\s+/g, " ").slice(0, 72) +
      (goals.length > 72 ? "…" : "")
    : null;

  return (
    <button
      type="button"
      title={goals ?? "Doel instellen met /goal …"}
      className={cn(
        "inline-flex max-w-[min(100%,20rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        goals
          ? "border-[#69C400]/35 bg-[#69C400]/8 text-[#3d7a00] hover:bg-[#69C400]/12"
          : "border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] hover:border-[#69C400]/30 hover:text-[#525252]",
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
      <span className="truncate">{label ?? "Doel: /goal"}</span>
    </button>
  );
}
