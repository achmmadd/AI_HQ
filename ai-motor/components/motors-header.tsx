"use client";

import { useEffect, useMemo } from "react";
import { Moon, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FumeroLogoLockup } from "@/components/fumero-logo-lockup";
import { useCompanyStore, getWorkspaceTheme } from "@/stores/useCompanyStore";
import type { WorkspaceId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";

const workspaces: { id: WorkspaceId; label: string }[] = [
  { id: "fumero", label: "Fumero Studio" },
  { id: "bokas", label: "Bokas" },
  { id: "personal", label: "Motor AI" },
];

const PRIMARY_ROUTE_BY_WORKSPACE: Record<WorkspaceId, string> = {
  fumero: "/fumero/chat",
  bokas: "/bokas",
  personal: "/chat",
};

function HeaderLogo({ workspace }: { workspace: WorkspaceId }) {
  if (workspace === "fumero") {
    return (
      <FumeroLogoLockup compact className="px-2 py-1.5" />
    );
  }
  if (workspace === "bokas") {
    return (
      <span className="font-bold tracking-[0.2em] text-ws-accent">BOKAS</span>
    );
  }
  return (
    <span
      className="font-semibold tracking-tight text-ws-accent"
      style={{ fontFamily: "var(--font-geist), Geist, sans-serif" }}
    >
      MOTOR AI
    </span>
  );
}

export function MotorsHeader({ title }: { title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const workspace = useCompanyStore((s) => s.workspace);
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const theme = useCompanyStore((s) => s.theme);
  const toggleTheme = useCompanyStore((s) => s.toggleTheme);
  const wsTheme = getWorkspaceTheme(workspace);
  const { scope } = useAuthSession();
  const visibleWorkspaces = useMemo(() => {
    if (scope === "all") return workspaces;
    return workspaces.filter((w) => w.id === scope);
  }, [scope]);

  useEffect(() => {
    const allowedIds = new Set(visibleWorkspaces.map((w) => w.id));
    if (!allowedIds.has(workspace) && visibleWorkspaces[0]) {
      const fallback = visibleWorkspaces[0].id;
      setWorkspace(fallback);
      const target = PRIMARY_ROUTE_BY_WORKSPACE[fallback];
      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [pathname, router, setWorkspace, visibleWorkspaces, workspace]);

  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-[52px] items-center justify-between border-b border-border/60 bg-background/78 px-4 font-ws backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 md:px-8 pt-[max(0px,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-3">
        <HeaderLogo workspace={workspace} />
        <span className="hidden text-border md:inline">·</span>
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-text-primary">
          {title || wsTheme.name}
        </h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div
          className="flex rounded-[13px] border border-border/50 bg-surface/90 p-[3px] shadow-inner backdrop-blur-sm"
          role="group"
          aria-label="Workspace"
        >
          {visibleWorkspaces.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setWorkspace(id);
                const target = PRIMARY_ROUTE_BY_WORKSPACE[id];
                if (pathname !== target) {
                  router.push(target);
                }
              }}
              className={cn(
                "ios-tap-highlight min-h-[36px] rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold transition-[background,color] duration-150 md:min-w-[76px] md:px-3.5 md:text-[13px]",
                workspace === id
                  ? "bg-ws-accent-lt text-ws-accent"
                  : "text-text-secondary active:opacity-80"
              )}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">
                {id === "fumero" ? "Fumero" : id === "bokas" ? "Bokas" : "Lab"}
              </span>
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="icon"
          type="button"
          className="ios-tap-highlight h-11 w-11 rounded-2xl border-border/60 shadow-none active:opacity-90"
          onClick={() => toggleTheme()}
          aria-label="Thema"
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Moon className="h-[18px] w-[18px]" aria-hidden />
          )}
        </Button>
      </div>
    </header>
  );
}
