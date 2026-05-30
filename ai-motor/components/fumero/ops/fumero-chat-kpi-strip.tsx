"use client";

import Link from "next/link";
import { BookOpen, ShoppingBag, Workflow, Clock } from "lucide-react";
import { useFumeroStudioKpis } from "@/hooks/useFumeroStudioKpis";
import { cn } from "@/lib/utils";

function SidebarKpiItem({
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
        "fumero-kpi-cell flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1 py-1 transition-colors",
        "hover:bg-[var(--fumero-surface-muted)]"
      )}
    >
      <span className="fumero-text-micro truncate text-[var(--fumero-text-subtle)]">
        {label}
      </span>
      <span
        className={cn(
          "fumero-text-body-sm truncate font-semibold tabular-nums text-[var(--fumero-text)]",
          loading && "text-[var(--fumero-text-subtle)]"
        )}
      >
        {loading ? "…" : value}
      </span>
    </Link>
  );
}

/** Compact KPI grid in sidebar footer — replaces horizontal strip above chat. */
export function FumeroSidebarKpiFooter() {
  const {
    loading,
    libraryCount,
    activeAutomations,
    openOrdersCount,
    briefingAgeLabel,
  } = useFumeroStudioKpis();

  return (
    <div
      className="fumero-sidebar-kpi hidden border-t border-[var(--fumero-border)] px-3 py-3 md:block"
      aria-label="Studio overzicht"
    >
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <SidebarKpiItem
          href="/fumero/bibliotheek"
          label="Bibliotheek"
          loading={loading}
          value={libraryCount === null ? "—" : String(libraryCount)}
        />
        <SidebarKpiItem
          href="/fumero/automations"
          label="Automatisering"
          loading={loading}
          value={activeAutomations === null ? "—" : String(activeAutomations)}
        />
        <SidebarKpiItem
          href="/fumero/orders"
          label="Bestellingen"
          loading={loading}
          value={openOrdersCount === null ? "—" : String(openOrdersCount)}
        />
        <SidebarKpiItem
          href="/fumero/chat"
          label="Dagoverzicht"
          loading={loading}
          value={briefingAgeLabel ?? "—"}
        />
      </div>
    </div>
  );
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
      className="fumero-kpi-strip shrink-0 border-b border-[#E5E5E5] bg-white px-4 py-2"
      aria-label="Studio overzicht"
    >
      <div className="mx-auto flex max-w-3xl divide-x divide-[#E5E5E5]">
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
