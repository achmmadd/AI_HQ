"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BridgeRow = {
  bridge_id: string;
  device_name: string;
  workspace_hint: string | null;
  last_seen_at: string;
  created_at: string;
};

export function CoworkBridgePanel() {
  const [bridges, setBridges] = useState<BridgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/cowork/bridges", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { bridges?: BridgeRow[] };
      setBridges(json.bridges ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(bridge_id: string) {
    if (!window.confirm(`Bridge ${bridge_id} intrekken?`)) return;
    setBusyId(bridge_id);
    setErr(null);
    try {
      const res = await fetch("/api/cowork/bridges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bridge_id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? (await res.text()));
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Intrekken mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Geregistreerde PC-bridge clients voor remote file/command uitvoering.
      </p>

      {err && (
        <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Laden…</p>
      )}

      <ul className="space-y-3">
        {bridges.map((b) => (
          <li
            key={b.bridge_id}
            className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {b.bridge_id}
                </p>
                <h3 className="mt-0.5 font-medium text-text-primary">
                  {b.device_name}
                </h3>
                {b.workspace_hint && (
                  <p className="mt-1 text-xs text-text-secondary">
                    Workspace: {b.workspace_hint}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-text-secondary">
                  Laatst gezien: {b.last_seen_at} · Aangemaakt: {b.created_at}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl text-error"
                disabled={busyId === b.bridge_id}
                onClick={() => void revoke(b.bridge_id)}
              >
                Intrekken
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {!loading && bridges.length === 0 && (
        <p className="text-sm text-text-secondary">
          Geen actieve bridges — registreer via de bridge API.
        </p>
      )}
    </div>
  );
}
