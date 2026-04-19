"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AutomationTask = {
  id: number;
  task_key: string;
  title: string;
  description: string | null;
  schedule_kind: string;
  schedule_time: string;
  schedule_weekday: number | null;
  enabled: number;
  approval_required: number;
  integration: string | null;
};

type AutomationRun = {
  id: number;
  task_id: number;
  status: string;
  trigger: string;
  detail: string | null;
  error_message: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  task_title: string;
  task_key: string;
};

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

function scheduleLabel(t: AutomationTask): string {
  if (t.schedule_kind === "weekly" && t.schedule_weekday != null) {
    return `${WEEKDAYS[t.schedule_weekday] ?? "?"} ${t.schedule_time}`;
  }
  return `Dagelijks ${t.schedule_time}`;
}

export default function AdminAutomationPage() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [busyRun, setBusyRun] = useState<number | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/automation/tasks", { credentials: "include" }),
        fetch("/api/automation/runs?limit=80", { credentials: "include" }),
      ]);
      if (!tRes.ok) throw new Error(await tRes.text());
      if (!rRes.ok) throw new Error(await rRes.text());
      const tJson = (await tRes.json()) as { tasks?: AutomationTask[] };
      const rJson = (await rRes.json()) as { runs?: AutomationRun[] };
      setTasks(tJson.tasks ?? []);
      setRuns(rJson.runs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchTask(
    id: number,
    patch: Partial<{
      enabled: boolean;
      approval_required: boolean;
      schedule_time: string;
    }>
  ) {
    setBusyTask(id);
    setErr(null);
    try {
      const res = await fetch(`/api/automation/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  async function runNow(taskId: number) {
    setBusyTask(taskId);
    setErr(null);
    try {
      const res = await fetch("/api/automation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Run mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  async function approveRun(runId: number) {
    setBusyRun(runId);
    setErr(null);
    try {
      const res = await fetch(`/api/automation/runs/${runId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Goedkeuren mislukt");
    } finally {
      setBusyRun(null);
    }
  }

  async function rejectRun(runId: number) {
    setBusyRun(runId);
    setErr(null);
    try {
      const res = await fetch(`/api/automation/runs/${runId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Afwijzen mislukt");
    } finally {
      setBusyRun(null);
    }
  }

  return (
    <AppShell title="Automation (ZZP)">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Entrepreneur automation agent
          </h2>
          <p className="text-sm text-text-secondary">
            Startpunt: geplande taken (dagelijks / wekelijks), logs, en
            goedkeuring vóór uitvoering. Uitvoering is nu stub (Playwright,
            Gmail, Drive volgen). Cron:{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              POST /api/cron/automation
            </code>{" "}
            met{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              x-cron-secret
            </code>
            . Optioneel Slack:{" "}
            <code className="rounded bg-surface-elevated px-1 text-xs">
              AUTOMATION_SLACK_WEBHOOK_URL
            </code>
            .
          </p>
        </div>

        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}

        <section>
          <h3 className="mb-3 text-sm font-semibold">Taken</h3>
          {loading && (
            <p className="text-sm text-text-secondary">Laden…</p>
          )}
          <ul className="space-y-3">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                      {t.integration ?? "—"} · {t.task_key}
                    </p>
                    <h4 className="mt-0.5 font-medium text-text-primary">
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {t.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-text-secondary">
                      {scheduleLabel(t)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={t.enabled === 1}
                        disabled={busyTask === t.id}
                        onChange={(e) =>
                          void patchTask(t.id, { enabled: e.target.checked })
                        }
                      />
                      Actief
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={t.approval_required === 1}
                        disabled={busyTask === t.id}
                        onChange={(e) =>
                          void patchTask(t.id, {
                            approval_required: e.target.checked,
                          })
                        }
                      />
                      Goedkeuring nodig
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="time"
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                        value={t.schedule_time.length === 5 ? t.schedule_time : `${t.schedule_time}:00`.slice(0, 5)}
                        disabled={busyTask === t.id}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) void patchTask(t.id, { schedule_time: v });
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyTask === t.id}
                        onClick={() => void runNow(t.id)}
                      >
                        Nu uitvoeren
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Log / runs</h3>
          <ul className="space-y-3">
            {runs.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium uppercase tracking-wide",
                        r.status === "success" && "text-green-600",
                        r.status === "failed" && "text-error",
                        r.status === "pending_approval" && "text-amber-500",
                        r.status === "running" && "text-accent"
                      )}
                    >
                      {r.status} · {r.trigger}
                    </p>
                    <p className="mt-0.5 font-medium text-text-primary">
                      {r.task_title}
                    </p>
                    <p className="mt-1 text-[11px] text-text-secondary">
                      #{r.id} · {r.created_at}
                    </p>
                    {r.detail && (
                      <p className="mt-2 text-xs text-text-secondary">
                        {r.detail}
                      </p>
                    )}
                    {r.error_message && (
                      <p className="mt-1 text-xs text-error">{r.error_message}</p>
                    )}
                  </div>
                  {r.status === "pending_approval" && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={busyRun === r.id}
                        onClick={() => void approveRun(r.id)}
                      >
                        Goedkeuren
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        disabled={busyRun === r.id}
                        onClick={() => void rejectRun(r.id)}
                      >
                        Afwijzen
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!loading && runs.length === 0 && (
            <p className="text-sm text-text-secondary">Nog geen runs.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
