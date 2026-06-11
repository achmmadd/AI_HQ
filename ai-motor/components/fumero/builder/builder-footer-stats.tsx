"use client";

import { useFumeroStudioKpis } from "@/hooks/useFumeroStudioKpis";
import { cn } from "@/lib/utils";

export function BuilderFooterStats({ className }: { className?: string }) {
  const { loading, libraryCount, activeAutomations } = useFumeroStudioKpis();

  const items = [
    {
      label: "automatiseringen actief",
      value: activeAutomations === null ? "—" : String(activeAutomations),
    },
    {
      label: "items in bibliotheek",
      value: libraryCount === null ? "—" : String(libraryCount),
    },
    { label: "autosave aan", value: null },
  ];

  return (
    <footer
      className={cn(
        "builder-footer-stats flex flex-wrap items-center gap-x-3 gap-y-1 pt-2",
        className
      )}
      aria-label="Workspace status"
    >
      {items.map((item, i) => (
        <span key={item.label} className="inline-flex items-center gap-3">
          {i > 0 ? (
            <span className="text-[var(--builder-text-subtle)]" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="builder-vi-label text-[10px] text-[var(--builder-text-subtle)]">
            {item.value !== null ? (
              <>
                <span className="text-[var(--builder-text-secondary)]">
                  {loading ? "…" : item.value}
                </span>{" "}
              </>
            ) : null}
            {item.label}
          </span>
        </span>
      ))}
    </footer>
  );
}
