"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type HealthState = {
  ok: boolean;
  label: string;
};

export function FumeroWorkspaceHealth() {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/fumero/health", { credentials: "include" });
        const json = (await res.json()) as { ok?: boolean; label?: string };
        if (cancelled) return;
        setHealth({
          ok: res.ok && json.ok === true,
          label: json.label || (res.ok ? "Studio OK" : "Offline"),
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
    return <span className="text-xs text-[#a3a3a3]">…</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        health.ok ? "text-[#525252]" : "text-red-600"
      )}
      title={health.ok ? "Database en Fumero API bereikbaar" : "Workspace health check mislukt"}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          health.ok ? "bg-[#69C400]" : "bg-red-500"
        )}
        aria-hidden
      />
      {health.label}
    </span>
  );
}
