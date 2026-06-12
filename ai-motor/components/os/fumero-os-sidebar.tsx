"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Camera,
  FolderKanban,
  Globe,
  Hammer,
  Home,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  ShoppingBag,
  Workflow,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { logoutClient } from "@/lib/auth-logout";
import { FumeroSidebarKpiFooter } from "@/components/fumero/ops/fumero-chat-kpi-strip";
import { Logo } from "@/components/logo";

type NavGroup = { label: string; items: { href: string; label: string; icon: LucideIcon; count?: number }[] };

function isActive(pathname: string, href: string): boolean {
  if (href === "/fumero") return pathname === "/fumero";
  if (href === "/fumero/chat") {
    return pathname === "/fumero/chat" || pathname.startsWith("/fumero/chat/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FumeroOsSidebar() {
  const pathname = usePathname();
  const collapsed = useLayoutStore((s) => s.fumeroSidebarCollapsed);
  const toggleCollapsed = useLayoutStore((s) => s.toggleFumeroSidebarCollapsed);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [autoCount, setAutoCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [contentRes, ordersRes, autoRes] = await Promise.all([
          fetch("/api/content?klant=fumero", { credentials: "include" }),
          fetch("/api/fumero/orders?limit=100", { credentials: "include" }),
          fetch("/api/automation/tasks", { credentials: "include" }),
        ]);
        const content = (await contentRes.json()) as { posts?: unknown[] };
        const orders = (await ordersRes.json()) as { orders?: unknown[] };
        const auto = (await autoRes.json()) as { tasks?: Array<{ enabled: number }> };
        if (cancelled) return;
        setLibraryCount(Array.isArray(content.posts) ? content.posts.length : 0);
        setOrderCount(Array.isArray(orders.orders) ? orders.orders.length : 0);
        setAutoCount((auto.tasks ?? []).filter((t) => t.enabled).length);
      } catch {
        if (!cancelled) {
          setLibraryCount(null);
          setOrderCount(null);
          setAutoCount(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: "Overzicht",
        items: [
          { href: "/fumero", label: "Command Center", icon: Home },
          { href: "/fumero/chat", label: "Chat", icon: MessageSquare },
          { href: "/fumero/photo-studio", label: "Studio", icon: Camera },
          { href: "/fumero/bouwen", label: "Bouwen", icon: Hammer },
        ],
      },
      {
        label: "Automatisering",
        items: [
          { href: "/fumero/automations", label: "Automatisering", icon: Workflow, count: autoCount ?? undefined },
          { href: "/fumero/projecten", label: "Projecten", icon: FolderKanban },
          { href: "/fumero/orders", label: "Bestellingen", icon: ShoppingBag, count: orderCount ?? undefined },
        ],
      },
      {
        label: "Bibliotheek",
        items: [
          { href: "/fumero/bibliotheek", label: "Bibliotheek", icon: BookOpen, count: libraryCount ?? undefined },
          { href: "/fumero/settings/context", label: "Instellingen", icon: Settings },
        ],
      },
    ],
    [autoCount, libraryCount, orderCount]
  );

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[var(--os-border)] bg-[var(--os-bg-elevated)] transition-[width] duration-200",
        collapsed ? "w-[var(--os-sidebar-collapsed)]" : "w-[var(--os-sidebar-w)]"
      )}
      aria-label="Fumero navigatie"
    >
      <div className="border-b border-[var(--os-border)] px-2 py-3 md:px-4 md:py-4">
        <div className={cn("hidden", !collapsed && "md:block")}>
          <Logo size="lg" className="max-h-9 w-auto" />
          <p className="mt-1.5 text-[11px] text-[var(--os-text-subtle)]">Studio</p>
        </div>
        <div
          className={cn(
            "mx-auto flex items-center justify-center",
            !collapsed && "md:hidden"
          )}
          aria-hidden
        >
          <Logo size="sm" motion="idle" />
        </div>
      </div>

      {!collapsed ? (
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
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
                      {!collapsed && typeof item.count === "number" ? (
                        <span className="rounded-md bg-[var(--os-hover-overlay-strong)] px-1.5 text-[10px] tabular-nums text-[var(--os-text-subtle)]">
                          {item.count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--os-border)] px-2 py-2 space-y-0.5">
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

      {!collapsed ? <FumeroSidebarKpiFooter /> : null}
    </aside>
  );
}
