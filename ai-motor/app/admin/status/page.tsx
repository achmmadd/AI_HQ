"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

type Dep = {
  ok: boolean;
  http_status: number;
  latency_ms: number;
  host: string;
  error?: string;
};

type StatusPayload = {
  service?: string;
  nodeEnv?: string;
  appVersion?: string | null;
  processUptimeSec?: number;
  checksMs?: number;
  overallOk?: boolean;
  dependencies?: { n8n?: Dep; dify?: Dep; qdrant?: Dep; ollama?: Dep };
  integrations?: { n8n_rest_api_configured?: boolean };
  error?: string;
};

function DepCard({ title, dep }: { title: string; dep: Dep | undefined }) {
  if (!dep) {
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated/50 p-4 text-sm text-text-secondary">
        Geen data voor {title}.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-text-primary">{title}</h4>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase",
            dep.ok
              ? "bg-green-500/15 text-green-700 dark:text-green-400"
              : "bg-error/15 text-error"
          )}
        >
          {dep.ok ? "ok" : "probleem"}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-text-secondary">
        <div className="flex justify-between gap-2">
          <dt>Host</dt>
          <dd className="font-mono text-text-primary">{dep.host}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>HTTP</dt>
          <dd>{dep.http_status || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Latency</dt>
          <dd>{dep.latency_ms} ms</dd>
        </div>
      </dl>
      {dep.error && (
        <p className="mt-2 text-xs text-error">{dep.error}</p>
      )}
    </div>
  );
}

export default function AdminStatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/status", { credentials: "include" });
      const json = (await res.json()) as StatusPayload;
      if (!res.ok) {
        setErr(json.error ?? (await res.text()));
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell title="Systeemstatus">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Read-only dev-status
          </h2>
          <p className="text-sm text-text-secondary">
            Zelfde checks als de publieke{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              /api/health
            </code>
            , plus proces-metadata. Geen terminal, geen commando’s op de
            server.
          </p>
          <p className="text-xs text-text-secondary">
            Voor n8n-workflownamen:{" "}
            <Link
              href="/admin/n8n"
              className="font-medium text-accent hover:underline"
            >
              n8n workflows
            </Link>
            .
          </p>
        </div>

        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}

        {loading && (
          <p className="text-sm text-text-secondary">Laden…</p>
        )}

        {!loading && data && (
          <>
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                data.overallOk
                  ? "border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
              )}
            >
              <strong className="font-semibold">
                {data.overallOk
                  ? "Alle dependency-checks slagen."
                  : "Er is minstens één dependency-check die faalt."}
              </strong>
            </div>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-elevated/50 p-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Proces
                </h3>
                <dl className="mt-3 space-y-1 text-xs text-text-secondary">
                  <div className="flex justify-between gap-2">
                    <dt>Service</dt>
                    <dd className="font-mono text-text-primary">
                      {data.service}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>NODE_ENV</dt>
                    <dd>{data.nodeEnv}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Uptime (Node)</dt>
                    <dd>{data.processUptimeSec ?? "—"} s</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Checks duur</dt>
                    <dd>{data.checksMs ?? "—"} ms</dd>
                  </div>
                  {data.appVersion && (
                    <div className="flex justify-between gap-2">
                      <dt>Versie</dt>
                      <dd>{data.appVersion}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-2xl border border-border bg-surface-elevated/50 p-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Integraties (vlaggen)
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-text-secondary">
                  <li className="flex justify-between gap-2">
                    <span>n8n REST API-key gezet</span>
                    <span
                      className={cn(
                        "font-medium",
                        data.integrations?.n8n_rest_api_configured
                          ? "text-green-600 dark:text-green-400"
                          : "text-text-secondary"
                      )}
                    >
                      {data.integrations?.n8n_rest_api_configured
                        ? "ja"
                        : "nee"}
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Dependencies</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DepCard title="n8n" dep={data.dependencies?.n8n} />
                <DepCard title="Dify" dep={data.dependencies?.dify} />
                <DepCard title="Qdrant" dep={data.dependencies?.qdrant} />
                <DepCard title="Ollama" dep={data.dependencies?.ollama} />
              </div>
            </section>

            <p className="text-center">
              <button
                type="button"
                onClick={() => void load()}
                className="text-sm font-medium text-accent hover:underline"
              >
                Vernieuwen
              </button>
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
