"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Grid3X3,
  CalendarDays,
  Store,
  BookOpen,
  ShieldCheck,
  UtensilsCrossed,
  MessageSquareReply,
  Sprout,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/afdelingen", label: "Afdelingen", icon: Grid3X3 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/appstore", label: "App Store", icon: Store },
  { href: "/kennisbank", label: "Kennisbank", icon: BookOpen },
  { href: "/fumero", label: "Fumero", icon: Sprout },
  { href: "/bokas", label: "Bokas", icon: UtensilsCrossed },
  {
    href: "/bokas/reviews",
    label: "Reviews · Bokas",
    icon: MessageSquareReply,
  },
  { href: "/kosten", label: "Kosten", icon: Wallet },
  { href: "/approvals", label: "Goedkeuringen", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-surface pt-6">
      <div className="px-5 pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          AI Motor
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight">Factory OS</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-secondary hover:bg-surface-elevated/60 hover:text-text-primary"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-xs text-text-secondary">
        Poort 3040 · Next 16
      </p>
    </aside>
  );
}
