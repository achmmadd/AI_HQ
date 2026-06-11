"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  Code2,
  FolderKanban,
  Hammer,
  Home,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { FumeroLogoLockup } from "@/components/fumero-logo-lockup";
import { FumeroSidebarKpiFooter } from "@/components/fumero/ops/fumero-chat-kpi-strip";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  count?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/fumero") {
    return pathname === "/fumero";
  }
  if (href === "/fumero/chat") {
    return pathname === "/fumero/chat" || pathname.startsWith("/fumero/chat/");
  }
  if (href === "/fumero/projecten") {
    return pathname === "/fumero/projecten" || pathname.startsWith("/fumero/projecten/");
  }
  if (href === "/fumero/bouwen") {
    return pathname === "/fumero/bouwen" || pathname.startsWith("/fumero/bouwen/");
  }
  if (href === "/fumero/code") {
    return pathname === "/fumero/code" || pathname.startsWith("/fumero/code/");
  }
  if (href === "/fumero/settings/context") {
    return pathname.startsWith("/fumero/settings");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FumeroSidebar() {
  const pathname = usePathname();
  const collapsed = useLayoutStore((s) => s.fumeroSidebarCollapsed);
  const toggleCollapsed = useLayoutStore((s) => s.toggleFumeroSidebarCollapsed);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const [contentRes, ordersRes] = await Promise.all([
          fetch("/api/content?klant=fumero", { credentials: "include" }),
          fetch("/api/fumero/orders?limit=100", { credentials: "include" }),
        ]);
        const content = (await contentRes.json()) as { posts?: unknown[] };
        const orders = (await ordersRes.json()) as { orders?: unknown[] };
        if (cancelled) return;
        setLibraryCount(Array.isArray(content.posts) ? content.posts.length : 0);
        setOrderCount(Array.isArray(orders.orders) ? orders.orders.length : 0);
      } catch {
        if (!cancelled) {
          setLibraryCount(null);
          setOrderCount(null);
        }
      }
    };

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 2500 })
        : (cb: () => void) => window.setTimeout(cb, 400);

    const idleId = schedule(() => {
      if (!cancelled) void loadCounts();
    });

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId as number);
      } else {
        window.clearTimeout(idleId as number);
      }
    };
  }, []);

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: "Overzicht",
        items: [
          { href: "/fumero", label: "Command Center", icon: Home },
          { href: "/fumero/chat", label: "Chat", icon: MessageSquare },
        ],
      },
      {
        label: "Studio",
        items: [
          { href: "/fumero/photo-studio", label: "Studio", icon: Camera },
          { href: "/fumero/bouwen", label: "Bouwen", icon: Hammer },
          { href: "/fumero/code", label: "Code", icon: Code2 },
          { href: "/fumero/automations", label: "Automatisering", icon: Workflow },
        ],
      },
      {
        label: "Beheer",
        items: [
          {
            href: "/fumero/bibliotheek",
            label: "Bibliotheek",
            icon: BookOpen,
            count: libraryCount ?? undefined,
          },
          { href: "/fumero/projecten", label: "Projecten", icon: FolderKanban },
          {
            href: "/fumero/orders",
            label: "Bestellingen",
            icon: ShoppingBag,
            count: orderCount ?? undefined,
          },
          { href: "/fumero/settings/context", label: "Instellingen", icon: Settings },
        ],
      },
    ],
    [libraryCount, orderCount]
  );

  return (
    <aside
      className={cn(
        "fumero-shell-sidebar flex h-full shrink-0 flex-col transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-14 md:w-[var(--fumero-sidebar-w,220px)]"
      )}
      aria-label="Fumero Studio navigatie"
    >
      <div className="border-b border-[var(--fumero-border)] px-2 py-3 md:px-4 md:py-4">
        <Link
          href="/fumero"
          aria-label="Naar Fumero Command Center"
          title="Naar Fumero Command Center"
          className={cn(
            "block rounded-[var(--fumero-radius)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fumero-accent)]",
            collapsed && "md:flex md:justify-center"
          )}
        >
          <div className={cn("hidden", !collapsed && "md:block")}>
            <FumeroLogoLockup compact />
          </div>
          <div
            className={cn(
              "mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--fumero-radius)] bg-[var(--fumero-accent-muted)] md:hidden",
              collapsed && "md:flex"
            )}
          >
            <FumeroLogoLockup compact variant="mascot" className="!p-0" />
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-1 py-3 md:px-2" aria-label="Hoofdmenu">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3 last:mb-0">
            <p
              className={cn(
                "fumero-nav-group-label hidden",
                !collapsed && "md:block"
              )}
            >
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      data-active={active ? "true" : "false"}
                      className={cn(
                        "fumero-nav-pill flex h-9 items-center justify-center gap-2 rounded-[var(--fumero-radius)] px-2.5 py-1.5 fumero-text-body-sm font-medium md:justify-start",
                        active
                          ? "text-[var(--fumero-text)]"
                          : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)] hover:text-[var(--fumero-text)]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-85" strokeWidth={1.5} />
                      <span className={cn("hidden flex-1 truncate", !collapsed && "md:inline")}>
                        {item.label}
                      </span>
                      {typeof item.count === "number" ? (
                        <span
                          className={cn(
                            "fumero-text-micro hidden min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center font-semibold tabular-nums",
                            !collapsed && "md:inline-block",
                            "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]"
                          )}
                        >
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

      <div className="border-t border-[var(--fumero-border)] px-1 py-2 md:px-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "fumero-nav-pill flex h-9 w-full items-center rounded-[var(--fumero-radius)] px-2.5 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)] hover:text-[var(--fumero-text)]",
            collapsed ? "justify-center" : "gap-2"
          )}
          aria-label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
          title={collapsed ? "Uitklappen" : "Inklappen"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="hidden text-[13px] font-medium md:inline">Inklappen</span>
            </>
          )}
        </button>
      </div>

      {!collapsed ? <FumeroSidebarKpiFooter /> : null}
    </aside>
  );
}
