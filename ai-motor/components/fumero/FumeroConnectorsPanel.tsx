"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  CreditCard,
  Globe,
  LayoutTemplate,
  Library,
  Mail,
  Palette,
  PenLine,
  Plug,
  ScanEye,
  Search,
  Sheet,
  ShoppingBag,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getFumeroDataConnectors,
  getFumeroSpecialistConnectors,
  isConnectorToggleable,
  type ConnectorDefinition,
  type ConnectorId,
} from "@/lib/connectors/registry";
import {
  readEnabledConnectors,
  writeEnabledConnectors,
} from "@/lib/connectors/session";

const ICONS: Record<string, LucideIcon> = {
  "shopping-bag": ShoppingBag,
  library: Library,
  "clipboard-list": ClipboardList,
  zap: Zap,
  globe: Globe,
  palette: Palette,
  "scan-eye": ScanEye,
  "layout-template": LayoutTemplate,
  "pen-line": PenLine,
  search: Search,
  "credit-card": CreditCard,
  sheet: Sheet,
  mail: Mail,
};

function statusLabel(status: ConnectorDefinition["status"]): string {
  if (status === "active") return "Live";
  if (status === "available") return "Beschikbaar";
  return "Binnenkort";
}

function ConnectorRow({
  connector,
  enabled,
  onToggle,
}: {
  connector: ConnectorDefinition;
  enabled: boolean;
  onToggle: (id: ConnectorId, next: boolean) => void;
}) {
  const Icon = ICONS[connector.iconKey] ?? Plug;
  const toggleable = isConnectorToggleable(connector);
  const isSoon = connector.status === "coming_soon";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        enabled && toggleable
          ? "border-[var(--fumero-accent)]/35 bg-[var(--fumero-accent-muted)]"
          : "border-[var(--fumero-border)] bg-[var(--fumero-surface)]",
        isSoon && "opacity-70"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          enabled && toggleable
            ? "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)]"
            : "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--fumero-text)]">
            {connector.name}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              connector.status === "active" &&
                "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)]",
              connector.status === "available" &&
                "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]",
              connector.status === "coming_soon" &&
                "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-subtle)]"
            )}
          >
            {statusLabel(connector.status)}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--fumero-text-muted)]">
          {connector.description}
        </p>
      </div>
      {toggleable ? (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${connector.name} ${enabled ? "uit" : "aan"}`}
          onClick={() => onToggle(connector.id, !enabled)}
          className={cn(
            "ios-tap-highlight relative mt-1 h-6 w-10 shrink-0 rounded-full transition-colors",
            enabled ? "bg-[var(--fumero-accent)]" : "bg-[var(--fumero-border)]"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-[var(--fumero-surface)] shadow transition-transform",
              enabled ? "translate-x-[18px]" : "translate-x-0.5"
            )}
          />
        </button>
      ) : (
        <span className="mt-1 shrink-0 text-[10px] font-medium text-[var(--fumero-text-subtle)]">
          Stub
        </span>
      )}
    </div>
  );
}

export function FumeroConnectorsPanel({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange?: (enabled: ConnectorId[]) => void;
}) {
  const dataConnectors = getFumeroDataConnectors();
  const specialistConnectors = getFumeroSpecialistConnectors().filter(
    (c) => c.id !== "copywriter" && c.id !== "seo"
  );
  const [enabled, setEnabled] = useState<ConnectorId[]>([]);

  useEffect(() => {
    if (!open) return;
    setEnabled(readEnabledConnectors());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleToggle = useCallback(
    (id: ConnectorId, next: boolean) => {
      setEnabled((prev) => {
        const set = new Set(prev);
        if (next) set.add(id);
        else set.delete(id);
        const ids = [...set];
        writeEnabledConnectors(ids);
        onChange?.(ids);
        return ids;
      });
    },
    [onChange]
  );

  if (!open) return null;

  const allConnectors = [...dataConnectors, ...specialistConnectors];
  const activeCount = enabled.filter((id) =>
    allConnectors.some((c) => c.id === id && c.status === "active")
  ).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fumero-connectors-title"
      onClick={onClose}
    >
      <div
        className="fumero-connectors-panel flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--fumero-success-border)] bg-[var(--fumero-accent-muted)] px-4 py-3">
          <div className="flex gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)]">
              <Plug className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2
                id="fumero-connectors-title"
                className="text-[15px] font-semibold text-[var(--fumero-text)]"
              >
                Connectors & specialisten
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--fumero-text-muted)]">
                {activeCount} live bron{activeCount === 1 ? "" : "nen"} actief
                voor Max in deze sessie
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ios-tap-highlight rounded-lg p-1 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface)]/80 hover:text-[var(--fumero-text)]"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--fumero-text-muted)]">
            Koppel live Fumero-data en specialisten zodat Max niet alles
            alleen hoeft te doen. Alleen relevante connectors worden per vraag
            geladen.
          </p>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fumero-text-subtle)]">
            Live data
          </p>
          <div className="mb-4 space-y-2">
            {dataConnectors.map((c) => (
              <ConnectorRow
                key={c.id}
                connector={c}
                enabled={enabled.includes(c.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fumero-text-subtle)]">
            Specialisten
          </p>
          <div className="space-y-2">
            {specialistConnectors.map((c) => (
              <ConnectorRow
                key={c.id}
                connector={c}
                enabled={enabled.includes(c.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-4 py-2.5">
          <p className="text-[11px] text-[var(--fumero-text-muted)]">
            Webdesigner en Templates helpen bij bouwen. UX-tester draait via{" "}
            <span className="font-medium text-[var(--fumero-text-muted)]">Laat UX checken</span>{" "}
            in de composer. Copywriter en SEO volgen later.
          </p>
        </div>
      </div>
    </div>
  );
}
