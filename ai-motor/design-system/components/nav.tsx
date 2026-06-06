"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
};

export type NavProps = {
  items: NavItem[];
  /** Current pathname for active-state matching */
  pathname?: string;
  /** "sidebar" desktop rail | "bottom" mobile tab bar (Sprint 4.2 target) */
  variant?: "sidebar" | "bottom";
  className?: string;
  /** Exact match vs prefix match for href */
  match?: "exact" | "prefix";
  onNavigate?: () => void;
};

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix"
): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  const base = href.split("?")[0] ?? href;
  if (match === "exact") return path === base;
  return path === base || path.startsWith(`${base}/`);
}

export function Nav({
  items,
  pathname = "",
  variant = "sidebar",
  className,
  match = "prefix",
  onNavigate,
}: NavProps) {
  if (variant === "bottom") {
    return (
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md",
          "pb-[env(safe-area-inset-bottom)]",
          className
        )}
        aria-label="Hoofdnavigatie"
      >
        <ul className="flex items-stretch justify-around px-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href, match);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1 max-w-[5.5rem]">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2",
                    "min-h-[var(--ds-touch-min)] text-xs text-text-secondary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg",
                    active && "text-accent font-medium"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {Icon ? <Icon className="h-5 w-5 shrink-0" aria-hidden /> : null}
                  <span className="truncate w-full text-center text-[11px] leading-tight">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Zijmenu">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href, match);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  "min-h-[var(--ds-touch-min)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "bg-surface-elevated text-text-primary"
                    : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                )}
                aria-current={active ? "page" : undefined}
              >
                {Icon ? <Icon className="h-5 w-5 shrink-0" aria-hidden /> : null}
                <span className="truncate">{item.label}</span>
                {item.badge != null ? (
                  <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
