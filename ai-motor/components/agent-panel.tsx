"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AgentRunRow = {
  id: number;
  task_key: string;
  status: string;
  detail: string | null;
  error_message: string | null;
  input_prompt: string | null;
  created_at: string;
  finished_at: string | null;
};

type AgentStepRow = {
  id: number;
  run_id: number;
  step_index: number;
  label: string;
  detail: string | null;
  created_at: string;
};

const DEFAULT_IFRAME =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_COMPUTER_USE_VIEWER_URL?.trim()
    ? process.env.NEXT_PUBLIC_COMPUTER_USE_VIEWER_URL.trim()
    : "about:blank";

type AgentLiveDetail = {
  debuggerFullscreenUrl?: string;
  sessionId?: string;
};

export function AgentPanel() {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [iframeUrl, setIframeUrl] = useState(DEFAULT_IFRAME);
  const [routingNote, setRoutingNote] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [shotLoading, setShotLoading] = useState(false);
  const [shotHint, setShotHint] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStepRow[]>([]);
  const [browserbaseConfigured, setBrowserbaseConfigured] = useState(false);
  const [browserbaseSessionInput, setBrowserbaseSessionInput] = useState("");
  const [browserbaseBusy, setBrowserbaseBusy] = useState(false);
  const [browserbaseHint, setBrowserbaseHint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<AgentLiveDetail>;
      const d = ce.detail;
      if (d?.debuggerFullscreenUrl?.trim()) {
        setIframeUrl(d.debuggerFullscreenUrl.trim());
      }
      if (d?.sessionId?.trim()) {
        setBrowserbaseSessionInput(d.sessionId.trim());
      }
    };
    window.addEventListener(
      "agent-live-view",
      handler as EventListener,
    );
    return () =>
      window.removeEventListener(
        "agent-live-view",
        handler as EventListener,
      );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/computer-use", { credentials: "include" });
        const d = (await res.json()) as {
          viewerUrl?: string | null;
          agentChatRouting?: "explicit" | "computer_use" | "factory";
          computerUseMisconfigured?: boolean;
          browserbaseConfigured?: boolean;
        };
        if (typeof d.browserbaseConfigured === "boolean") {
          setBrowserbaseConfigured(d.browserbaseConfigured);
        }
        if (typeof d.viewerUrl === "string" && d.viewerUrl.trim()) {
          setIframeUrl(d.viewerUrl.trim());
        }

        const r = d.agentChatRouting ?? "factory";
        if (r === "explicit") {
          setRoutingNote("Agent-chat gebruikt je eigen webhook (N8N_AGENT_WEBHOOK of gelijkwaardige env).");
        } else if (r === "computer_use") {
          setRoutingNote("Agent-chat gebruikt COMPUTER_USE_URL.");
        } else {
          let line =
            "Agent-chat gebruikt de Factory-webhook met agent_mode aan — dit is de standaard-route en ondersteunde ‘god mode’.";
          if (d.computerUseMisconfigured) {
            line +=
              " COMPUTER_USE_URL wijst naar een kale API-root en wordt voor chat genegeerd; zet hier een echte n8n-webhook (`/webhook/...`).";
          }
          setRoutingNote(line);
        }
      } catch {
        setRoutingNote(null);
      }
    })();
  }, []);

  const loadBrowserbaseLiveView = async (body: Record<string, unknown>) => {
    setBrowserbaseBusy(true);
    setBrowserbaseHint(null);
    try {
      const res = await fetch("/api/agent/browserbase/live-view", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        error?: string;
        detail?: string;
        sessionId?: string;
        debuggerFullscreenUrl?: string | null;
      };
      if (!res.ok) {
        throw new Error(
          [j.error, j.detail].filter(Boolean).join(" — ") || `HTTP ${res.status}`,
        );
      }
      if (typeof j.sessionId === "string") {
        setBrowserbaseSessionInput(j.sessionId);
      }
      if (j.debuggerFullscreenUrl && typeof j.debuggerFullscreenUrl === "string") {
        setIframeUrl(j.debuggerFullscreenUrl);
        setBrowserbaseHint(null);
      } else if (j.error || j.detail) {
        setBrowserbaseHint(
          typeof j.detail === "string"
            ? j.detail
            : typeof j.error === "string"
              ? j.error
              : "Live view volgt zo — even wachten en opnieuw proberen.",
        );
      }
    } catch (e) {
      setBrowserbaseHint(
        e instanceof Error ? e.message : "Kon live view niet openen.",
      );
    } finally {
      setBrowserbaseBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/run", { credentials: "include" });
      const d = (await res.json()) as { runs?: AgentRunRow[] };
      const list = Array.isArray(d.runs) ? d.runs.slice(0, 40) : [];
      setRuns(list);
      setSelectedId((prev) => {
        if (prev != null && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const boot = window.setTimeout(() => {
      if (!alive) return;
      void load();
    }, 0);
    const iv = window.setInterval(() => {
      void load();
    }, 8000);
    return () => {
      alive = false;
      window.clearTimeout(boot);
      window.clearInterval(iv);
    };
  }, [load]);

  const selected = runs.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    let alive = true;
    if (selectedId == null) {
      const z = window.setTimeout(() => {
        if (!alive) return;
        setSteps([]);
      }, 0);
      return () => {
        alive = false;
        window.clearTimeout(z);
      };
    }
    const loadSteps = () => {
      void fetch(`/api/agent/steps?run_id=${selectedId}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const list = (d as { steps?: AgentStepRow[] }).steps;
          setSteps(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          if (!alive) return;
          setSteps([]);
        });
    };
    loadSteps();
    const tid = window.setInterval(loadSteps, 4000);
    return () => {
      alive = false;
      window.clearInterval(tid);
    };
  }, [selectedId]);

  const refreshScreenshot = async () => {
    setShotLoading(true);
    setShotHint(null);
    try {
      const res = await fetch("/api/agent/screenshot", {
        credentials: "include",
      });
      const j = (await res.json()) as {
        screenshot_base64?: string | null;
        configured?: boolean;
        error?: string;
        hint?: string;
      };
      if (j.screenshot_base64) {
        setScreenshot(j.screenshot_base64);
        setShotHint(null);
      } else {
        setScreenshot(null);
        setShotHint(
          j.hint ||
            (!j.configured
              ? "Screenshot is niet geconfigureerd."
              : j.error || "Geen afbeelding ontvangen."),
        );
      }
    } catch (e) {
      setScreenshot(null);
      setShotHint(e instanceof Error ? e.message : "Screenshot mislukt");
    } finally {
      setShotLoading(false);
    }
  };

  return (
    <aside
      className="flex h-full max-w-full shrink-0 flex-col border-border bg-surface max-lg:min-h-[min(480px,65dvh)] w-full lg:w-[min(400px,38vw)] lg:border-l lg:min-h-0"
      aria-label="Agent zijpaneel"
    >
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-[13px] font-medium text-text-primary">Agent</p>
        {routingNote ? (
          <p className="mt-0.5 text-[11px] leading-snug text-text-secondary">
            {routingNote}
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="screen" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 h-9 shrink-0 justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="screen"
            className="rounded-lg px-3 text-xs data-[state=active]:bg-surface-elevated"
          >
            Scherm
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-lg px-3 text-xs data-[state=active]:bg-surface-elevated"
          >
            Activiteit
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="screen"
          className="mt-0 flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 data-[state=inactive]:hidden"
        >
          <label className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">
            URL
          </label>
          <Input
            value={iframeUrl}
            onChange={(e) => setIframeUrl(e.target.value)}
            className="mb-2 h-8 rounded-lg text-xs"
          />
          {browserbaseConfigured ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Input
                value={browserbaseSessionInput}
                onChange={(e) => setBrowserbaseSessionInput(e.target.value)}
                placeholder="Sessie-id"
                className="h-8 min-w-0 flex-1 rounded-lg text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 rounded-lg px-2 text-xs"
                disabled={browserbaseBusy || !browserbaseSessionInput.trim()}
                onClick={() =>
                  void loadBrowserbaseLiveView({
                    sessionId: browserbaseSessionInput.trim(),
                  })
                }
              >
                Open
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 rounded-lg px-2 text-xs"
                disabled={browserbaseBusy}
                onClick={() => void loadBrowserbaseLiveView({ create: true })}
              >
                Nieuwe sessie
              </Button>
            </div>
          ) : null}
          {browserbaseHint ? (
            <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-400">
              {browserbaseHint}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-black/[0.15] dark:bg-black/30">
            <iframe
              title="Agent scherm"
              src={iframeUrl}
              className="h-full min-h-[200px] w-full"
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="clipboard-read; clipboard-write"
            />
          </div>
          <p className="mt-2 text-[11px] text-text-secondary">
            <a
              href={iframeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              Open in nieuw tabblad
            </a>
            {iframeUrl === "about:blank" ? (
              <span className="ml-1 opacity-80">
                — stel een viewer-URL in of start een sessie.
              </span>
            ) : null}
          </p>
        </TabsContent>

        <TabsContent
          value="activity"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 pt-2 data-[state=inactive]:hidden"
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 w-fit rounded-lg text-xs"
            disabled={shotLoading}
            onClick={() => void refreshScreenshot()}
          >
            {shotLoading ? "Laden…" : "Screenshot"}
          </Button>
          {shotHint ? (
            <p className="text-[11px] text-text-secondary">{shotHint}</p>
          ) : null}
          {screenshot ? (
            <div className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="Agent screenshot"
                className="max-h-[160px] w-full object-contain"
              />
            </div>
          ) : null}

          <ScrollArea className="min-h-[120px] flex-1 rounded-lg border border-border">
            <div className="p-2">
              {runs.length === 0 ? (
                <p className="text-[12px] text-text-secondary">
                  Nog geen runs. Events van n8n verschijnen hier als die zijn
                  gekoppeld.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {runs.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          "w-full rounded-lg border border-border px-2 py-1.5 text-left text-xs transition-colors",
                          selectedId === r.id
                            ? "bg-surface-elevated ring-1 ring-accent/30"
                            : "hover:bg-surface-elevated/60",
                        )}
                      >
                        <span className="font-mono text-[10px] text-text-secondary">
                          #{r.id}
                        </span>{" "}
                        <span className="font-medium">{r.task_key}</span>{" "}
                        <span
                          className={cn(
                            "ml-1 rounded px-1 text-[10px] uppercase",
                            r.status === "success" && "bg-green-500/15 text-green-700",
                            r.status === "failed" && "bg-red-500/15 text-red-700",
                            r.status === "running" &&
                              "bg-amber-500/15 text-amber-800",
                          )}
                        >
                          {r.status}
                        </span>
                        {r.detail ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">
                            {r.detail}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          {selectedId != null && (
            <div className="rounded-lg border border-border bg-surface/50 p-2">
              <p className="mb-1 text-[10px] font-medium text-text-secondary">
                Stappen
              </p>
              {steps.length === 0 ? (
                <p className="text-[11px] text-text-secondary">
                  Geen stappen voor deze run.
                </p>
              ) : (
                <ol className="list-decimal space-y-1 pl-4 text-[11px] text-text-secondary">
                  {steps.map((s) => (
                    <li key={s.id} className="break-words">
                      <span className="text-text-primary">{s.label}</span>
                      {s.detail ? (
                        <span className="mt-0.5 block whitespace-pre-wrap opacity-90">
                          {s.detail}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
              {selected?.error_message ? (
                <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
                  {selected.error_message}
                </p>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
