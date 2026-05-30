"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FumeroAutomationListSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
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
};

type AutomationRun = {
  id: number;
  task_id: number;
  status: string;
  trigger: string;
  detail: string | null;
  created_at: string;
  finished_at: string | null;
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

export function FumeroAutomationsPanel() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/automation/tasks", { credentials: "include" }),
        fetch("/api/automation/runs?limit=40", { credentials: "include" }),
      ]);
      if (!tRes.ok) throw new Error(await tRes.text());
      if (!rRes.ok) throw new Error(await rRes.text());
      const tJson = (await tRes.json()) as { tasks?: AutomationTask[] };
      const rJson = (await rRes.json()) as { runs?: AutomationRun[] };
      setTasks(
        (tJson.tasks ?? []).filter((t) => FUMERO_TASK_KEYS.has(t.task_key))
      );
      setRuns(
        (rJson.runs ?? []).filter((r) => FUMERO_TASK_KEYS.has(r.task_key))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledCount = useMemo(
    () => tasks.filter((t) => t.enabled).length,
    [tasks]
  );

  async function toggleTask(id: number, enabled: boolean) {
    setBusyTask(id);
    setError(null);
    try {
      const res = await fetch("/api/fumero/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ task_id: id, enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  async function runNow(id: number) {
    setBusyTask(id);
    setError(null);
    try {
      const res = await fetch("/api/fumero/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ task_id: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uitvoeren mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">Automations</h1>
          <p className="mt-1 text-sm text-[#737373]">
            Geplande taken voor orders, briefing, e-mail en rapportages — aan/uit en handmatig
            starten.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="rounded-lg"
          onClick={() => void load()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Vernieuwen
        </Button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <FumeroAutomationListSkeleton count={4} />
      ) : (
        <>
          {tasks.length > 0 ? (
            <p className="mb-4 text-sm text-[#737373]">
              {enabledCount} van {tasks.length} taken actief
            </p>
          ) : null}

          {tasks.length === 0 ? (
            <div className="mb-8 rounded-xl border border-dashed border-[#E5E5E5] bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#525252]">Nog geen automations</p>
              <p className="mt-1 text-xs text-[#737373]">
                Geplande taken voor orders, briefing en e-mail verschijnen hier zodra ze
                geconfigureerd zijn.
              </p>
            </div>
          ) : (
          <ul className="mb-8 space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-xl border border-[#E5E5E5] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#171717]">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 text-sm text-[#737373]">{task.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-[#a3a3a3]">
                      {scheduleLabel(task)}
                      {task.approval_required ? " · goedkeuring vereist" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busyTask === task.id}
                      className={cn(
                        "relative h-7 w-12 rounded-full transition-colors",
                        task.enabled ? "bg-[#69C400]" : "bg-[#E5E5E5]"
                      )}
                      onClick={() => void toggleTask(task.id, !task.enabled)}
                      aria-label={task.enabled ? "Uitzetten" : "Aanzetten"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                          task.enabled ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-lg"
                      disabled={!task.enabled || busyTask === task.id}
                      onClick={() => void runNow(task.id)}
                    >
                      {busyTask === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Nu runnen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          )}

          <h2 className="mb-3 text-sm font-semibold text-[#171717]">Recente runs</h2>
          {runs.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E5] bg-white px-6 py-8 text-center">
              <p className="text-sm text-[#737373]">Nog geen runs uitgevoerd.</p>
              <p className="mt-1 text-xs text-[#a3a3a3]">
                Schakel een taak in en klik op Nu runnen om te starten.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E5E5] rounded-xl border border-[#E5E5E5] bg-white">
              {runs.slice(0, 15).map((run) => (
                <li key={run.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#171717]">{run.task_title}</span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        run.status === "success"
                          ? "bg-[rgba(105,196,0,0.12)] text-[#3d7a00]"
                          : run.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-[#F5F5F5] text-[#737373]"
                      )}
                    >
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#a3a3a3]">
                    {new Date(run.created_at).toLocaleString("nl-NL")}
                    {run.detail ? ` · ${run.detail.slice(0, 80)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
