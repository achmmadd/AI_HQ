"use client";

import { useFumeroStudioKpis } from "@/hooks/useFumeroStudioKpis";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function FumeroStudioOverviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    loading,
    libraryCount,
    activeAutomations,
    openOrdersCount,
    briefingAgeLabel,
  } = useFumeroStudioKpis();

  if (!open) return null;

  const items = [
    { label: "Bibliotheek", value: libraryCount },
    { label: "Automatisering", value: activeAutomations },
    { label: "Open bestellingen", value: openOrdersCount },
    { label: "Dagoverzicht", value: briefingAgeLabel },
  ];

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fumero-studio-overview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="fumero-studio-overview-title"
              className="fumero-text-h3 text-[var(--fumero-text)]"
            >
              Studio overzicht
            </h2>
            <p className="fumero-text-body-sm mt-1 text-[var(--fumero-text-muted)]">
              Kerncijfers van je shop
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)] hover:text-[var(--fumero-text)]"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {items.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2.5"
            >
              <dt className="fumero-text-micro text-[var(--fumero-text-subtle)]">
                {label}
              </dt>
              <dd
                className={cn(
                  "fumero-text-h2 mt-0.5 tabular-nums text-[var(--fumero-text)]",
                  loading && "text-[var(--fumero-text-subtle)]"
                )}
              >
                {loading
                  ? "…"
                  : value === null || value === undefined
                    ? "—"
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
