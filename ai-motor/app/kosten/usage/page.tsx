"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Period = "today" | "week" | "month";

interface SummaryData {
  grand_total: string;
  total_tokens: number;
  total_eur: number;
  totals: Array<{
    model: string;
    klant: string;
    total_cost: number | null;
    total_tokens?: number;
    total_calls: number;
  }>;
  by_agent: Array<{
    agent_label: string;
    display_name: string;
    total_tokens: number;
    total_cost_eur: number;
    total_calls: number;
  }>;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Vandaag",
  week: "Week",
  month: "Maand",
};

export default function UsagePage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [period, setPeriod] = useState<Period>("today");

  useEffect(() => {
    fetch(`/api/usage/summary?period=${period}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData);
  }, [period]);

  return (
    <AppShell title="Token usage">
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Overzicht per Motor, Turbo, web-onderzoek en automation.{" "}
          <Link href="/kosten" className="text-accent underline">
            Klassiek kostenoverzicht
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
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

        {data && (
          <>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-text-secondary">
                  Totaal {PERIOD_LABELS[period].toLowerCase()}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {(data.total_tokens || 0).toLocaleString("nl-NL")} tokens
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  ~€{Number(data.total_eur || 0).toFixed(4)} · $
                  {data.grand_total} (USD logs)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per type (Motor / Turbo / …)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.by_agent.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Nog geen chat-usage — stuur een bericht in Chat.
                  </p>
                ) : (
                  data.by_agent.map((r) => (
                    <div
                      key={r.agent_label}
                      className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{r.display_name}</p>
                        <p className="text-xs text-text-secondary">
                          {r.agent_label} · {r.total_calls} calls
                        </p>
                      </div>
                      <p className="text-right font-mono text-sm">
                        {(Number(r.total_tokens) || 0).toLocaleString("nl-NL")}{" "}
                        tok
                        <br />
                        <span className="text-text-secondary">
                          ~€{Number(r.total_cost_eur || 0).toFixed(4)}
                        </span>
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.totals.map((t, i) => (
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
                      {(Number(t.total_tokens) || 0).toLocaleString("nl-NL")} tok
                      · ${(Number(t.total_cost) || 0).toFixed(4)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
