"use client";

import { useCallback, useEffect, useState } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroAlert } from "@/components/fumero/ui/fumero-primitives";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";

type BudgetStatus = {
  klant: string;
  limitEur: number;
  spentEur: number;
  pct: number;
  overBudget: boolean;
  nearLimit: boolean;
};

type UsageRow = {
  model: string;
  calls: number;
  tokens: number;
  cost_eur: number;
};

type PricingMeta = {
  currency?: string;
  source?: string;
  eur_usd_rate?: number;
  rounded_to?: string;
  as_of?: string;
};

function formatEur(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(amount);
}

function formatTokens(n: number): string {
  return new Intl.NumberFormat("nl-NL").format(n);
}

export default function FumeroSettingsBillingPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [note, setNote] = useState("");
  const [pricing, setPricing] = useState<PricingMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/billing/summary?klant=fumero", {
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Laden mislukt");
      setBudget(j.budget ?? null);
      setUsage(Array.isArray(j.usage_this_month) ? j.usage_this_month : []);
      setNote(typeof j.note === "string" ? j.note : "");
      setPricing(j.pricing ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FumeroShell page="Gebruik & budget">
      <div className="flex w-full flex-col gap-6">
        <SettingsNav />
        <div className="fumero-card rounded-[var(--fumero-radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-[var(--fumero-text)]">Gebruik deze maand</h2>
          <p className="mt-1 text-sm text-[var(--fumero-text-muted)]">
            Overzicht van AI-verbruik voor Fumero Studio. Bedragen in euro,
            afgerond per model.
          </p>
          {pricing?.as_of ? (
            <p className="mt-2 text-xs text-[var(--fumero-text-muted)]">
              Prijsbron: {pricing.source ?? "usage_logs"} · EUR/USD{" "}
              {pricing.eur_usd_rate?.toLocaleString("nl-NL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? "0,92"}{" "}
              · bijgewerkt{" "}
              {new Date(pricing.as_of).toLocaleString("nl-NL", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}

          {error ? (
            <FumeroAlert variant="error" className="mt-4">
              {error}
            </FumeroAlert>
          ) : null}

          {loading ? (
            <p className="mt-4 text-sm text-[var(--fumero-text-muted)]">Laden…</p>
          ) : (
            <>
              {budget ? (
                <div className="mt-4 rounded-lg bg-[var(--fumero-surface-muted)] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--fumero-text-muted)]">Maandbudget</span>
                    <span className="font-medium text-[var(--fumero-text)]">
                      {formatEur(budget.spentEur)} / {formatEur(budget.limitEur)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fumero-surface-muted)]">
                    <div
                      className={`h-full rounded-full ${
                        budget.overBudget
                          ? "bg-[var(--fumero-destructive)]"
                          : budget.nearLimit
                            ? "bg-[var(--fumero-accent)] opacity-70"
                            : "bg-[var(--fumero-accent)]"
                      }`}
                      style={{ width: `${Math.min(100, budget.pct)}%` }}
                    />
                  </div>
                  {budget.overBudget ? (
                    <p className="mt-2 fumero-text-micro text-[var(--fumero-danger-fg)]">
                      Budget overschreden
                    </p>
                  ) : budget.nearLimit ? (
                    <p className="mt-2 fumero-text-micro text-[var(--fumero-text-muted)]">
                      Nabij maandlimiet
                    </p>
                  ) : null}
                </div>
              ) : null}

              {usage.length > 0 ? (
                <table className="mt-4 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--fumero-border)] text-xs text-[var(--fumero-text-muted)]">
                      <th className="py-2 font-medium">Model</th>
                      <th className="py-2 font-medium">Verzoeken</th>
                      <th className="py-2 font-medium">Tokens</th>
                      <th className="py-2 text-right font-medium">Kosten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={row.model} className="fumero-table-row">
                        <td className="py-2 text-[var(--fumero-text)]">{row.model}</td>
                        <td className="py-2 tabular-nums text-[var(--fumero-text-muted)]">{row.calls}</td>
                        <td className="py-2 tabular-nums text-[var(--fumero-text-muted)]">
                          {formatTokens(row.tokens)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--fumero-text-muted)]">
                          {formatEur(Number(row.cost_eur))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-4 text-sm text-[var(--fumero-text-muted)]">Nog geen usage deze maand.</p>
              )}

              {note && !note.toLowerCase().includes("stripe") ? (
                <p className="mt-4 text-xs text-[var(--fumero-text-muted)]">{note}</p>
              ) : null}
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4 rounded-lg border-[var(--fumero-border)]"
            onClick={() => void load()}
          >
            Vernieuwen
          </Button>
        </div>
      </div>
    </FumeroShell>
  );
}
