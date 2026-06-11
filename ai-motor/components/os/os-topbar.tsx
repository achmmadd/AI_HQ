"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export function OsTopbar({
  breadcrumbs,
  actionLabel,
  actionHref,
}: {
  breadcrumbs: Array<{ label: string; href?: string }>;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--os-border)] bg-[var(--os-bg-elevated)]/80 px-4 backdrop-blur-xl md:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.label} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-[var(--os-text-subtle)]">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="text-[var(--os-text-muted)] hover:text-[var(--os-text)]">
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-[var(--os-text)]">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="hidden rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--os-accent-foreground)] hover:bg-[var(--os-accent-hover)] sm:inline-flex"
          >
            {actionLabel}
          </Link>
        ) : null}
        <ThemeToggle compact className="ios-tap-highlight" />
      </div>
    </header>
  );
}
