"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BookOpen,
  Calendar,
  CheckSquare,
  CircleCheck,
  Code2,
  Folder,
  Globe,
  Home,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Workflow,
  Image,
  ShoppingBag,
  Receipt,
  TrendingUp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/AgentAvatar";
import { FumeroLogoLockup } from "@/components/fumero-logo-lockup";
import {
  NAV_WIDTH_COLLAPSED,
  NAV_WIDTH_EXPANDED,
  useLayoutStore,
} from "@/stores/useLayoutStore";
import { useCompanyStore, getWorkspaceTheme } from "@/stores/useCompanyStore";
import { workspaceFromPathname } from "@/lib/workspace-themes";
import type { WorkspaceId } from "@/lib/types";
import { useAuthSession } from "@/hooks/useAuthSession";
import { logoutClient } from "@/lib/auth-logout";
import { WORKSPACE_LABELS } from "@/lib/brand";
import { Nav } from "@/design-system/components";

type NavGroup = { label: string; items: NavItem[] };
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

const WORKSPACES: { id: WorkspaceId; label: string; route: string }[] = [
  { id: "fumero", label: WORKSPACE_LABELS.fumero, route: "/fumero" },
  { id: "bokas", label: WORKSPACE_LABELS.bokas, route: "/bokas" },
  { id: "personal", label: WORKSPACE_LABELS.personal, route: "/" },
];

function navGroupsFor(workspace: WorkspaceId): NavGroup[] {
  if (workspace === "fumero") {
    return [
      {
        label: "Workspace",
        items: [
          { href: "/fumero", label: "Command Center", icon: Home },
          { href: "/fumero/chat", label: "Chat", icon: MessageSquare },
          { href: "/fumero/photo-studio", label: "Studio", icon: Image },
          { href: "/fumero/bouwen", label: "Bouwen", icon: Code2 },
        ],
      },
      {
        label: "Automate",
        items: [
          { href: "/fumero/automations", label: "Automations", icon: Workflow },
          { href: "/fumero/projecten", label: "Projecten", icon: Folder },
          { href: "/fumero/orders", label: "Orders", icon: ShoppingBag },
        ],
      },
      {
        label: "Library",
        items: [
          { href: "/fumero/bibliotheek", label: "Bibliotheek", icon: BookOpen },
          { href: "/fumero/settings/context", label: "Instellingen", icon: Settings },
        ],
      },
    ];
  }
  if (workspace === "bokas") {
    return [
      {
        label: "Workspace",
        items: [
          { href: "/bokas", label: "Command Center", icon: Home },
          { href: "/bokas/chat", label: "Chat", icon: MessageSquare },
          { href: "/bokas/bonnen", label: "Boekhouding", icon: Receipt },
          { href: "/bokas/voorraad", label: "Voorraad", icon: ShoppingBag },
        ],
      },
      {
        label: "Content",
        items: [
          { href: "/bokas/content", label: "Content", icon: Image },
          { href: "/bokas/marketing", label: "Marketing", icon: TrendingUp },
        ],
      },
    ];
  }
  return [
    {
      label: "Command",
      items: [
        { href: "/", label: "Command Center", icon: Home },
        { href: "/chat", label: "Chat", icon: Bot },
        { href: "/builder", label: "Bouwen", icon: Code2 },
        { href: "/agents", label: "Agents", icon: Bot },
      ],
    },
    {
      label: "Werk",
      items: [
        { href: "/cowork?tab=approvals", label: "Goedkeuringen", icon: CircleCheck },
        { href: "/agenda", label: "Agenda", icon: Calendar },
        { href: "/todo", label: "Taken", icon: CheckSquare },
        { href: "/apps", label: "Mijn werk", icon: Folder },
      ],
    },
    {
      label: "Systeem",
      items: [
        { href: "/kennisbank", label: "Kennisbank", icon: BookOpen },
        { href: "/kosten", label: "Kosten", icon: Receipt },
        { href: "/settings/context", label: "Instellingen", icon: Settings },
      ],
    },
  ];
}

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  if (path === "/fumero") return pathname === "/fumero";
  if (path === "/bokas") return pathname === "/bokas";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function PremiumSidebar() {
  const pathname = usePathname();
  if (
    pathname === "/fumero" ||
    pathname?.startsWith("/fumero/") ||
    pathname === "/bokas" ||
    pathname?.startsWith("/bokas/")
  ) {
    return null;
  }

  const router = useRouter();
  const workspace = useCompanyStore((s) => s.workspace);
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const collapsed = useLayoutStore((s) => s.navCollapsed);
  const toggleNavCollapsed = useLayoutStore((s) => s.toggleNavCollapsed);
  const { scope } = useAuthSession();
  const [wsOpen, setWsOpen] = useState(false);

  const allowedWorkspaces = useMemo<WorkspaceId[]>(() => {
    if (scope === "all") return ["fumero", "bokas", "personal"];
    return [scope];
  }, [scope]);

  const activeWorkspace: WorkspaceId = allowedWorkspaces.includes(workspace)
    ? workspace
    : allowedWorkspaces[0] ?? "personal";

  const groups = useMemo(() => navGroupsFor(activeWorkspace), [activeWorkspace]);
  const wsTheme = getWorkspaceTheme(activeWorkspace);
  const width = collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED;

  useEffect(() => {
    const inferred = workspaceFromPathname(pathname);
    if (inferred && allowedWorkspaces.includes(inferred) && inferred !== workspace) {
      setWorkspace(inferred);
    }
  }, [allowedWorkspaces, pathname, setWorkspace, workspace]);

  const mobileItems = groups.flatMap((g) => g.items);

  return (
    <>
      <aside
        style={{ width }}
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[var(--os-border)] bg-[var(--os-bg-elevated)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-2xl transition-[width] duration-200 md:flex"
      >
        {/* Brand */}
        <div className={cn("px-4 pb-4 pt-5", collapsed && "flex justify-center px-2")}>
          {collapsed ? (
            activeWorkspace === "fumero" ? (
              <AgentAvatar workspace="fumero" size="sm" />
            ) : (
              <span className="text-[15px] font-bold tracking-tight text-[var(--os-accent)]">M</span>
            )
          ) : activeWorkspace === "fumero" ? (
            <FumeroLogoLockup compact className="w-full min-w-[128px]" />
          ) : activeWorkspace === "bokas" ? (
            <span className="font-bold tracking-[0.2em] text-[var(--os-accent)]">BOKAS</span>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--os-text-subtle)]">
                MotorsAI
              </p>
              <p
                className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--os-accent)]"
                style={{ fontFamily: "var(--ws-font)" }}
              >
                {wsTheme.name}
              </p>
            </>
          )}
        </div>

        {/* Search */}
        {!collapsed ? (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex w-full items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border)] bg-[var(--os-hover-overlay)] px-3 py-2 text-[13px] text-[var(--os-text-subtle)] transition-colors hover:bg-[var(--os-hover-overlay-strong)] hover:text-[var(--os-text-muted)]"
            >
              <Search className="h-3.5 w-3.5" />
              Zoeken…
              <kbd className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
          </div>
        ) : null}

        {/* Workspace switcher */}
        {!collapsed && allowedWorkspaces.length > 1 ? (
          <div className="relative px-3 pb-3">
            <button
              type="button"
              onClick={() => setWsOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-[var(--os-radius-md)] border border-[var(--os-border)] bg-[var(--os-hover-overlay)] px-3 py-2 text-left text-[13px] font-medium text-[var(--os-text)] hover:bg-[var(--os-hover-overlay-strong)]"
            >
              <span>{WORKSPACES.find((w) => w.id === activeWorkspace)?.label}</span>
              <ChevronDown className={cn("h-4 w-4 text-[var(--os-text-muted)] transition-transform", wsOpen && "rotate-180")} />
            </button>
            {wsOpen ? (
              <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-[var(--os-radius-md)] border border-[var(--os-border-strong)] bg-[var(--os-bg-subtle)] py-1 shadow-[var(--os-shadow-lg)]">
                {WORKSPACES.filter((w) => allowedWorkspaces.includes(w.id)).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setWorkspace(w.id);
                      setWsOpen(false);
                      router.push(w.route);
                    }}
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--os-hover-overlay-strong)]",
                      activeWorkspace === w.id ? "text-[var(--os-accent)]" : "text-[var(--os-text-muted)]"
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed ? (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--os-text-subtle)]">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = isActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={collapsed ? label : undefined}
                        className={cn(
                          "group flex min-h-[36px] items-center gap-2.5 rounded-[var(--os-radius-md)] px-2.5 py-2 text-[13px] font-medium transition-all",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-[var(--os-accent-muted)] text-[var(--os-accent)]"
                            : "text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)] hover:text-[var(--os-text)]"
                        )}
                      >
                        <Icon className="h-[17px] w-[17px] shrink-0 opacity-80" strokeWidth={1.5} />
                        {!collapsed ? <span className="truncate">{label}</span> : null}
                        {!collapsed && badge ? (
                          <span className="ml-auto rounded-full bg-[var(--os-hover-overlay-strong)] px-1.5 text-[10px] tabular-nums">
                            {badge}
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

        {/* Footer */}
        <div className="space-y-0.5 border-t border-[var(--os-border)] px-2 py-3">
          <button
            type="button"
            onClick={toggleNavCollapsed}
            className={cn(
              "flex min-h-[36px] w-full items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
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
              "flex min-h-[36px] items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
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
              "flex min-h-[36px] w-full items-center rounded-[var(--os-radius-md)] px-2.5 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay)]",
              collapsed ? "justify-center" : "gap-2.5"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed ? "Uitloggen" : null}
          </button>
        </div>
      </aside>

      <Nav items={mobileItems} pathname={pathname} variant="bottom" className="md:hidden" match="prefix" />
    </>
  );
}
