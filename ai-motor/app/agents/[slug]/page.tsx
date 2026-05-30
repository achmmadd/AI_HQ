"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { AgentRosterEntry } from "@/lib/agent-catalog";
import { AGENT_ROSTER } from "@/lib/agent-catalog";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type RunRow = {
  id: number;
  klant: string | null;
  afdeling: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  cost_eur: number | null;
  duration_ms: number | null;
  success: boolean;
  input_preview: string | null;
  output_preview: string | null;
  created_at: string | null;
};

export default function AgentDetailPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const company = useCompanyStore((s) => s.company);

  const [agent, setAgent] = useState<AgentRosterEntry | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(slug)}/runs?limit=20&klant=${company}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as {
        error?: string;
        agent?: AgentRosterEntry;
        runs?: RunRow[];
      };
      if (!res.ok) {
        setErr(data.error || "Laden mislukt");
        setAgent(null);
        setRuns([]);
        return;
      }
      setAgent(data.agent ?? null);
      setRuns(data.runs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [slug, company]);

  useEffect(() => {
    void load();
  }, [load]);

  const rosterAgent = AGENT_ROSTER.find(
    (a) => a.slug.toLowerCase() === slug.toLowerCase()
  );

  return (
    <AppShell title={rosterAgent ? `Agent: ${rosterAgent.label}` : "Agent"}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/agents" className="inline-flex items-center gap-1">
              <ArrowLeft className="size-4" aria-hidden />
              Alle agenten
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            Vernieuwen
          </Button>
        </div>

        {rosterAgent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hiërarchie &amp; rol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="flex flex-wrap gap-2" aria-label="Agenthiërarchie">
                {AGENT_ROSTER.map((a, i) => (
                  <li key={a.slug} className="flex items-center gap-2">
                    {i > 0 ? (
                      <span className="text-text-secondary" aria-hidden>
                        →
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        a.slug === rosterAgent.slug
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-text-secondary"
                      )}
                    >
                      {a.label}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-text-secondary">{rosterAgent.description}</p>
              <p>
                <span className="font-medium text-text-primary">Model: </span>
                {rosterAgent.modelHint}
              </p>
              {rosterAgent.systemPromptVersion != null && (
                <div className="rounded-md border border-border bg-surface-elevated p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    System prompt (read-only)
                  </p>
                  <p className="mt-1 text-text-primary">
                    Versie {rosterAgent.systemPromptVersion}
                    {rosterAgent.systemPromptSummary
                      ? ` — ${rosterAgent.systemPromptSummary}`
                      : ""}
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    Volledige instructies staan in{" "}
                    <code className="rounded bg-muted px-1">lib/content-analyst.ts</code>{" "}
                    (Analyst) resp. n8n / Dify voor uitvoerende agenten.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Runs laden…
          </p>
        )}
        {err && (
          <p className="text-sm text-destructive" role="alert">
            {err}
          </p>
        )}

        {!loading && agent && runs.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nog geen gelogde runs voor <strong>{agent.label}</strong> met klant{" "}
            <strong>{company}</strong>. Genereer content of schakel de Analyst
            in om usage te zien.
          </p>
        )}

        {runs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Laatste runs ({runs.length})
            </h2>
            <ul className="space-y-3">
              {runs.map((r) => (
                <li key={r.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <CardTitle className="text-sm font-medium">
                          {r.created_at || "—"}
                        </CardTitle>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            r.success ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {r.success ? "OK" : "Fout"}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Model {r.model ?? "—"} ·{" "}
                        {(r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)}{" "}
                        tokens ·{" "}
                        {r.cost_eur != null
                          ? `€${Number(r.cost_eur).toFixed(4)}`
                          : "—"}{" "}
                        · {r.duration_ms ?? "—"} ms
                        {r.afdeling ? ` · ${r.afdeling}` : ""}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {r.input_preview && (
                        <div>
                          <p className="text-xs font-medium text-text-secondary">
                            Input (fragment)
                          </p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                            {r.input_preview}
                          </pre>
                        </div>
                      )}
                      {r.output_preview && (
                        <div>
                          <p className="text-xs font-medium text-text-secondary">
                            Output (fragment)
                          </p>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                            {r.output_preview}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
