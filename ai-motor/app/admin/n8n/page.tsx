"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

type WorkflowRow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
};

export default function AdminN8nWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [n8nHost, setN8nHost] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/n8n-workflows", {
        credentials: "include",
      });
      const data = (await res.json()) as {
        workflows?: WorkflowRow[];
        error?: string;
        n8nHost?: string;
        configured?: boolean;
      };
      if (!res.ok && res.status !== 503) {
        setErr(data.error ?? (await res.text()));
        setWorkflows([]);
        setConfigured(data.configured ?? null);
        return;
      }
      setWorkflows(data.workflows ?? []);
      setN8nHost(data.n8nHost ?? null);
      setConfigured(data.configured ?? false);
      if (data.error) setErr(data.error);
      else setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell title="n8n workflows">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">
            n8n — read-only overzicht
          </h2>
          <p className="text-sm text-text-secondary">
            Lijst komt rechtstreeks van de n8n REST API (
            <code className="rounded bg-surface-elevated px-1 text-xs">
              GET /api/v1/workflows
            </code>
            ). Stel{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              N8N_API_KEY
            </code>{" "}
            en optioneel{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              N8N_BASE_URL
            </code>{" "}
            in op de server. Geen wijzigingen aan workflows vanuit deze pagina.
          </p>
          {n8nHost && (
            <p className="text-xs text-text-secondary">
              Host:{" "}
              <span className="font-mono text-text-primary">{n8nHost}</span>
            </p>
          )}
        </div>

        {configured === false && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <strong>N8N_API_KEY ontbreekt.</strong> Zet de key in{" "}
            <code className="rounded bg-surface-elevated px-1">.env.local</code>{" "}
            en herstart de Motor.
          </p>
        )}

        {err && configured !== false && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Workflows</h3>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-accent hover:underline"
            >
              Vernieuwen
            </button>
          </div>
          {loading && (
            <p className="text-sm text-text-secondary">Laden…</p>
          )}
          {!loading && workflows.length === 0 && configured && !err && (
            <p className="text-sm text-text-secondary">Geen workflows gevonden.</p>
          )}
          <ul className="space-y-2">
            {workflows.map((w) => (
              <li
                key={w.id}
                className="rounded-2xl border border-border bg-surface-elevated/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium text-text-primary">
                    {w.name || "(zonder naam)"}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                      w.active
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-surface-elevated text-text-secondary"
                    )}
                  >
                    {w.active ? "actief" : "inactief"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-text-secondary">
                  id {w.id}
                  {w.updatedAt ? ` · ${w.updatedAt}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
