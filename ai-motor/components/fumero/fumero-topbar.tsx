"use client";

import Link from "next/link";
import { ChevronRight, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FumeroTopbarBriefingControls,
  FumeroTopbarBriefingPanel,
  FumeroTopbarBriefingRoot,
  FumeroTopbarBriefingSummaryRow,
} from "@/components/fumero/ops/fumero-topbar-briefing";
import { FumeroWorkspaceHealth } from "@/components/fumero/ops/fumero-workspace-health";
import { useFumeroThemeStore } from "@/stores/useFumeroThemeStore";

export function FumeroTopbar({
  breadcrumbs,
  actionLabel,
  actionHref,
  showBriefing = false,
}: {
  breadcrumbs: Array<{ label: string; href?: string }>;
  actionLabel?: string;
  actionHref?: string;
  /** Show collapsible dagoverzicht in topbar (chat page). */
  showBriefing?: boolean;
}) {
  const preference = useFumeroThemeStore((s) => s.preference);
  const cyclePreference = useFumeroThemeStore((s) => s.cyclePreference);

  const ThemeIcon =
    preference === "dark" ? Moon : preference === "system" ? Monitor : Sun;

  const headerInner = (
    <>
      <div className="flex h-12 items-center gap-3 px-4 md:px-6">
        <nav
          className="fumero-text-body-sm flex min-w-0 flex-1 items-center gap-1"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--fumero-text-subtle)]"
                  aria-hidden
                  strokeWidth={1.5}
                />
              ) : null}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-[var(--fumero-text-muted)] rounded-sm hover:text-[var(--fumero-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fumero-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fumero-surface)]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-[var(--fumero-text)]">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => cyclePreference()}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-[var(--fumero-border)] px-2 fumero-text-micro text-[var(--fumero-text-muted)] transition-colors hover:bg-[var(--fumero-surface-muted)] hover:text-[var(--fumero-text)] sm:flex"
            title="Thema wisselen (ook via ⌘K)"
            aria-label="Thema wisselen"
          >
            <ThemeIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            <kbd className="hidden rounded border border-[var(--fumero-border-subtle)] bg-[var(--fumero-surface-muted)] px-1 py-0.5 font-mono text-[10px] md:inline">
              ⌘K
            </kbd>
          </button>
          {showBriefing ? <FumeroTopbarBriefingControls /> : null}
          <FumeroWorkspaceHealth />
          {actionLabel && actionHref ? (
            <Button
              asChild
              size="sm"
              className="fumero-text-body-sm h-9 rounded-lg bg-[var(--fumero-accent)] font-semibold text-[var(--fumero-accent-foreground)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
            >
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {showBriefing ? <FumeroTopbarBriefingSummaryRow /> : null}
      {showBriefing ? <FumeroTopbarBriefingPanel /> : null}
    </>
  );

  return (
    <header className="fumero-shell-topbar shrink-0">
      {showBriefing ? (
        <FumeroTopbarBriefingRoot>{headerInner}</FumeroTopbarBriefingRoot>
      ) : (
        headerInner
      )}
    </header>
  );
}
