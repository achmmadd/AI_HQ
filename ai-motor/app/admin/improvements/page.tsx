"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Improvement = {
  id: number;
  issue: string;
  reason_cluster: string | null;
  count: number;
  suggested_fix: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function AdminImprovementsPage() {
  const [rows, setRows] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/system-improvements", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { improvements?: Improvement[] };
      setRows(data.improvements ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: number, status: "applied" | "rejected" | "reviewed") {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/system-improvements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Actie mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Verbeteringen (feedback)">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-text-secondary">
          Voorstellen uit de feedback-loop (n8n + Dify).{" "}
          <strong>Goedkeuren</strong> voegt de suggestie toe aan de actieve
          chat-instructies; het volgende antwoord gebruikt ze via de server.
        </p>
        {loading && (
          <p className="text-sm text-text-secondary">Laden…</p>
        )}
        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary">
                    {r.reason_cluster || "cluster"} · {r.count}× ·{" "}
                    <span
                      className={cn(
                        r.status === "applied" && "text-green-600",
                        r.status === "rejected" && "text-error",
                        r.status === "new" && "text-amber-600"
                      )}
                    >
                      {r.status}
                    </span>
                  </p>
                  <h3 className="mt-1 font-medium text-text-primary">
                    {r.issue}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "new" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patchStatus(r.id, "applied")}
                      >
                        Goedkeuren
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patchStatus(r.id, "rejected")}
                      >
                        Afwijzen
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patchStatus(r.id, "reviewed")}
                      >
                        Bekeken
                      </Button>
                    </>
                  )}
                  {r.status === "reviewed" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patchStatus(r.id, "applied")}
                      >
                        Goedkeuren
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patchStatus(r.id, "rejected")}
                      >
                        Afwijzen
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-surface px-3 py-2 text-xs text-text-primary">
                {r.suggested_fix}
              </pre>
              <p className="mt-2 text-[11px] text-text-secondary">
                {r.created_at}
              </p>
            </li>
          ))}
        </ul>
        {!loading && rows.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nog geen voorstellen. Koppel n8n aan{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              /api/cron/feedback-digest
            </code>{" "}
            en{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              /api/cron/improvements
            </code>
            .
          </p>
        )}
      </div>
    </AppShell>
  );
}
