"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SystemCheck = {
  id: string;
  label: string;
  ok: boolean;
  status: string;
  hint?: string;
};

type HealthState = {
  ok: boolean;
  label: string;
  level?: string;
  checked_at?: string;
  checks: SystemCheck[];
};

function failingChecks(checks: SystemCheck[]): SystemCheck[] {
  return checks.filter((c) => !c.ok || c.status === "config_required" || c.status === "error");
}

export function FumeroWorkspaceHealth({
  variant = "default",
}: {
  variant?: "default" | "instrument";
}) {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/fumero/health", { credentials: "include" });
        const text = await res.text();
        let json: {
          ok?: boolean;
          label?: string;
          level?: string;
          checked_at?: string;
          checks?: SystemCheck[];
        } = {};
        if (text.trim()) {
          try {
            json = JSON.parse(text) as typeof json;
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        setHealth({
          ok: res.ok && json.ok === true,
          label: json.label || (res.ok ? "Operationeel" : "Offline"),
          level: json.level,
          checked_at: json.checked_at,
          checks: Array.isArray(json.checks) ? json.checks : [],
        });
      } catch {
        if (!cancelled) setHealth({ ok: false, label: "Offline", checks: [] });
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!health) {
    return (
      <span
        className={cn(
          variant === "instrument" && "builder-vi-label text-[10px]",
          "text-xs text-[var(--fumero-text-subtle)]"
        )}
      >
        …
      </span>
    );
  }

  const displayLabel =
    variant === "instrument" && health.ok
      ? "Alle systemen live"
      : health.label;

  const issues = failingChecks(health.checks);
  const titleLines = [
    health.checked_at
      ? `${health.label} — bijgewerkt ${new Date(health.checked_at).toLocaleString("nl-NL")}`
      : health.label,
    ...issues.map((c) => (c.hint ? `${c.label}: ${c.hint}` : c.label)),
  ];

  const toneClass = health.ok
    ? "text-[var(--fumero-text-muted)]"
    : health.level === "config_required"
      ? "text-amber-700 dark:text-amber-400"
      : "text-[var(--fumero-destructive)]";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => issues.length > 0 && setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          variant === "instrument"
            ? "builder-vi-label text-[10px]"
            : "text-xs",
          toneClass,
          issues.length > 0 && "cursor-pointer hover:opacity-80"
        )}
        title={titleLines.join("\n")}
        aria-expanded={open}
        aria-label={`Systeemstatus: ${health.label}`}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            health.ok
              ? "bg-[var(--fumero-text-muted)]"
              : health.level === "config_required"
                ? "bg-amber-500"
                : "bg-[var(--fumero-destructive)]"
          )}
          aria-hidden
        />
        {displayLabel}
      </button>

      {open && issues.length > 0 ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-3 text-left shadow-lg">
          <p className="fumero-text-caption font-semibold text-[var(--fumero-text)]">
            Ontbrekende configuratie
          </p>
          <ul className="mt-2 space-y-2">
            {issues.map((check) => (
              <li key={check.id} className="fumero-text-caption text-[var(--fumero-text-muted)]">
                <span className="font-medium text-[var(--fumero-text)]">{check.label}</span>
                {check.hint ? <span> — {check.hint}</span> : null}
              </li>
            ))}
          </ul>
          {issues.some((c) => c.id === "fal_media") ? (
            <p className="mt-2 fumero-text-caption text-[var(--fumero-text-muted)]">
              In Campaign Studio: gebruik “Alleen strategy + copy” of stel FAL_KEY in.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
