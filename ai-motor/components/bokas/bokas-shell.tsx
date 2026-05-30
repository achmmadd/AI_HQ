"use client";

import { useEffect } from "react";
import { BokasSidebar } from "@/components/bokas/bokas-sidebar";
import { BokasTopbar } from "@/components/bokas/bokas-topbar";

export function BokasShell({
  page,
  actionLabel,
  actionHref,
  flush = false,
  children,
}: {
  page: string;
  actionLabel?: string;
  actionHref?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${page} · Bokas`;
  }, [page]);

  return (
    <div className="shell">
      <BokasSidebar />
      <div className="main">
        <BokasTopbar page={page} actionLabel={actionLabel} actionHref={actionHref} />
        <div className="pages">
          <div
            className="page active"
            style={flush ? { padding: 0 } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
