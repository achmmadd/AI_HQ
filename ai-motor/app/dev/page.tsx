"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DevTerminal } from "@/components/dev-terminal";
import { DevDeployPanel } from "@/components/dev-deploy-panel";

type Dependency = {
  ok?: boolean;
  host?: string;
  latency_ms?: number;
  http_status?: number;
};

type HealthJson = {
  ok?: boolean;
  dependencies?: Record<string, Dependency>;
};

type ExtendedStatus = {
  dependencies?: Record<string, Dependency>;
  bookkeeping?: {
    ok: boolean;
    pending_approvals?: number;
    retry_queue?: number;
    error?: string;
  };
  odoo?: {
    configured: boolean;
    ok: boolean;
    http_status?: number;
    host?: string;
    error?: string;
  };
  pm2?: {
    out_log_exists: boolean;
    pid_file_exists: boolean;
    out_log_path?: string | null;
    pid_path?: string | null;
  };
  overallOk?: boolean;
};

type LogJson = {
  file?: string;
  path?: string;
  total?: number;
  lines?: string[];
  error?: string;
};

type DbStats = {
  db_path: string;
  db_size_mb: number;
  tables: Record<string, number>;
  latest_backup: { path: string; created_at: string; size_mb: number } | null;
};

type EnvCheck = {
  keys: Record<string, boolean>;
  node: string;
  node_env: string;
  app_version: string | null;
};

type IntegrationReadiness = {
  agent?: {
    computer_use_url_configured?: boolean;
    agent_mode_routes_to_dedicated_webhook?: boolean;
    viewer_url_configured?: boolean;
    screenshot_url_configured?: boolean;
    agent_stream_ingest_configured?: boolean;
    sample_webhook_pathname?: string | null;
  };
  memory?: {
    qdrant_url_configured?: boolean;
    ollama_url_configured?: boolean;
    anthropic_api_key_configured?: boolean;
    motor_memory_collection?: string;
  };
  flags?: { agent_mode_question_uses_factory_webhook?: boolean };
  dify_builder_configured?: boolean;
  deploy_configured?: boolean;
  missing_recommended?: string[];
  notes?: string[];
};

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        ok ? "bg-green-500" : "bg-red-500"
      )}
    />
  );
}

function ServiceLine({
  name,
  ok,
  meta,
}: {
  name: string;
  ok: boolean;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/35 px-3 py-2 text-sm">
      <span className="font-medium text-text-primary">{name}</span>
      <span className="flex items-center gap-2 text-xs text-text-secondary">
        {meta}
        <Dot ok={ok} />
      </span>
    </div>
  );
}

export default function DevPage() {
  const [health, setHealth] = useState<HealthJson | null>(null);
  const [ext, setExt] = useState<ExtendedStatus | null>(null);
  const [logs, setLogs] = useState<LogJson | null>(null);
  const [logFile, setLogFile] = useState("ai-motor-out");
  const [logFilter, setLogFilter] = useState("");
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [envCheck, setEnvCheck] = useState<EnvCheck | null>(null);
  const [readiness, setReadiness] = useState<IntegrationReadiness | null>(null);
  const [restartMsg, setRestartMsg] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [hRes, sRes, lRes, dRes, eRes, rRes] = await Promise.all([
      fetch("/api/health", { credentials: "include" }),
      fetch("/api/admin/status?extended=1", { credentials: "include" }),
      fetch(`/api/admin/logs?file=${encodeURIComponent(logFile)}&lines=100`, {
        credentials: "include",
      }),
      fetch("/api/admin/db-stats", { credentials: "include" }),
      fetch("/api/admin/env-check", { credentials: "include" }),
      fetch("/api/admin/integration-readiness", { credentials: "include" }),
    ]);
    setHealth((await hRes.json()) as HealthJson);
    setExt((await sRes.json()) as ExtendedStatus);
    setLogs((await lRes.json()) as LogJson);
    setDbStats((await dRes.json()) as DbStats);
    setEnvCheck((await eRes.json()) as EnvCheck);
    setReadiness((await rRes.json()) as IntegrationReadiness);
  }, [logFile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetch(`/api/admin/logs?file=${encodeURIComponent(logFile)}&lines=100`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((j) => setLogs(j as LogJson))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [logFile]);

  const deploy = async () => {
    setBusy(true);
    setRestartMsg(null);
    try {
      const res = await fetch("/api/admin/restart", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        detail?: string;
        error?: string;
      };
      setRestartMsg(res.ok ? j.detail ?? "OK" : j.error ?? res.statusText);
    } catch (e) {
      setRestartMsg(e instanceof Error ? e.message : "Fout");
    } finally {
      setBusy(false);
    }
  };

  const backupNow = async () => {
    setBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as {
        success?: boolean;
        path?: string;
        size_mb?: number;
        error?: string;
      };
      setBackupMsg(
        res.ok && j.success
          ? `Backup klaar: ${j.path} (${j.size_mb ?? 0} MB)`
          : j.error ?? res.statusText
      );
      await load();
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : "Backup mislukt");
    } finally {
      setBusy(false);
    }
  };

  const deps = ext?.dependencies ?? health?.dependencies ?? {};
  const filteredLines = useMemo(() => {
    const lines = logs?.lines ?? [];
    const q = logFilter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => line.toLowerCase().includes(q));
  }, [logs?.lines, logFilter]);

  return (
    <AppShell title="Dev panel">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-text-secondary">
            Operatorpaneel — terminal voor .env, pm2, npm op de NUC. Overige
            tabs: status, logs, backup.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={() => void load()}
            >
              Vernieuwen
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={busy}
              onClick={() => void deploy()}
            >
              {busy ? "Bezig..." : "Restart ai-motor"}
            </Button>
          </div>
        </div>

        {(restartMsg || backupMsg) && (
          <div className="rounded-xl border border-border bg-surface-elevated/40 px-3 py-2 text-sm text-text-primary">
            {restartMsg || backupMsg}
          </div>
        )}

        <Tabs defaultValue="terminal" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="env">Omgeving</TabsTrigger>
            <TabsTrigger value="actions">Acties</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NUC-terminal</CardTitle>
                <p className="text-[12px] text-text-secondary">
                  Bash op de server — API-keys in .env.local, pm2, openclaw, git
                </p>
              </CardHeader>
              <CardContent>
                <DevTerminal />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Core services</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(deps).map(([name, dep]) => (
                    <ServiceLine
                      key={name}
                      name={name}
                      ok={!!dep.ok}
                      meta={`${dep.host ?? "-"} · ${dep.latency_ms ?? "?"}ms`}
                    />
                  ))}
                  <div className="pt-2 text-sm">
                    Totaal:{" "}
                    <span className="font-medium">
                      {health?.ok || ext?.overallOk ? "OK" : "niet OK"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Integraties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ServiceLine
                    name="Bookkeeping-bot"
                    ok={!!ext?.bookkeeping?.ok}
                    meta={
                      ext?.bookkeeping
                        ? `${ext.bookkeeping.pending_approvals ?? 0} pending · ${ext.bookkeeping.retry_queue ?? 0} retry`
                        : "laden"
                    }
                  />
                  <ServiceLine
                    name="Odoo"
                    ok={!!ext?.odoo?.ok}
                    meta={
                      ext?.odoo?.configured
                        ? `${ext.odoo.host ?? "-"} · HTTP ${ext.odoo.http_status ?? "?"}`
                        : "niet geconfigureerd"
                    }
                  />
                  <ServiceLine
                    name="PM2"
                    ok={!!ext?.pm2?.pid_file_exists}
                    meta={ext?.pm2?.pid_path ? "pid gevonden" : "pid ontbreekt"}
                  />
                  {ext?.bookkeeping?.error && (
                    <p className="text-xs text-error">{ext.bookkeeping.error}</p>
                  )}
                  {ext?.odoo?.error && (
                    <p className="text-xs text-error">{ext.odoo.error}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Live logs</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={logFile}
                    onChange={(e) => setLogFile(e.target.value)}
                    className="h-9 rounded-xl border border-border bg-surface px-3 text-sm"
                  >
                    <option value="ai-motor-out">ai-motor-out</option>
                    <option value="ai-motor-error">ai-motor-error</option>
                  </select>
                  <Input
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    placeholder="Filter regels..."
                    className="h-9 w-48 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-xl"
                    onClick={() => void load()}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logs?.error && <p className="mb-2 text-sm text-error">{logs.error}</p>}
                <p className="mb-2 break-all text-xs text-text-secondary">
                  {logs?.path ?? "Geen logbestand"} · totaal {logs?.total ?? 0} regels
                </p>
                <pre className="max-h-[560px] overflow-auto rounded-xl border border-border bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-green-100">
                  {filteredLines.join("\n") || "Geen logregels."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">SQLite</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="break-all text-text-secondary">{dbStats?.db_path ?? "-"}</p>
                  <p>
                    Grootte:{" "}
                    <span className="font-medium">{dbStats?.db_size_mb ?? 0} MB</span>
                  </p>
                  <p className="break-all text-text-secondary">
                    Laatste backup:{" "}
                    {dbStats?.latest_backup
                      ? `${dbStats.latest_backup.created_at} · ${dbStats.latest_backup.size_mb} MB`
                      : "geen backup gevonden"}
                  </p>
                  <Button
                    type="button"
                    className="w-full rounded-xl"
                    disabled={busy}
                    onClick={() => void backupNow()}
                  >
                    Backup nu
                  </Button>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Tabellen</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(dbStats?.tables ?? {}).map(([table, count]) => (
                    <div
                      key={table}
                      className="flex justify-between rounded-xl border border-border bg-surface-elevated/35 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-text-secondary">
                        {table}
                      </span>
                      <span className="font-medium tabular-nums">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="env">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Env keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(envCheck?.keys ?? {}).map(([key, present]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated/35 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs">{key}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          present
                            ? "bg-green-500/15 text-green-600"
                            : "bg-red-500/15 text-red-600"
                        )}
                      >
                        {present ? "gezet" : "ontbreekt"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-secondary">
                  Node {envCheck?.node ?? "-"} · env {envCheck?.node_env ?? "-"} ·
                  versie {envCheck?.app_version ?? "niet gezet"}
                </p>

                <div className="rounded-xl border border-border bg-surface-elevated/25 p-3">
                  <p className="mb-2 text-xs font-medium text-text-primary">
                    Integratie-readiness (geen secret-waarden)
                  </p>
                  {readiness?.agent && (
                    <ul className="mb-2 list-none space-y-1 p-0">
                      <li>
                        <ServiceLine
                          name="COMPUTER_USE_URL"
                          ok={Boolean(readiness.agent.computer_use_url_configured)}
                          meta="Agent webhook"
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="AGENT_STREAM_SECRET + POST /api/agent/events"
                          ok={Boolean(readiness.agent.agent_stream_ingest_configured)}
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="COMPUTER_USE_SCREENSHOT_URL"
                          ok={Boolean(readiness.agent.screenshot_url_configured)}
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="COMPUTER_USE_VIEWER_URL"
                          ok={Boolean(readiness.agent.viewer_url_configured)}
                        />
                      </li>
                    </ul>
                  )}
                  {readiness?.memory && (
                    <ul className="mb-2 list-none space-y-1 p-0">
                      <li>
                        <ServiceLine
                          name="QDRANT_URL"
                          ok={Boolean(readiness.memory.qdrant_url_configured)}
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="OLLAMA_URL (embeddings)"
                          ok={Boolean(readiness.memory.ollama_url_configured)}
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="ANTHROPIC_API_KEY (geheugen-ingest)"
                          ok={Boolean(readiness.memory.anthropic_api_key_configured)}
                        />
                      </li>
                    </ul>
                  )}
                  {(readiness?.dify_builder_configured !== undefined ||
                    readiness?.deploy_configured !== undefined) && (
                    <ul className="mb-2 list-none space-y-1 p-0">
                      <li>
                        <ServiceLine
                          name="Dify keys (intelligent HTML builder)"
                          ok={Boolean(readiness?.dify_builder_configured)}
                        />
                      </li>
                      <li>
                        <ServiceLine
                          name="GITHUB_TOKEN + VERCEL_TOKEN (artifact Deploy)"
                          ok={Boolean(readiness?.deploy_configured)}
                        />
                      </li>
                    </ul>
                  )}
                  {readiness?.missing_recommended &&
                    readiness.missing_recommended.length > 0 && (
                      <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <p className="text-[11px] font-medium text-text-primary">
                          Env/API nog invullen
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-text-secondary">
                          {readiness.missing_recommended.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {readiness?.notes && readiness.notes.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-800/90 dark:text-amber-400/90">
                      {readiness.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Restart</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    className="w-full rounded-xl"
                    disabled={busy}
                    onClick={() => void deploy()}
                  >
                    Restart ai-motor
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Backup</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    className="w-full rounded-xl"
                    disabled={busy}
                    onClick={() => void backupNow()}
                  >
                    Export SQLite backup
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-xl"
                    onClick={() => void load()}
                  >
                    Health check
                  </Button>
                </CardContent>
              </Card>
              <DevDeployPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
