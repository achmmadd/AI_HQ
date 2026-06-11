"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SettingsLink = { href: string; label: string };

function settingsPrefix(pathname: string): string {
  if (pathname.startsWith("/fumero/")) return "/fumero/settings";
  if (pathname.startsWith("/bokas/")) return "/bokas/settings";
  return "/settings";
}

function settingsLinks(prefix: string): SettingsLink[] {
  const links: SettingsLink[] = [
    { href: `${prefix}/context`, label: "Teamcontext" },
    { href: `${prefix}/team`, label: "Team & rollen" },
  ];
  if (prefix === "/fumero/settings") {
    links.push({ href: `${prefix}/billing`, label: "Gebruik & budget" });
    links.push({ href: "/fumero/pay", label: "Betalingen" });
  }
  return links;
}

export function SettingsNav() {
  const pathname = usePathname() ?? "";
  const prefix = settingsPrefix(pathname);
  const links = settingsLinks(prefix);

  return (
    <nav
      className="fumero-settings-nav flex flex-wrap gap-2 border-b border-[var(--fumero-border,var(--border))] pb-4"
      aria-label="Instellingen"
    >
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "min-h-[var(--ds-touch-min,44px)] rounded-[var(--fumero-radius-lg,var(--ds-radius-lg))] px-4 py-2.5 fumero-text-body-sm font-medium transition-colors",
              active
                ? "bg-[var(--fumero-accent-muted)] text-[var(--fumero-accent)]"
                : "bg-[var(--fumero-surface-muted,var(--muted))] text-[var(--fumero-text-muted,var(--text-secondary))] hover:text-[var(--fumero-text,var(--text-primary))]"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
