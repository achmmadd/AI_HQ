"use client";

import { useEffect } from "react";
import { FumeroSidebar } from "@/components/fumero/fumero-sidebar";
import { FumeroTopbar } from "@/components/fumero/fumero-topbar";
import { FumeroCommandPaletteLazy } from "@/components/fumero/fumero-command-palette-lazy";

export function FumeroShell({
  page,
  actionLabel,
  actionHref,
  flush = false,
  showBriefing = false,
  breadcrumbs,
  children,
}: {
  page: string;
  actionLabel?: string;
  actionHref?: string;
  flush?: boolean;
  showBriefing?: boolean;
  /** Override default breadcrumbs (avoids duplicate page title on flush canvases). */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${page} · Fumero Studio`;
  }, [page]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--fumero-bg)]">
      <FumeroSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <FumeroTopbar
          breadcrumbs={
            breadcrumbs ?? [
              { label: "Fumero Studio", href: "/fumero/chat" },
              { label: page },
            ]
          }
          actionLabel={actionLabel}
          actionHref={actionHref}
          showBriefing={showBriefing}
        />
        <main
          className={
            flush
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex-1 overflow-y-auto p-4 md:p-6"
          }
        >
          {children}
        </main>
      </div>
      <FumeroCommandPaletteLazy />
    </div>
  );
}
