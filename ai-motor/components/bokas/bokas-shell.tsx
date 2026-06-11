"use client";

import { useEffect } from "react";
import { BokasOsSidebar } from "@/components/os/bokas-os-sidebar";
import { OsTopbar } from "@/components/os/os-topbar";
import "@/styles/os-chat.css";

export function BokasShell({
  page,
  actionLabel,
  actionHref,
  flush = false,
  hideTopbar = false,
  breadcrumbs,
  children,
}: {
  page: string;
  actionLabel?: string;
  actionHref?: string;
  flush?: boolean;
  hideTopbar?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${page} · Bokas`;
  }, [page]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-[var(--os-bg)]"
      data-os-chat={flush ? "" : undefined}
    >
      <BokasOsSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {!hideTopbar ? (
          <OsTopbar
            breadcrumbs={
              breadcrumbs ?? [
                { label: "Bokas", href: "/bokas" },
                { label: page },
              ]
            }
            actionLabel={actionLabel}
            actionHref={actionHref}
          />
        ) : null}
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
    </div>
  );
}
