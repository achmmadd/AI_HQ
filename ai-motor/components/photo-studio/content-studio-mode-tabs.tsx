"use client";

import { Grid3X3, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudioLeftMode = "standard" | "agent";

type Props = {
  value: StudioLeftMode;
  onChange: (mode: StudioLeftMode) => void;
};

/** Segmented control: Standaard vs AI Agent (split Studio only). */
export function ContentStudioModeTabs({ value, onChange }: Props) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--fumero-border)] p-0.5"
      role="tablist"
      aria-label="Studio modus"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "standard"}
        className={cn(
          "content-studio-media-btn inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 fumero-text-body-sm font-medium transition-colors",
          value === "standard"
            ? "content-studio-media-btn--active"
            : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
        )}
        onClick={() => onChange("standard")}
      >
        <Grid3X3 className="h-3.5 w-3.5 opacity-80" strokeWidth={1.75} />
        Standaard
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "agent"}
        className={cn(
          "content-studio-media-btn inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 fumero-text-body-sm font-medium transition-colors",
          value === "agent"
            ? "content-studio-media-btn--active"
            : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
        )}
        onClick={() => onChange("agent")}
      >
        <MessageCircle className="h-3.5 w-3.5 opacity-80" strokeWidth={1.75} />
        AI Agent
      </button>
    </div>
  );
}
