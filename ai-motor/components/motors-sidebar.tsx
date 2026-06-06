"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BookOpen,
  Calendar,
  CheckSquare,
  CircleCheck,
  Code2,
  Folder,
  Image,
  LogOut,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Nav, type NavItem } from "@/design-system/components";
import { cn } from "@/lib/utils";
import {
  NAV_WIDTH_COLLAPSED,
  NAV_WIDTH_EXPANDED,
  useLayoutStore,
} from "@/stores/useLayoutStore";
import { AgentAvatar } from "@/components/AgentAvatar";
import { FumeroLogoLockup } from "@/components/fumero-logo-lockup";
import { useCompanyStore, getWorkspaceTheme } from "@/stores/useCompanyStore";
import { workspaceFromPathname } from "@/lib/workspace-themes";
import type { WorkspaceId } from "@/lib/types";
import { useAuthSession } from "@/hooks/useAuthSession";

type SidebarNavItem = { href: string; label: string; icon: LucideIcon };

const NAV_BY_WORKSPACE: Record<WorkspaceId, SidebarNavItem[]> = {
  fumero: [
    { href: "/fumero/chat", label: "Chat", icon: MessageSquare },
    { href: "/fumero/photo-studio", label: "Studio", icon: Image },
    { href: "/fumero/automations", label: "Automations", icon: Workflow },
    { href: "/fumero/bouwen", label: "Bouwen", icon: Code2 },
    { href: "/fumero/bibliotheek", label: "Bibliotheek", icon: BookOpen },
    { href: "/fumero/projecten", label: "Projecten", icon: Folder },
    { href: "/fumero/orders", label: "Orders", icon: ShoppingBag },
  ],
  personal: [
    { href: "/chat", label: "Chat", icon: Bot },
    { href: "/cowork?tab=approvals", label: "Goedkeuringen", icon: CircleCheck },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/todo", label: "Taken", icon: CheckSquare },
    { href: "/code", label: "Code", icon: Code2 },
    { href: "/apps", label: "Mijn werk", icon: Folder },
    { href: "/settings/context", label: "Instellingen", icon: Settings },
  ],
  bokas: [
    { href: "/bokas/chat", label: "Chat", icon: MessageSquare },
    { href: "/bokas/bonnen", label: "Boekhouding", icon: Receipt },
    { href: "/bokas/voorraad", label: "Voorraad", icon: ShoppingBag },
    { href: "/bokas/content", label: "Content", icon: Image },
    { href: "/bokas/marketing", label: "Marketing", icon: TrendingUp },
  ],
};

function isNavActive(pathname: string, href: string): boolean {
  const pathOnly = href.split("?")[0] ?? href;
  return (
    pathname === pathOnly ||
    (href === "/cowork?tab=approvals" && pathname === "/cowork") ||
    (href !== "/" && pathOnly !== "/chat" && pathname.startsWith(pathOnly)) ||
    (href === "/chat" && pathname.startsWith("/chat")) ||
    (href === "/fumero/chat" && pathname.startsWith("/fumero/chat")) ||
    (href === "/fumero/chat" && pathname === "/fumero") ||
    (href === "/bokas/chat" && pathname.startsWith("/bokas/chat")) ||
    (href === "/bokas/chat" && pathname === "/bokas")
  );
}

export function MotorsSidebar() {
  const pathname = usePathname();

  /** Studio workspaces: eigen shell, niet de Motor-sidebar. */
  if (
    pathname === "/fumero" ||
    pathname.startsWith("/fumero/") ||
    pathname === "/bokas" ||
    pathname.startsWith("/bokas/")
  ) {
    return null;
  }

  const workspace = useCompanyStore((s) => s.workspace);
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const collapsed = useLayoutStore((s) => s.navCollapsed);
  const toggleNavCollapsed = useLayoutStore((s) => s.toggleNavCollapsed);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const { scope } = useAuthSession();

  const allowedWorkspaces = useMemo<WorkspaceId[]>(() => {
    if (scope === "all") return ["fumero", "bokas", "personal"];
    return [scope];
  }, [scope]);

  const activeWorkspace: WorkspaceId = allowedWorkspaces.includes(workspace)
    ? workspace
    : allowedWorkspaces[0] ?? "personal";

  const nav = useMemo(() => NAV_BY_WORKSPACE[activeWorkspace], [activeWorkspace]);

  const mobileNavItems = useMemo<NavItem[]>(
    () =>
      nav.map(({ href, label, icon }) => {
        const showBadge =
          inboxCount != null &&
          inboxCount > 0 &&
          (href === "/bokas/bonnen" || href === "/cowork?tab=approvals");
        return {
          href,
          label,
          icon,
          badge: showBadge ? inboxCount : undefined,
        };
      }),
    [inboxCount, nav]
  );

  useEffect(() => {
    const inferred = workspaceFromPathname(pathname);
    if (
      inferred &&
      allowedWorkspaces.includes(inferred) &&
      inferred !== workspace
    ) {
      setWorkspace(inferred);
    }
  }, [allowedWorkspaces, pathname, setWorkspace, workspace]);

  useEffect(() => {
    void fetch("/api/cowork/approvals", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { counts?: { total?: number } }) =>
        setInboxCount(j.counts?.total ?? 0)
      )
      .catch(() => setInboxCount(null));
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        toggleNavCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleNavCollapsed]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("motorsai_token");
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!allowedWorkspaces.includes(workspace)) {
      setWorkspace(activeWorkspace);
    }
  }, [activeWorkspace, allowedWorkspaces, setWorkspace, workspace]);

  const width = collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED;

  return (
    <>
      <aside
        style={{ width }}
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border/60 bg-surface/92 pt-[env(safe-area-inset-top)] font-ws backdrop-blur-2xl transition-[width] duration-200 ease-out supports-[backdrop-filter]:bg-surface/75 md:flex"
      >
        {collapsed ? (
          <div className="flex items-center justify-center px-2 pb-3 pt-5">
            {activeWorkspace === "fumero" ? (
              <AgentAvatar workspace="fumero" size="sm" />
            ) : (
              <span className="text-[15px] font-bold tracking-tight text-ws-accent">
                M
              </span>
            )}
          </div>
        ) : (
          <div className="px-5 pb-5 pt-6">
            {activeWorkspace === "fumero" ? (
              <FumeroLogoLockup compact className="w-full min-w-[128px]" />
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  MotorsAI
                </p>
                <p
                  className="mt-1 text-[20px] font-semibold tracking-tight text-ws-accent"
                  style={{ fontFamily: "var(--ws-font)" }}
                >
                  {getWorkspaceTheme(activeWorkspace).name}
                </p>
              </>
            )}
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            const showBadge =
              inboxCount != null &&
              inboxCount > 0 &&
              (href === "/bokas/bonnen" || href === "/cowork?tab=approvals");
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                scroll
                title={collapsed ? label : undefined}
                className={cn(
                  "ios-tap-highlight relative flex min-h-[44px] items-center rounded-2xl text-[15px] font-medium transition-[background,color,opacity] duration-150",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-ws-accent-lt text-ws-accent"
                    : "text-text-secondary active:bg-white/10"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-85" aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
                {showBadge && (
                  <span
                    className={cn(
                      "rounded-full bg-ws-yellow px-1.5 py-0.5 text-[10px] font-bold text-[#080808]",
                      collapsed ? "absolute -right-0.5 -top-0.5" : "ml-auto"
                    )}
                  >
                    {inboxCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            title={collapsed ? "Menu uitklappen" : "Menu inklappen"}
            aria-label={collapsed ? "Menu uitklappen" : "Menu inklappen"}
            onClick={toggleNavCollapsed}
            className={cn(
              "ios-tap-highlight flex min-h-[44px] w-full items-center rounded-2xl text-[15px] font-medium text-text-secondary active:bg-white/10 hover:bg-surface-elevated hover:text-text-primary",
              collapsed ? "justify-center" : "gap-3 px-3"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0 opacity-80" />
                <span className="truncate">Inklappen</span>
              </>
            )}
          </button>
          <button
            type="button"
            title="Uitloggen"
            onClick={() => void logout()}
            className={cn(
              "ios-tap-highlight flex min-h-[44px] w-full items-center rounded-2xl text-left text-[15px] font-medium text-text-secondary active:bg-white/10 hover:bg-surface-elevated",
              collapsed ? "justify-center" : "gap-3 px-3"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden />
            {!collapsed && "Uitloggen"}
          </button>
        </div>
      </aside>

      <Nav
        items={mobileNavItems}
        pathname={pathname}
        variant="bottom"
        className="md:hidden"
        match="prefix"
      />
    </>
  );
}
