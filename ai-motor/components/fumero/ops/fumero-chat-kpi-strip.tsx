"use client";

import Link from "next/link";
import { BookOpen, Clock, ShoppingBag, Workflow } from "lucide-react";
import { useFumeroStudioKpis } from "@/hooks/useFumeroStudioKpis";
import {
  formatHoursSaved,
  formatMonthlyCostEur,
} from "@/lib/fumero/studio-kpis";
import { cn } from "@/lib/utils";
import { FumeroWorkspaceHealth } from "@/components/fumero/ops/fumero-workspace-health";

function SidebarKpiCell({
  href,
  label,
  value,
  loading,
}: {
  href: string;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "fumero-kpi-cell flex min-w-0 flex-col gap-0.5 rounded-md px-1 py-1 transition-colors",
        "hover:bg-[var(--fumero-surface-muted)]"
      )}
    >
      <span className="builder-vi-label truncate text-[10px]">{label}</span>
      <span
        className={cn(
          "truncate font-mono text-[13px] font-semibold tabular-nums text-[var(--fumero-text)]",
          loading && "text-[var(--fumero-text-subtle)]"
        )}
      >
        {loading ? "…" : value}
      </span>
    </Link>
  );
}

/** Compact KPI grid in sidebar footer — Verdant Instrument mono labels. */
export function FumeroSidebarKpiFooter() {
  const {
    loading,
    activeAutomations,
    openOrdersCount,
    monthlyCostEur,
    hoursSaved,
  } = useFumeroStudioKpis();

  return (
    <div
      className="fumero-sidebar-kpi hidden border-t border-[var(--fumero-border)] px-3 py-3 md:block"
      aria-label="Studio overzicht"
    >
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        <SidebarKpiCell
          href="/fumero/orders"
          label="Bestellingen"
          loading={loading}
          value={openOrdersCount === null ? "—" : String(openOrdersCount)}
        />
        <SidebarKpiCell
          href="/fumero/automations"
          label="Automatiseringen"
          loading={loading}
          value={activeAutomations === null ? "—" : String(activeAutomations)}
        />
        <SidebarKpiCell
          href="/fumero/settings/billing"
          label="Kosten/maand"
          loading={loading}
          value={formatMonthlyCostEur(monthlyCostEur)}
        />
        <SidebarKpiCell
          href="/fumero"
          label="Besparing/maand"
          loading={loading}
          value={formatHoursSaved(hoursSaved)}
        />
      </div>
      <div className="mt-2.5 border-t border-[var(--fumero-border)] pt-2">
        <FumeroSidebarSystemStatus />
      </div>
    </div>
  );
}

function FumeroSidebarSystemStatus() {
  return <FumeroWorkspaceHealth variant="instrument" />;
}

/** @deprecated Use FumeroSidebarKpiFooter — kept for reference during migration. */
export function FumeroChatKpiStrip() {
  const {
    loading,
    libraryCount,
    activeAutomations,
    openOrdersCount,
    briefingAgeLabel,
  } = useFumeroStudioKpis();

  return (
    <div
      className="fumero-kpi-strip shrink-0 border-b border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-4 py-2"
      aria-label="Studio overzicht"
    >
      <div className="mx-auto flex max-w-3xl divide-x divide-[var(--fumero-border)]">
        {(
          [
            {
              href: "/fumero/bibliotheek",
              label: "Bibliotheek",
              value: libraryCount === null ? "—" : String(libraryCount),
              icon: BookOpen,
            },
            {
              href: "/fumero/automations",
              label: "Automatisering",
              value: activeAutomations === null ? "—" : String(activeAutomations),
              icon: Workflow,
            },
            {
              href: "/fumero/orders",
              label: "Bestellingen",
              value: openOrdersCount === null ? "—" : String(openOrdersCount),
              icon: ShoppingBag,
            },
            {
              href: "/fumero/chat",
              label: "Dagoverzicht",
              value: briefingAgeLabel ?? "—",
              icon: Clock,
            },
          ] as const
        ).map(({ href, label, value, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="fumero-kpi-cell group flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--fumero-surface-muted)]"
          >
            <span className="fumero-text-micro flex items-center gap-1 text-[var(--fumero-text-subtle)]">
              <Icon className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.5} />
              {label}
            </span>
            <span
              className={cn(
                "fumero-text-body-sm truncate font-semibold tabular-nums",
                loading && "text-[var(--fumero-text-subtle)]"
              )}
            >
              {loading ? "…" : value}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
