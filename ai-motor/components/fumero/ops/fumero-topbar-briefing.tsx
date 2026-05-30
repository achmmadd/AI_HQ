"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { formatBriefingTime } from "@/lib/fumero/max-briefing-chat";
import { useFumeroBriefing } from "@/components/fumero/max/fumero-briefing-provider";
import { MaxBriefingDetailPanel } from "@/components/fumero/max/max-briefing-detail-panel";
import { cn } from "@/lib/utils";

const BRIEFING_COLLAPSED_KEY = "fumero-briefing-collapsed";

type BriefingUiState = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const BriefingUiContext = createContext<BriefingUiState | null>(null);

function useBriefingUi() {
  const ctx = useContext(BriefingUiContext);
  if (!ctx) {
    throw new Error("Briefing UI must be used within FumeroTopbarBriefingRoot");
  }
  return ctx;
}

export function FumeroTopbarBriefingRoot({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BRIEFING_COLLAPSED_KEY);
      setCollapsed(stored !== "false");
    } catch {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BRIEFING_COLLAPSED_KEY, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <BriefingUiContext.Provider value={{ collapsed, toggleCollapsed }}>
      {children}
    </BriefingUiContext.Provider>
  );
}

export function FumeroTopbarBriefingControls() {
  const { data, loading, setPanelOpen } = useFumeroBriefing();
  const { collapsed, toggleCollapsed } = useBriefingUi();

  const actionCount =
    (data?.actions.length ?? 0) + (data?.opportunities.length ?? 0);

  const timeLabel = data?.generated_at
    ? formatBriefingTime(data.generated_at)
    : loading
      ? "laden…"
      : "—";

  return (
    <div className="flex min-w-0 items-center gap-2 border-l border-[var(--fumero-border)] pl-3">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="fumero-text-micro inline-flex shrink-0 items-center gap-1 text-[var(--fumero-text-subtle)] hover:text-[var(--fumero-text-muted)]"
        aria-expanded={!collapsed}
      >
        Dagoverzicht
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            !collapsed && "rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>
      <span className="fumero-text-micro hidden tabular-nums text-[var(--fumero-text-subtle)] sm:inline">
        {timeLabel}
      </span>
      {actionCount > 0 ? (
        <span className="fumero-text-caption inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--fumero-text)] px-1.5 py-0.5 tabular-nums text-white">
          {actionCount}
        </span>
      ) : null}
      <button
        type="button"
        className="fumero-text-body-sm shrink-0 font-medium text-[var(--fumero-accent)] hover:text-[var(--fumero-accent-hover)]"
        onClick={() => setPanelOpen(true)}
      >
        Details
      </button>
    </div>
  );
}

export function FumeroTopbarBriefingSummaryRow() {
  const { data, loading } = useFumeroBriefing();
  const { collapsed } = useBriefingUi();

  if (collapsed) return null;

  return (
    <div className="border-t border-[var(--fumero-border-subtle)] bg-[var(--fumero-surface-muted)] px-4 py-2 md:px-6">
      <p className="fumero-text-body-sm truncate text-[var(--fumero-text-muted)]">
        {loading ? "laden…" : data?.summary ?? "Geen dagoverzicht beschikbaar"}
      </p>
    </div>
  );
}

export function FumeroTopbarBriefingPanel() {
  const { data, panelOpen, setPanelOpen, sendFromBriefing } = useFumeroBriefing();

  return (
    <MaxBriefingDetailPanel
      open={panelOpen}
      briefing={data}
      onClose={() => setPanelOpen(false)}
      onActionSelect={(prompt) => {
        setPanelOpen(false);
        sendFromBriefing(prompt);
      }}
    />
  );
}
