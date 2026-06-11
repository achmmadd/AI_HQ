"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type HealthState = {
  ok: boolean;
  label: string;
  level?: string;
  checked_at?: string;
};

export function FumeroWorkspaceHealth() {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/fumero/health", { credentials: "include" });
        const json = (await res.json()) as {
          ok?: boolean;
          label?: string;
          level?: string;
          checked_at?: string;
        };
        if (cancelled) return;
        setHealth({
          ok: res.ok && json.ok === true,
          label: json.label || (res.ok ? "Operationeel" : "Offline"),
          level: json.level,
          checked_at: json.checked_at,
        });
      } catch {
        if (!cancelled) setHealth({ ok: false, label: "Offline" });
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
    return <span className="text-xs text-[var(--fumero-text-subtle)]">…</span>;
  }

  const title = health.checked_at
    ? `${health.label} — bijgewerkt ${new Date(health.checked_at).toLocaleString("nl-NL")}`
    : health.ok
      ? "Systeemstatus op basis van live checks"
      : "Workspace health check mislukt";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        health.ok
          ? "text-[var(--fumero-text-muted)]"
          : health.level === "config_required"
            ? "text-amber-700 dark:text-amber-400"
            : "text-[var(--fumero-destructive)]"
      )}
      title={title}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          health.ok
            ? "bg-[var(--fumero-accent)]"
            : health.level === "config_required"
              ? "bg-amber-500"
              : "bg-[var(--fumero-destructive)]"
        )}
        aria-hidden
      />
      {health.label}
    </span>
  );
}
