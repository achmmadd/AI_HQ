"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SwarmCanvas } from "@/components/swarm-canvas";
import { AGENT_ROSTER } from "@/lib/agent-catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export default function AgentsIndexPage() {
  return (
    <AppShell title="Agenten">
      <div className="space-y-6">
        <p className="max-w-2xl text-sm text-text-secondary">
          Factory OS agenthiërarchie voor Fumero. Detailpagina&apos;s tonen de
          laatste gelogde runs (tokens, kosten, latentie, in-/outputvoorbeeld).
        </p>
        <SwarmCanvas />
        <ul className="grid gap-4 sm:grid-cols-2">
          {AGENT_ROSTER.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/agents/${a.slug}`}
                className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition hover:border-border-strong">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div>
                      <CardTitle className="text-base">{a.label}</CardTitle>
                      <p className="mt-1 text-xs text-text-secondary">
                        {a.modelHint}
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-0.5 size-5 shrink-0 text-text-secondary"
                      aria-hidden
                    />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-primary">{a.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
