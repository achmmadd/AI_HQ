"use client";

import Link from "next/link";

export function BokasTopbar({
  page,
  actionLabel,
  actionHref,
}: {
  page: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <header className="topbar">
      <span className="topbar-title">Bokas</span>
      <span className="topbar-sep">/</span>
      <span className="topbar-page">{page}</span>
      <div className="topbar-right">
        <span className="live-badge">
          <span className="live-dot" />
          Live
        </span>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="btn btn-accent">
            + {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
