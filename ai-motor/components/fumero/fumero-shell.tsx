"use client";

import { useEffect } from "react";
import { FumeroSidebar } from "@/components/fumero/fumero-sidebar";
import { FumeroTopbar } from "@/components/fumero/fumero-topbar";
import { FumeroCommandPaletteLazy } from "@/components/fumero/fumero-command-palette-lazy";
import { FumeroMobileNav } from "@/components/fumero/fumero-mobile-nav";
import { cn } from "@/lib/utils";

export function FumeroShell({
  page,
  actionLabel,
  actionHref,
  flush = false,
  hideTopbar = false,
  immersive = false,
  showBriefing = false,
  breadcrumbs,
  children,
}: {
  page: string;
  actionLabel?: string;
  actionHref?: string;
  flush?: boolean;
  hideTopbar?: boolean;
  immersive?: boolean;
  showBriefing?: boolean;
  /** Override default breadcrumbs (avoids duplicate page title on flush canvases). */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${page} · Fumero Studio`;
  }, [page]);

  return (
    <div
      className={cn(
        "flex h-screen overflow-hidden",
        immersive ? "bg-[var(--os-bg)]" : "bg-[var(--fumero-bg)]"
      )}
      data-os-chat={immersive ? "" : undefined}
    >
      <FumeroSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {!hideTopbar ? (
          <FumeroTopbar
            breadcrumbs={
              breadcrumbs ?? [{ label: "Fumero Studio", href: "/fumero" }]
            }
            actionLabel={actionLabel}
            actionHref={actionHref}
            showBriefing={showBriefing}
          />
        ) : null}
        <main
          className={cn(
            flush || immersive
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex-1 overflow-y-auto",
            "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
          )}
        >
          {flush || immersive ? children : (
            <div className="fumero-page-content mx-auto w-full max-w-6xl">{children}</div>
          )}
        </main>
      </div>
      <FumeroMobileNav />
      <FumeroCommandPaletteLazy />
    </div>
  );
}
