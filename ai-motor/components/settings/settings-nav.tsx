"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SETTINGS_LINKS = [
  { href: "/settings/context", label: "Teamcontext" },
  { href: "/settings/team", label: "Team & rollen" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border pb-4"
      aria-label="Instellingen"
    >
      {SETTINGS_LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "min-h-[var(--ds-touch-min,44px)] rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent/15 text-accent"
                : "bg-surface text-text-secondary hover:text-text-primary"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
