"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import type { ChatKlant } from "@/lib/types";
import {
  chatUsageDisplayName,
  type ChatUsageDisplayKind,
} from "@/lib/chat-usage-labels";

type UsageRow = {
  agent_label: string;
  total_tokens: number;
  total_cost_eur: number;
  total_calls: number;
};

function labelToKind(label: string): ChatUsageDisplayKind {
  if (label.includes("turbo")) return "turbo";
  if (label.includes("onderzoek")) return "onderzoek";
  if (label.includes("automation")) return "automation";
  if (label.includes("lokaal")) return "lokaal";
  return "motor";
}

export function MotorUsageStrip({
  company,
  refreshKey = 0,
}: {
  company: ChatKlant;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalEur, setTotalEur] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/usage/summary?period=today&klant=${encodeURIComponent(company)}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((d: { by_agent?: UsageRow[]; total_tokens?: number; total_eur?: number }) => {
        if (cancelled) return;
        setRows(d.by_agent ?? []);
        setTotalTokens(Number(d.total_tokens) || 0);
        setTotalEur(Number(d.total_eur) || 0);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTotalTokens(0);
          setTotalEur(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [company, refreshKey]);

  if (rows.length === 0 && totalTokens === 0) return null;

  return (
    <div className="motors-chat-column border-t border-border/30 bg-surface/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
          <span className="font-medium text-text-primary/90">Vandaag</span>
          <span>
            {totalTokens.toLocaleString("nl-NL")} tokens
            {totalEur > 0 ? ` · ~€${totalEur.toFixed(3)}` : ""}
          </span>
          {rows.slice(0, 4).map((r) => (
            <span key={r.agent_label} className="whitespace-nowrap">
              {chatUsageDisplayName(labelToKind(r.agent_label))}:{" "}
              {(Number(r.total_tokens) || 0).toLocaleString("nl-NL")}
            </span>
          ))}
        </div>
        <Link
          href="/kosten/usage"
          className="ios-tap-highlight inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Kosten
        </Link>
      </div>
    </div>
  );
}
