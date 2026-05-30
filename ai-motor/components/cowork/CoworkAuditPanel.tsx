"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";

type AuditLogRow = {
  id: number;
  actor: string;
  action: string;
  resource: string | null;
  klant: string | null;
  created_at: string;
  detail: Record<string, unknown> | null;
};

export function CoworkAuditPanel() {
  const company = useCompanyStore((s) => s.company);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterKlant, setFilterKlant] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "120" });
      if (filterKlant) qs.set("klant", company);
      const res = await fetch(`/api/cowork/audit?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { logs?: AuditLogRow[] };
      setLogs(json.logs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [company, filterKlant]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={filterKlant}
            onChange={(e) => setFilterKlant(e.target.checked)}
          />
          Alleen klant {company}
        </label>
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

      {err && (
        <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Laden…</p>
      )}

      <ul className="space-y-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="rounded-xl border border-border bg-surface-elevated/40 px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">
                {log.action}
              </p>
              <p className="text-[11px] text-text-secondary">{log.created_at}</p>
            </div>
            <p className="text-xs text-text-secondary">
              {log.actor}
              {log.resource ? ` · ${log.resource}` : ""}
              {log.klant ? ` · ${log.klant}` : ""}
            </p>
            {log.detail && Object.keys(log.detail).length > 0 && (
              <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-text-secondary">
                {JSON.stringify(log.detail, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>

      {!loading && logs.length === 0 && (
        <p className="text-sm text-text-secondary">Geen audit logs.</p>
      )}
    </div>
  );
}
