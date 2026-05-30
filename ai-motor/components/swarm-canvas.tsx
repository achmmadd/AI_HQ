"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENT_ROSTER } from "@/lib/agent-catalog";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

type NodeState = {
  slug: string;
  label: string;
  hasRecentRun: boolean;
  costEur?: number;
};

export function SwarmCanvas() {
  const company = useCompanyStore((s) => s.company);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});

  const load = useCallback(async () => {
    try {
      const hRes = await fetch("/api/health", { credentials: "include" });
      const hj = (await hRes.json()) as { ok?: boolean };
      setHealthOk(!!hj.ok);
    } catch {
      setHealthOk(false);
    }

    const map: Record<string, NodeState> = {};
    await Promise.all(
      AGENT_ROSTER.map(async (a) => {
        try {
          const r = await fetch(
            `/api/agents/${encodeURIComponent(a.slug)}/runs?klant=${encodeURIComponent(company)}&limit=1`,
            { credentials: "include" }
          );
          const j = (await r.json()) as {
            runs?: Array<{ cost_eur?: number | null; created_at?: string | null }>;
          };
          const run = j.runs?.[0];
          map[a.slug] = {
            slug: a.slug,
            label: a.label,
            hasRecentRun: Boolean(run?.created_at),
            costEur:
              run?.cost_eur != null && Number.isFinite(Number(run.cost_eur))
                ? Number(run.cost_eur)
                : undefined,
          };
        } catch {
          map[a.slug] = {
            slug: a.slug,
            label: a.label,
            hasRecentRun: false,
          };
        }
      })
    );
    setNodes(map);
  }, [company]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(id);
  }, [load]);

  function bubble(slug: string, x: number, y: number) {
    const n = nodes[slug];
    const pulse = n?.hasRecentRun ? "motion-safe:animate-pulse" : "";
    const label = (
      n?.label ??
      AGENT_ROSTER.find((entry) => entry.slug === slug)?.label ??
      slug
    ).slice(0, 10);
    return (
      <g key={slug} transform={`translate(${x},${y})`}>
        <circle
          r={26}
          className={cn(
            "fill-surface-elevated stroke-border transition-[stroke] duration-300",
            n?.hasRecentRun ? "stroke-accent stroke-[2px]" : "stroke-border",
            pulse
          )}
        />
        <text
          y={5}
          textAnchor="middle"
          className="fill-text-primary text-[9px] font-semibold"
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
        {n?.costEur != null ? (
          <text y={40} textAnchor="middle" className="fill-text-secondary text-[8px]">
            €{n.costEur.toFixed(3)}
          </text>
        ) : (
          <text y={40} textAnchor="middle" className="fill-text-secondary/70 text-[7px]">
            {n?.hasRecentRun ? "actief" : "idle"}
          </text>
        )}
      </g>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">Swarm</p>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              healthOk === null && "bg-text-secondary/40",
              healthOk === true && "bg-green-500",
              healthOk === false && "bg-red-500"
            )}
            aria-hidden
          />
          <span>
            Factory OS core{" "}
            {healthOk === null ? "…" : healthOk ? "OK" : "deels down"}
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 520 210"
        className="h-[210px] w-full"
        role="img"
        aria-label="Agent swarm diagram"
      >
        <defs>
          <linearGradient id="swarmFlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path
          d="M 260 66 L 260 92 M 260 118 L 140 148 M 260 118 L 260 148 M 260 118 L 380 148 M 260 174 L 200 188 L 320 188"
          stroke="var(--border)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 260 40 L 260 92"
          stroke="url(#swarmFlow)"
          strokeWidth="2"
          fill="none"
          className="motion-safe:animate-[pulse_3.5s_ease-in-out_infinite]"
        />
        {bubble("ceo", 260, 40)}
        {bubble("teamleader", 260, 118)}
        {bubble("intern", 140, 174)}
        {bubble("junior", 260, 174)}
        {bubble("senior", 380, 174)}
        {bubble("analyst", 200, 200)}
        {bubble("bibliothecaris", 320, 200)}
      </svg>
      <p className="mt-2 text-[10px] text-text-secondary">
        Bron: /api/health · /api/agents/[slug]/runs · 12s · klant{" "}
        <span className="font-mono">{company}</span>
      </p>
    </div>
  );
}
