"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
import { FumeroAlert } from "@/components/fumero/ui/fumero-primitives";
import { FumeroOrderStatusBadge } from "@/components/fumero/ops/fumero-order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderRow = {
  id: number;
  external_id: string;
  order_date: string;
  total_cents: number;
  customer_hint: string | null;
  raw_summary: string | null;
};

function asEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

export default function FumeroOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{
    count?: number;
    today_count?: number;
    total_cents?: number;
  }>();
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [syncMeta, setSyncMeta] = useState<{
    state?: string;
    configured?: boolean;
    last_success_at?: string | null;
    last_scraped_at?: string | null;
    last_error?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fumero/orders?limit=100", { credentials: "include" });
      const data = (await res.json()) as {
        orders?: OrderRow[];
        stats?: typeof stats;
        sync?: typeof syncMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Orders laden mislukt");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setStats(data.stats);
      setSyncMeta(data.sync ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncOrders = async () => {
    setSyncing(true);
    setSyncNote("");
    setError("");
    try {
      const res = await fetch("/api/fumero/orders/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        run?: { status?: string; detail?: string };
      };
      if (!res.ok) throw new Error(data.error || "Sync mislukt");
      setSyncNote(
        data.ok
          ? "Orders gesynchroniseerd."
          : `Sync afgerond met status: ${data.run?.status ?? "onbekend"}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync mislukt");
    } finally {
      setSyncing(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.external_id.toLowerCase().includes(q) ||
        (o.customer_hint ?? "").toLowerCase().includes(q)
    );
  }, [orders, query]);

  return (
    <FumeroShell page="Bestellingen">
      <div className="mx-auto max-w-5xl">
        <FumeroPageHeader
          title="Bestellingen"
          description="Overzicht van shoporders — synchroniseer om de laatste stand te zien."
        />

        {syncMeta?.state === "config_missing" ? (
          <FumeroAlert variant="warning" className="mb-4">
            Shop-login is nog niet geconfigureerd (FUMERO_ADMIN_USER en
            FUMERO_ADMIN_PASSWORD). Synchronisatie is uitgeschakeld tot dit is
            ingesteld.{" "}
            <Link href="/fumero/settings/context" className="font-medium underline">
              Naar instellingen
            </Link>
          </FumeroAlert>
        ) : null}
        {syncMeta?.state === "sync_failed" && syncMeta.last_error ? (
          <FumeroAlert variant="error" className="mb-4">
            Laatste synchronisatie mislukt: {syncMeta.last_error}
          </FumeroAlert>
        ) : null}
        {syncMeta?.state === "never_synced" ? (
          <FumeroAlert variant="info" className="mb-4">
            Er is nog nooit gesynchroniseerd. Start een sync om orders op te halen.
          </FumeroAlert>
        ) : null}
        {syncMeta?.last_success_at ? (
          <p className="mb-4 text-xs text-[var(--fumero-text-muted)]">
            Laatst succesvol gesynchroniseerd:{" "}
            {new Date(syncMeta.last_success_at).toLocaleString("nl-NL")}
          </p>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Totaal", value: stats?.count ?? orders.length },
            { label: "Vandaag", value: stats?.today_count ?? 0 },
            {
              label: "Omzet",
              value: asEuro(Number(stats?.total_cents ?? 0)),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-4 py-3"
            >
              <p className="text-xs text-[var(--fumero-text-muted)]">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--fumero-text)]">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-sm rounded-lg border-[var(--fumero-border)]"
            placeholder="Zoek order of klant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)]"
            disabled={syncing}
            onClick={() => void syncOrders()}
          >
            {syncing ? "Synchroniseren…" : "Synchroniseren"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => void load()}
          >
            Vernieuwen
          </Button>
        </div>

        {syncNote ? (
          <p className="mb-4 text-sm text-[var(--fumero-text-muted)]">{syncNote}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--fumero-text-muted)]">Orders laden…</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] text-left text-xs font-medium text-[var(--fumero-text-muted)]">
                  <th className="px-4 py-2">#Order</th>
                  <th className="px-4 py-2">Klant</th>
                  <th className="px-4 py-2 text-right">Bedrag</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Datum</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="text-sm font-medium text-[var(--fumero-text-muted)]">Geen orders gevonden</p>
                      <p className="mt-1 text-xs text-[var(--fumero-text-muted)]">
                        {query.trim()
                          ? "Pas je zoekopdracht aan of wis het filter."
                          : syncMeta?.state === "empty"
                            ? "Er zijn nog geen orders in de database — dat kan normaal zijn als er vandaag geen verkopen waren."
                            : syncMeta?.state === "never_synced"
                              ? "Start synchronisatie om orders van de shop op te halen."
                              : syncMeta?.state === "config_missing"
                                ? "Configureer eerst shop-login voordat synchronisatie werkt."
                                : "Synchroniseer orders via de knop hierboven."}
                      </p>
                      {!query.trim() ? (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-[var(--fumero-accent)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
                            disabled={syncing}
                            onClick={() => void syncOrders()}
                          >
                            {syncing ? "Synchroniseren…" : "Synchroniseren"}
                          </Button>
                          <Button asChild type="button" size="sm" variant="secondary" className="rounded-lg">
                            <Link href="/fumero/automations">Naar automatisering</Link>
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  visible.map((order) => (
                    <tr key={order.id} className="border-b border-[var(--fumero-border)] last:border-0">
                      <td className="px-4 py-2 font-medium tabular-nums">
                        #{order.external_id}
                      </td>
                      <td className="px-4 py-2 text-[var(--fumero-text-muted)]">
                        {order.customer_hint ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {asEuro(order.total_cents)}
                      </td>
                      <td className="px-4 py-2">
                        <FumeroOrderStatusBadge rawSummary={order.raw_summary} />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-[var(--fumero-text-muted)]">
                        {new Date(order.order_date).toLocaleString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FumeroShell>
  );
}
