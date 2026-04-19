"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Period = "today" | "week" | "month";

interface UsageData {
  grand_total: string;
  totals: Array<{
    model: string;
    klant: string;
    total_cost: number | null;
    total_calls: number;
  }>;
  daily: Array<{ dag: string; kosten: number; calls: number }>;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Vandaag",
  week: "Week",
  month: "Maand",
};

export default function KostenPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [period, setPeriod] = useState<Period>("today");

  useEffect(() => {
    fetch(`/api/usage?period=${period}`)
      .then((r) => r.json())
      .then(setData);
  }, [period]);

  const totalCalls =
    data?.totals.reduce((s, r) => s + (Number(r.total_calls) || 0), 0) ?? 0;

  return (
    <AppShell title="Kosten">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            Usage logs — schatting op basis van ingelogde calls (
            <code className="text-xs">POST /api/usage</code>)
          </p>
          <div className="flex gap-2">
            {(["today", "week", "month"] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant={period === p ? "default" : "secondary"}
                size="sm"
                className="rounded-xl"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>

        {data && (
          <>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-text-secondary">
                  Totaal {PERIOD_LABELS[period].toLowerCase()}
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">
                  ${data.grand_total}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {totalCalls} gelogde calls
                </p>
              </CardContent>
            </Card>

            {data.daily.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Kosten per dag (30 dagen)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily}>
                      <XAxis dataKey="dag" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number | string) => [
                          typeof v === "number" ? `$${v.toFixed(4)}` : v,
                          "Kosten",
                        ]}
                      />
                      <Bar
                        dataKey="kosten"
                        fill="#0a84ff"
                        radius={[4, 4, 0, 0]}
                        name="Kosten"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per model / klant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.totals.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Nog geen data — laat workflows logs sturen naar /api/usage
                  </p>
                ) : (
                  data.totals.map((t, i) => (
                    <div
                      key={`${t.model}-${t.klant}-${i}`}
                      className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{t.model}</p>
                        <p className="text-xs text-text-secondary">
                          {t.klant} · {t.total_calls} calls
                        </p>
                      </div>
                      <p className="font-mono text-sm">
                        ${(Number(t.total_cost) || 0).toFixed(4)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
