"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Hammer,
  MessageSquare,
  Camera,
  LayoutGrid,
  Megaphone,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/fumero/chat", label: "Chat", icon: MessageSquare, match: "/fumero/chat" },
  { href: "/fumero/campaign-studio", label: "Campagnes", icon: Megaphone, match: "/fumero/campaign-studio" },
  { href: "/fumero/photo-studio", label: "Studio", icon: Camera, match: "/fumero/photo-studio" },
  { href: "/fumero", label: "Overzicht", icon: LayoutGrid, match: "/fumero" },
  { href: "/fumero/bouwen", label: "Bouwen", icon: Hammer, match: "/fumero/bouwen" },
  { href: "/fumero/settings/context", label: "Meer", icon: Settings, match: "/fumero/settings" },
] as const;

function isActive(pathname: string, match: string): boolean {
  if (match === "/fumero") {
    return pathname === "/fumero";
  }
  if (match === "/fumero/settings") {
    return (
      pathname.startsWith("/fumero/settings") ||
      pathname === "/fumero/pay" ||
      pathname.startsWith("/fumero/automations")
    );
  }
  if (match === "/fumero/campaign-studio") {
    return (
      pathname === "/fumero/campaign-studio" ||
      pathname.startsWith("/fumero/campaign-studio/") ||
      pathname === "/fumero/brand-kit" ||
      pathname.startsWith("/fumero/brand-kit/")
    );
  }
  return pathname === match || pathname.startsWith(`${match}/`);
}

export function FumeroMobileNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--fumero-border)] bg-[var(--fumero-glass-bg)] backdrop-blur-[var(--fumero-blur)] md:hidden"
      aria-label="Mobiele navigatie"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "fumero-mobile-nav-link flex min-h-[52px] min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-[var(--fumero-accent)]"
                  : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
