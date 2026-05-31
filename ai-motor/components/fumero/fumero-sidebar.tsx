"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  FolderKanban,
  Hammer,
  MessageSquare,
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

function isActive(pathname: string, href: string): boolean {
  if (href === "/fumero/chat") {
    return (
      pathname === "/fumero" ||
      pathname === "/fumero/chat" ||
      pathname.startsWith("/fumero/chat/")
    );
  }
  if (href === "/fumero/projecten") {
    return pathname === "/fumero/projecten" || pathname.startsWith("/fumero/projecten/");
  }
  if (href === "/fumero/bouwen") {
    return pathname === "/fumero/bouwen" || pathname.startsWith("/fumero/bouwen/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FumeroSidebar() {
  const pathname = usePathname();
  const collapsed = useLayoutStore((s) => s.fumeroSidebarCollapsed);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/fumero/chat", label: "Chat", icon: MessageSquare },
      { href: "/fumero/photo-studio", label: "Studio", icon: Camera },
      { href: "/fumero/automations", label: "Automations", icon: Workflow },
      { href: "/fumero/bouwen", label: "Bouwen", icon: Hammer },
      {
        href: "/fumero/bibliotheek",
        label: "Bibliotheek",
        icon: BookOpen,
        count: libraryCount ?? undefined,
      },
      { href: "/fumero/projecten", label: "Projecten", icon: FolderKanban },
      {
        href: "/fumero/orders",
        label: "Orders",
        icon: ShoppingBag,
        count: orderCount ?? undefined,
      },
    ],
    [libraryCount, orderCount]
  );

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[var(--fumero-border)] bg-[var(--fumero-surface)] transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-14 md:w-[var(--fumero-sidebar-w,200px)]"
      )}
      aria-label="Fumero Studio navigatie"
    >
      <div className="border-b border-[var(--fumero-border)] px-2 py-3 md:px-4 md:py-4">
        <div className={cn("hidden", !collapsed && "md:block")}>
          <FumeroLogoLockup compact />
          <p className="fumero-text-caption mt-2 text-[var(--fumero-text-muted)]">
            Studio
          </p>
        </div>
        <div
          className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(105,196,0,0.12)] text-xs font-bold text-[#69C400] md:hidden"
          aria-hidden
        >
          F
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-1 py-3 md:px-2" aria-label="Hoofdmenu">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex h-8 items-center justify-center gap-2 rounded-lg border-l-2 border-transparent px-2 py-1.5 fumero-text-body-sm font-medium transition-colors md:justify-start",
                    active
                      ? "border-l-[var(--fumero-accent)] bg-transparent text-[var(--fumero-text)]"
                      : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-bg)] hover:text-[var(--fumero-text)]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
                  <span className={cn("hidden flex-1 truncate", !collapsed && "md:inline")}>
                    {item.label}
                  </span>
                  {typeof item.count === "number" ? (
                    <span
                      className={cn(
                        "fumero-text-micro hidden min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center font-semibold tabular-nums",
                        !collapsed && "md:inline-block",
                        active
                          ? "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]"
                          : "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]"
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
      </nav>

      {!collapsed ? <FumeroSidebarKpiFooter /> : null}
    </aside>
  );
}
