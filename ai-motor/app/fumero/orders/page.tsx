"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fumero/orders?limit=100", { credentials: "include" });
      const data = (await res.json()) as {
        orders?: OrderRow[];
        stats?: typeof stats;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Orders laden mislukt");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setStats(data.stats);
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
    <FumeroShell page="Orders">
      <div className="mx-auto max-w-5xl">
        <FumeroPageHeader
          title="Orders"
          description="Orders uit de database — sync via automation."
        />

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Totaal", value: stats?.count ?? orders.length },
            { label: "Vandaag", value: stats?.today_count ?? 0 },
            {
              label: "Omzet (DB)",
              value: asEuro(Number(stats?.total_cents ?? 0)),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-3"
            >
              <p className="text-xs text-[#737373]">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-[#171717]">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-sm rounded-lg border-[#E5E5E5]"
            placeholder="Zoek order of klant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-lg border border-[#E5E5E5] bg-white"
            disabled={syncing}
            onClick={() => void syncOrders()}
          >
            {syncing ? "Synchroniseren…" : "Sync orders"}
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
          <p className="mb-4 text-sm text-[#525252]">{syncNote}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#737373]">Orders laden…</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left text-xs font-medium text-[#737373]">
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
                      <p className="text-sm font-medium text-[#525252]">Geen orders gevonden</p>
                      <p className="mt-1 text-xs text-[#737373]">
                        {query.trim()
                          ? "Pas je zoekopdracht aan of wis het filter."
                          : "Synchroniseer orders via de knop hierboven of activeer de order-automation."}
                      </p>
                      {!query.trim() ? (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-[#69C400] shadow-none hover:bg-[#5db000]"
                            disabled={syncing}
                            onClick={() => void syncOrders()}
                          >
                            {syncing ? "Synchroniseren…" : "Sync orders"}
                          </Button>
                          <Button asChild type="button" size="sm" variant="secondary" className="rounded-lg">
                            <Link href="/fumero/automations">Naar automations</Link>
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  visible.map((order) => (
                    <tr key={order.id} className="border-b border-[#E5E5E5] last:border-0">
                      <td className="px-4 py-2 font-medium tabular-nums">
                        #{order.external_id}
                      </td>
                      <td className="px-4 py-2 text-[#525252]">
                        {order.customer_hint ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {asEuro(order.total_cents)}
                      </td>
                      <td className="px-4 py-2">
                        <FumeroOrderStatusBadge rawSummary={order.raw_summary} />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-[#737373]">
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
