"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Play, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentApiRun = {
  id: number;
  task_key: string;
  input_prompt: string | null;
  status: string;
  detail: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

export default function AgentRunsAdminPage() {
  const [runs, setRuns] = useState<AgentApiRun[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/run", { credentials: "include" });
    const data = (await res.json()) as {
      runs?: AgentApiRun[];
      task_keys?: string[];
    };
    setRuns(data.runs ?? []);
    setKeys(data.task_keys ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAgent = async () => {
    if (!task.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        detail?: string;
        error?: string;
        task_key?: string;
      };
      if (!res.ok) {
        setErr(data.error || (await res.text()));
        return;
      }
      setLastResult(
        `${data.task_key}: ${data.success ? "OK" : "mislukt"} — ${data.detail ?? ""}`
      );
      setTask("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runKey = async (task_key: string) => {
    setBusy(true);
    setErr(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_key }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        detail?: string;
        error?: string;
        task_key?: string;
      };
      if (!res.ok) {
        setErr(data.error || (await res.text()));
        return;
      }
      setLastResult(
        `${data.task_key}: ${data.success ? "OK" : "mislukt"} — ${data.detail ?? ""}`
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Agent (Playwright)">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Agent API
            </h2>
            <p className="text-sm text-text-secondary">
              Voert bestaande automation-taken direct uit (Playwright, SMTP,
              Qdrant, Dify). Geen aparte Python-browser-agent — zelfde code als{" "}
              <code className="rounded bg-surface-elevated px-1 text-xs">
                /admin/automation
              </code>
              . POST{" "}
              <code className="rounded bg-surface-elevated px-1 text-xs">
                /api/agent/run
              </code>{" "}
              met{" "}
              <code className="rounded bg-surface-elevated px-1 text-xs">
                {"{ \"task\": \"check fumero orders\" }"}
              </code>{" "}
              of{" "}
              <code className="rounded bg-surface-elevated px-1 text-xs">
                task_key
              </code>
              .
            </p>
          </div>
        </div>

        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}
        {lastResult && (
          <p className="rounded-xl border border-border bg-surface-elevated/50 px-3 py-2 text-sm text-text-primary">
            {lastResult}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt → taak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder='Bijv. "Check Fumero orders vandaag" of "Stuur openstaande facturen"'
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={3}
              disabled={busy}
              className="rounded-2xl"
            />
            <Button
              type="button"
              className="w-full gap-2 rounded-2xl"
              disabled={busy || !task.trim()}
              onClick={() => void runAgent()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Bezig…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Uitvoeren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">
            Snel — expliciete task_key
          </p>
          <div className="flex flex-wrap gap-2">
            {keys.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl text-xs"
                disabled={busy}
                onClick={() => void runKey(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent (agent_api_runs)</h3>
          <ul className="space-y-2">
            {runs.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-surface-elevated/40 px-3 py-2 text-xs"
              >
                <span
                  className={cn(
                    "font-medium",
                    r.status === "success" && "text-green-600",
                    r.status === "failed" && "text-error"
                  )}
                >
                  #{r.id} · {r.task_key} · {r.status}
                </span>
                {r.input_prompt && (
                  <p className="mt-1 text-text-secondary line-clamp-2">
                    {r.input_prompt}
                  </p>
                )}
                {r.detail && (
                  <p className="mt-1 text-text-secondary line-clamp-3">
                    {r.detail}
                  </p>
                )}
                {r.error_message && (
                  <p className="mt-1 text-error">{r.error_message}</p>
                )}
                <p className="mt-1 text-[10px] text-text-secondary">
                  {r.created_at}
                  {r.finished_at ? ` → ${r.finished_at}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {runs.length === 0 && (
            <p className="text-sm text-text-secondary">Nog geen runs.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
