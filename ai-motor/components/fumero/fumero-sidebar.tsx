"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Camera,
  Grid3X3,
  MessageSquare,
  ShoppingBag,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FumeroLogoLockup } from "@/components/fumero-logo-lockup";

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
  if (href === "/fumero/apps") {
    return pathname === "/fumero/apps" || pathname === "/fumero/tools";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FumeroSidebar() {
  const pathname = usePathname();
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
      { href: "/fumero/photo-studio", label: "Photo Studio", icon: Camera },
      { href: "/fumero/automations", label: "Automations", icon: Workflow },
      {
        href: "/fumero/bibliotheek",
        label: "Bibliotheek",
        icon: BookOpen,
        count: libraryCount ?? undefined,
      },
      { href: "/fumero/apps", label: "Apps", icon: Grid3X3 },
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
      className="flex h-full w-14 shrink-0 flex-col border-r border-[#E5E5E5] bg-white md:w-[var(--fumero-sidebar-w,240px)]"
      aria-label="Fumero Studio navigatie"
    >
      <div className="border-b border-[#E5E5E5] px-2 py-3 md:px-4 md:py-4">
        <div className="hidden md:block">
          <FumeroLogoLockup compact />
          <p className="mt-2 text-xs text-[#737373]">Product & operations</p>
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
                    "flex items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors md:justify-start",
                    active
                      ? "bg-[rgba(105,196,0,0.08)] text-[#69C400]"
                      : "text-[#525252] hover:bg-[#FAFAFA] hover:text-[#171717]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                  <span className="hidden flex-1 truncate md:inline">{item.label}</span>
                  {typeof item.count === "number" ? (
                    <span
                      className={cn(
                        "hidden min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums md:inline-block",
                        active
                          ? "bg-white/80 text-[#69C400]"
                          : "bg-[#F5F5F5] text-[#737373]"
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

      <div className="hidden border-t border-[#E5E5E5] p-2 md:block">
        <Link
          href="/chat"
          title="Motor Chat (lab)"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-[#737373] transition-colors hover:bg-[#FAFAFA] hover:text-[#171717]"
        >
          <Bot className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
          <span className="truncate">Motor Chat (lab)</span>
        </Link>
      </div>
    </aside>
  );
}
