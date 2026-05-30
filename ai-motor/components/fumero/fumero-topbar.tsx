"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FumeroTopbarBriefingControls,
  FumeroTopbarBriefingPanel,
  FumeroTopbarBriefingRoot,
  FumeroTopbarBriefingSummaryRow,
} from "@/components/fumero/ops/fumero-topbar-briefing";
import { FumeroWorkspaceHealth } from "@/components/fumero/ops/fumero-workspace-health";

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
                  className="truncate text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
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
          {showBriefing ? <FumeroTopbarBriefingControls /> : null}
          <FumeroWorkspaceHealth />
          {actionLabel && actionHref ? (
            <Button
              asChild
              size="sm"
              className="fumero-text-body-sm h-9 rounded-lg bg-[var(--fumero-accent)] font-semibold text-white shadow-none hover:bg-[var(--fumero-accent-hover)]"
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
    <header className="shrink-0 border-b border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
      {showBriefing ? (
        <FumeroTopbarBriefingRoot>{headerInner}</FumeroTopbarBriefingRoot>
      ) : (
        headerInner
      )}
    </header>
  );
}
