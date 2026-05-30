"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type N8nExecution = {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  startedAt?: string;
  stoppedAt?: string;
  mode?: string;
};

export function CoworkN8nRunsPanel() {
  const [executions, setExecutions] = useState<N8nExecution[]>([]);
  const [ok, setOk] = useState(false);
  const [source, setSource] = useState<"n8n" | "fallback">("fallback");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cowork/n8n-runs?limit=40", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        ok?: boolean;
        executions?: N8nExecution[];
        error?: string;
        source?: "n8n" | "fallback";
      };
      setOk(Boolean(json.ok));
      setExecutions(json.executions ?? []);
      setSource(json.source ?? "fallback");
      setError(json.error ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
      setExecutions([]);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          n8n workflow executions
          {source === "n8n" ? " (live)" : " (fallback)"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-xl"
          onClick={() => void load()}
        >
          Vernieuwen
        </Button>
      </div>

      {!ok && error && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Laden…</p>
      )}

      <ul className="space-y-3">
        {executions.map((ex) => (
          <li
            key={ex.id}
            className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
          >
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                ex.status === "success" && "text-green-600",
                ex.status === "error" && "text-error",
                ex.status !== "success" &&
                  ex.status !== "error" &&
                  "text-text-secondary"
              )}
            >
              {ex.status}
              {ex.mode ? ` · ${ex.mode}` : ""}
            </p>
            <h3 className="mt-0.5 font-medium text-text-primary">
              {ex.workflowName ?? `Workflow ${ex.workflowId}`}
            </h3>
            <p className="mt-1 text-[11px] text-text-secondary">
              #{ex.id}
              {ex.startedAt ? ` · start ${ex.startedAt}` : ""}
              {ex.stoppedAt ? ` · stop ${ex.stoppedAt}` : ""}
            </p>
          </li>
        ))}
      </ul>

      {!loading && executions.length === 0 && (
        <p className="text-sm text-text-secondary">
          Geen executions gevonden.
          {!ok && " Zet N8N_API_KEY en controleer of n8n draait."}
        </p>
      )}
    </div>
  );
}
