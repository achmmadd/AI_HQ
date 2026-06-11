"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Globe,
  Home,
  Image,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { logoutClient } from "@/lib/auth-logout";

type NavGroup = { label: string; items: { href: string; label: string; icon: LucideIcon }[] };

function isActive(pathname: string, href: string): boolean {
  if (href === "/bokas") return pathname === "/bokas";
  if (href === "/bokas/chat") {
    return pathname === "/bokas/chat" || pathname.startsWith("/bokas/chat/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BokasOsSidebar() {
  const pathname = usePathname();
  const collapsed = useLayoutStore((s) => s.fumeroSidebarCollapsed);
  const toggleCollapsed = useLayoutStore((s) => s.toggleFumeroSidebarCollapsed);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: "Command",
        items: [
          { href: "/bokas", label: "Command Center", icon: Home },
          { href: "/bokas/chat", label: "Chat", icon: MessageSquare },
          { href: "/bokas/operations", label: "Operaties", icon: UtensilsCrossed },
        ],
      },
      {
        label: "Werk",
        items: [
          { href: "/bokas/bonnen", label: "Boekhouding", icon: Receipt },
          { href: "/bokas/voorraad", label: "Voorraad", icon: ShoppingBag },
          { href: "/bokas/content", label: "Content", icon: Image },
          { href: "/bokas/photo-studio", label: "Studio", icon: Camera },
          { href: "/bokas/marketing", label: "Marketing", icon: TrendingUp },
        ],
      },
      {
        label: "Instellingen",
        items: [
          { href: "/bokas/settings/context", label: "Context", icon: Settings },
        ],
      },
    ],
    []
  );

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[var(--os-border)] bg-[var(--os-bg-elevated)] transition-[width] duration-200",
        collapsed ? "w-[var(--os-sidebar-collapsed)]" : "w-[var(--os-sidebar-w)]"
      )}
      aria-label="Bokas navigatie"
    >
      <div className="border-b border-[var(--os-border)] px-2 py-3 md:px-4 md:py-4">
        <div className={cn("hidden", !collapsed && "md:block")}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--os-radius-md)] bg-[var(--os-accent-muted)] text-sm font-bold text-[var(--os-accent)]">
              B
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-[var(--os-text)]">Bokas</p>
              <p className="text-[11px] text-[var(--os-text-subtle)]">Restaurant · operations</p>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--os-accent-muted)] text-xs font-bold text-[var(--os-accent)]",
            !collapsed && "md:hidden"
          )}
          aria-hidden
        >
          B
        </div>
      </div>

      {!collapsed ? (
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
            }
            className="flex w-full items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border)] bg-[var(--os-hover-overlay)] px-3 py-2 text-[12px] text-[var(--os-text-subtle)] hover:bg-[var(--os-hover-overlay-strong)]"
          >
            <Search className="h-3.5 w-3.5" />
            Zoeken…
            <kbd className="ml-auto text-[10px] opacity-60">⌘K</kbd>
          </button>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed ? (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--os-text-subtle)]">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-[var(--os-radius-md)] px-2.5 text-[13px] font-medium transition-all",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-[var(--os-accent-muted)] text-[var(--os-accent)]"
                          : "text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)] hover:text-[var(--os-text)]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-[var(--os-border)] px-2 py-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex h-9 w-full items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? "Inklappen" : null}
        </button>
        <Link
          href="/website"
          target="_blank"
          className={cn(
            "flex h-9 items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <Globe className="h-4 w-4" />
          {!collapsed ? "Website" : null}
        </Link>
        <button
          type="button"
          onClick={() => void logoutClient()}
          className={cn(
            "flex h-9 w-full items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Uitloggen" : null}
        </button>
      </div>
    </aside>
  );
}
