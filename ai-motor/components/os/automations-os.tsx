"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Play,
  RefreshCw,
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BarChart3,
  TrendingUp,
  Plus,
  ArrowRight,
  Mail,
  Loader2,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
import { cn } from "@/lib/utils";
import {
  OsCard,
  OsMetric,
  OsSection,
  OsBadge,
} from "@/components/os/os-primitives";
import { PremiumEmptyState } from "@/components/os/premium-empty-state";
import { getAutomationFixHint } from "@/lib/fumero/automation-fix-hints";
import { shouldStudioAutoRun } from "@/lib/studio-actions";
import Link from "next/link";

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
  created_at: string;
  finished_at: string | null;
  task_title: string;
  task_key: string;
};

type EmailFlow = {
  id: number;
  title: string;
  trigger_text: string;
  tone: string;
  steps_json: string;
  status: string;
  source_prompt: string | null;
  created_at: string;
};

type FlowDraft = {
  title: string;
  trigger: string;
  tone: string;
  steps: Array<{ step: number; timing: string; subject: string; goal: string }>;
};

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

const FLOW_TEMPLATES = [
  {
    label: "Verlaten winkelwagen",
    prompt: "E-mailflow voor verlaten winkelwagen op fumero.nl: 3 stappen, warm en niet opdringerig.",
  },
  {
    label: "Review na levering",
    prompt: "Review-flow na levering: bedankmail, dan reviewverzoek na 5 dagen.",
  },
  {
    label: "Welkom nieuwe klant",
    prompt: "Welkomstflow voor nieuwe klanten: bedankje, tips en eerste bestelling aanmoedigen.",
  },
] as const;

function scheduleLabel(t: AutomationTask): string {
  if (t.schedule_kind === "weekly" && t.schedule_weekday != null) {
    return `${WEEKDAYS[t.schedule_weekday] ?? "?"} ${t.schedule_time}`;
  }
  return `Dagelijks ${t.schedule_time}`;
}

function integrationLabel(integration: string | null): string {
  if (!integration) return "AI-agent";
  const map: Record<string, string> = {
    playwright: "Shop",
    gmail: "E-mail",
    openrouter: "Smokey",
    jina: "Kennisbank",
    sqlite: "Data",
    n8n: "n8n",
  };
  return map[integration] ?? integration;
}

function runStatusVariant(status: string): "success" | "error" | "warning" | "default" {
  if (status === "success") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "default";
}

function parseFlowSteps(stepsJson: string): FlowDraft["steps"] {
  try {
    const parsed = JSON.parse(stepsJson) as FlowDraft["steps"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function OsToggle({
  enabled,
  disabled,
  onChange,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      aria-label={label}
      className={cn(
        "relative h-7 w-[46px] shrink-0 rounded-full transition-colors duration-200",
        enabled ? "bg-[var(--os-accent)]" : "bg-white/10",
        disabled && "opacity-40"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-[20px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function CreateFlowSheet({
  open,
  initialPrompt,
  autoSubmit,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialPrompt: string;
  autoSubmit: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [flowId, setFlowId] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const autoRan = useRef(false);

  const submit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Beschrijf kort wat de automation moet doen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fumero/email/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: trimmed }),
      });
      const json = (await res.json()) as {
        error?: string;
        draft?: FlowDraft;
        flow_id?: number;
      };
      if (!res.ok) throw new Error(json.error ?? "Flow maken mislukt");
      setDraft(json.draft ?? null);
      setFlowId(json.flow_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flow maken mislukt");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !autoSubmit || autoRan.current || !initialPrompt.trim()) return;
    autoRan.current = true;
    void submit(initialPrompt);
  }, [open, autoSubmit, initialPrompt, submit]);

  async function activate() {
    if (!flowId) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch("/api/fumero/email/flow/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flow_id: flowId }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Activeren mislukt");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activeren mislukt");
    } finally {
      setActivating(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flow-title"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[92vh] overflow-y-auto rounded-t-[var(--os-radius-xl)] border border-white/10 bg-[var(--os-surface-elevated)] shadow-2xl sm:max-w-lg sm:rounded-[var(--os-radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[var(--os-surface-elevated)]/95 px-5 py-4 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--os-text-subtle)]">
              Nieuwe automation
            </p>
            <h2 id="create-flow-title" className="mt-0.5 text-[17px] font-semibold tracking-tight text-[var(--os-text)]">
              E-mailflow ontwerpen
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--os-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--os-text)]"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {!draft ? (
            <>
              <p className="text-[13px] leading-relaxed text-[var(--os-text-muted)]">
                Beschrijf trigger en gewenste acties. Smokey ontwerpt een stappenplan dat je kunt activeren.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Bijv. verlaten winkelwagen: herinnering na 2 uur, korting na 24 uur…"
                className="w-full resize-none rounded-[var(--os-radius-md)] border border-[var(--os-border-strong)] bg-[var(--os-surface)] px-4 py-3 text-[14px] text-[var(--os-text)] placeholder:text-[var(--os-text-muted)] focus:border-[var(--os-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--os-accent)]/35 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex flex-wrap gap-2">
                {FLOW_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setPrompt(tpl.prompt)}
                    className="rounded-full border border-[var(--os-border-strong)] bg-[var(--os-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--os-text)] transition-colors hover:border-[var(--os-accent)]/50 hover:bg-[var(--os-accent-muted)] hover:text-[var(--os-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--os-accent)]/40"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              {error ? (
                <p role="alert" className="text-[13px] text-red-400">{error}</p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(prompt)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--os-radius-md)] bg-[var(--os-accent)] text-[14px] font-semibold text-[var(--os-accent-foreground)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_4px_14px_rgba(0,0,0,0.18)] transition-colors hover:bg-[var(--os-accent-hover)] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Ontwerp flow
              </button>
            </>
          ) : (
            <>
              <div className="rounded-[var(--os-radius-lg)] border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--os-text)]">{draft.title}</h3>
                    <p className="mt-1 text-[12px] text-[var(--os-text-muted)]">{draft.trigger}</p>
                  </div>
                  <OsBadge variant="accent">{draft.tone}</OsBadge>
                </div>
                <div className="mt-4 space-y-2">
                  {draft.steps.map((step) => (
                    <div
                      key={step.step}
                      className="flex items-start gap-3 rounded-[var(--os-radius-md)] border border-white/[0.04] px-3 py-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--os-accent-muted)] text-[11px] font-bold text-[var(--os-accent)]">
                        {step.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--os-text)]">{step.subject}</p>
                        <p className="text-[11px] text-[var(--os-text-subtle)]">
                          {step.timing} · {step.goal}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {error ? (
                <p role="alert" className="text-[13px] text-red-400">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setFlowId(null);
                  }}
                  className="flex-1 rounded-[var(--os-radius-md)] border border-white/10 px-4 py-2.5 text-[13px] font-medium text-[var(--os-text-muted)] hover:bg-white/5"
                >
                  Opnieuw
                </button>
                <button
                  type="button"
                  disabled={activating || !flowId}
                  onClick={() => void activate()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-4 py-2.5 text-[13px] font-semibold text-[var(--os-accent-foreground)] hover:bg-[var(--os-accent-hover)] disabled:opacity-50"
                >
                  {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Activeren
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AutomationsOs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [flows, setFlows] = useState<EmailFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyFlow, setBusyFlow] = useState<number | null>(null);
  const [integrationReady, setIntegrationReady] = useState(true);
  const [missingIntegrations, setMissingIntegrations] = useState<
    Array<{ label: string; required_for: string }>
  >([]);
  const [flowStats, setFlowStats] = useState<{
    total: number;
    live: number;
    draft: number;
  } | null>(null);
  const urlPrompt = searchParams.get("prompt")?.trim() ?? "";
  const urlAutoRun = shouldStudioAutoRun(searchParams, "prompt");
  const sheetOpen = createOpen || Boolean(urlPrompt);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/fumero/automations?limit=40", {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Laden mislukt");
      }
      const json = (await res.json()) as {
        tasks?: AutomationTask[];
        runs?: AutomationRun[];
        flows?: EmailFlow[];
        flow_stats?: { total: number; live: number; draft: number };
        integration_readiness?: {
          all_required_configured: boolean;
          missing: Array<{ label: string; required_for: string }>;
        };
      };
      setTasks((json.tasks ?? []).filter((t) => FUMERO_TASK_KEYS.has(t.task_key)));
      setRuns((json.runs ?? []).filter((r) => FUMERO_TASK_KEYS.has(r.task_key)));
      setFlows(json.flows ?? []);
      setFlowStats(json.flow_stats ?? null);
      setIntegrationReady(json.integration_readiness?.all_required_configured ?? true);
      setMissingIntegrations(json.integration_readiness?.missing ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const clearUrlParams = useCallback(() => {
    router.replace("/fumero/automations", { scroll: false });
  }, [router]);

  const enabledCount = useMemo(() => tasks.filter((t) => t.enabled).length, [tasks]);
  const liveFlows = flowStats?.live ?? flows.filter((f) => f.status === "live").length;
  const draftFlows = flowStats?.draft ?? flows.filter((f) => f.status === "draft").length;
  const totalFlows = flowStats?.total ?? flows.length;
  const successRuns = runs.filter((r) => r.status === "success").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 0;

  async function toggleTask(id: number, enabled: boolean) {
    setBusyTask(id);
    try {
      const res = await fetch("/api/fumero/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ task_id: id, enabled }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  async function runNow(id: number) {
    setBusyTask(id);
    try {
      const res = await fetch("/api/fumero/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ task_id: id }),
      });
      if (!res.ok) throw new Error("Uitvoeren mislukt");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uitvoeren mislukt");
    } finally {
      setBusyTask(null);
    }
  }

  async function activateFlow(flowId: number) {
    setBusyFlow(flowId);
    setError(null);
    try {
      const res = await fetch("/api/fumero/email/flow/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flow_id: flowId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Activeren mislukt");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activeren mislukt");
    } finally {
      setBusyFlow(null);
    }
  }

  function openCreate() {
    setCreateOpen(true);
  }

  if (loading) {
    return (
      <div className="os-gradient-mesh space-y-6">
        <div className="os-shimmer h-10 w-48 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="os-shimmer h-24 rounded-[var(--os-radius-lg)]" />
          ))}
        </div>
        <div className="os-shimmer h-64 rounded-[var(--os-radius-lg)]" />
      </div>
    );
  }

  return (
    <>
      <CreateFlowSheet
        key={sheetOpen ? `flow-${urlPrompt || "new"}` : "closed"}
        open={sheetOpen}
        initialPrompt={urlPrompt}
        autoSubmit={urlAutoRun}
        onClose={() => {
          setCreateOpen(false);
          if (urlPrompt) clearUrlParams();
        }}
        onCreated={() => {
          void load();
          setCreateOpen(false);
          if (urlPrompt) clearUrlParams();
        }}
      />

      <div className="os-gradient-mesh mx-auto max-w-6xl space-y-8 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-[var(--os-accent)]" />
              <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--os-text-subtle)]">
                Fumero
              </span>
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--os-text)]">
              Automatisering
            </h1>
            <p className="mt-1 max-w-lg text-[14px] leading-relaxed text-[var(--os-text-muted)]">
              Geplande taken en e-mailflows — trigger, actie en status op één plek.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-[var(--os-radius-md)]"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Vernieuwen
            </Button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-5 text-[14px] font-semibold text-[var(--os-accent-foreground)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_6px_20px_rgba(0,0,0,0.22)] transition-all hover:bg-[var(--os-accent-hover)] hover:shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_8px_24px_rgba(0,0,0,0.28)] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Nieuwe flow
            </button>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-[var(--os-radius-lg)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Opnieuw
            </Button>
          </div>
        ) : null}

        {!integrationReady && missingIntegrations.length > 0 ? (
          <div
            role="status"
            className="rounded-[var(--os-radius-lg)] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <p className="font-medium">Configuratie vereist voor live automatisering</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-amber-100/90">
              {missingIntegrations.map((m) => (
                <li key={m.label}>
                  {m.label} — {m.required_for}
                </li>
              ))}
            </ul>
            <Link
              href="/fumero/settings/context"
              className="mt-2 inline-flex text-[13px] font-medium text-[var(--os-accent)] underline-offset-2 hover:underline"
            >
              Integraties controleren
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <OsMetric
            label="Actieve taken"
            value={enabledCount}
            delta={`${tasks.length} taken`}
            icon={Zap}
            trend="up"
          />
          <OsMetric
            label="Succesrate"
            value={`${successRate}%`}
            delta={`${successRuns} geslaagd`}
            icon={TrendingUp}
            trend={successRate > 70 ? "up" : "neutral"}
          />
          <OsMetric
            label="E-mailflows actief"
            value={integrationReady ? liveFlows : 0}
            delta={`${draftFlows} concept · ${totalFlows} totaal`}
            icon={BarChart3}
            trend={liveFlows > 0 && integrationReady ? "up" : "neutral"}
          />
        </div>

        <OsSection title="E-mailflows" description="Trigger → stappen → verzending">
          {flows.length === 0 ? (
            <PremiumEmptyState
              icon={Mail}
              illustration="pulse"
              title="Nog geen e-mailflows"
              description="Beschrijf trigger en gewenste mails — Smokey ontwerpt de stappen."
            >
              <button
                type="button"
                onClick={openCreate}
                className="mt-2 inline-flex h-10 items-center gap-2 rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-5 text-[14px] font-semibold text-[var(--os-accent-foreground)]"
              >
                <Plus className="h-4 w-4" /> Nieuwe flow
              </button>
            </PremiumEmptyState>
          ) : (
            <div className="space-y-3">
              {flows.map((flow) => {
                const steps = parseFlowSteps(flow.steps_json);
                return (
                  <OsCard key={flow.id} hover className="!p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 shrink-0 text-[var(--os-accent)]" />
                          <h3 className="truncate text-[15px] font-semibold text-[var(--os-text)]">
                            {flow.title}
                          </h3>
                          <OsBadge variant={flow.status === "live" ? "success" : "default"}>
                            {flow.status === "live" ? "Live" : "Concept"}
                          </OsBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--os-text-muted)]">
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            {flow.trigger_text || "Trigger"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-[var(--os-text-subtle)]" />
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            {steps.length} {steps.length === 1 ? "stap" : "stappen"}
                          </span>
                          <span className="text-[var(--os-text-subtle)]">· {flow.tone}</span>
                        </div>
                      </div>
                      {flow.status !== "live" ? (
                        <button
                          type="button"
                          disabled={busyFlow === flow.id}
                          onClick={() => void activateFlow(flow.id)}
                          className="inline-flex items-center gap-1.5 rounded-[var(--os-radius-sm)] bg-[var(--os-accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--os-accent-foreground)] hover:bg-[var(--os-accent-hover)] disabled:opacity-40"
                        >
                          {busyFlow === flow.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          Activeren
                        </button>
                      ) : null}
                    </div>
                  </OsCard>
                );
              })}
            </div>
          )}
        </OsSection>

        {tasks.length === 0 ? (
          <PremiumEmptyState
            icon={Workflow}
            illustration="orbit"
            title="Nog geen geplande workflows"
            description="Orders, briefing en kennisbank — verschijnen zodra je shop is gekoppeld."
            action={{ label: "Vernieuwen", href: "/fumero/automations" }}
          />
        ) : (
          <OsSection title="Geplande workflows" description={`${enabledCount} van ${tasks.length} actief`}>
            <div className="grid gap-3">
              {tasks.map((task) => (
                <OsCard key={task.id} className="!p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--os-radius-md)] bg-[var(--os-hover-overlay)]">
                      <Workflow className="h-5 w-5 text-[var(--os-accent)]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-[var(--os-text)]">{task.title}</h3>
                        <OsBadge variant={task.enabled ? "success" : "default"}>
                          {task.enabled ? "Actief" : "Uit"}
                        </OsBadge>
                      </div>
                      {task.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--os-text-muted)]">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[var(--os-text-muted)]">
                          <Clock className="h-3 w-3" />
                          {scheduleLabel(task)}
                        </span>
                        <ChevronRight className="h-3 w-3 text-[var(--os-text-subtle)]" />
                        <span className="rounded-full border border-[var(--os-accent)]/20 bg-[var(--os-accent-muted)] px-2.5 py-1 font-medium text-[var(--os-accent)]">
                          {integrationLabel(task.integration)}
                        </span>
                        {task.approval_required ? (
                          <span className="text-[var(--os-text-subtle)]">· goedkeuring</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <OsToggle
                        enabled={!!task.enabled}
                        disabled={busyTask === task.id}
                        onChange={(next) => void toggleTask(task.id, next)}
                        label={task.enabled ? "Uitzetten" : "Aanzetten"}
                      />
                      <button
                        type="button"
                        disabled={busyTask === task.id || !task.enabled}
                        onClick={() => void runNow(task.id)}
                        className="inline-flex items-center gap-1.5 rounded-[var(--os-radius-sm)] border border-white/10 px-3 py-1.5 text-[12px] font-medium text-[var(--os-text)] transition-colors hover:bg-white/5 disabled:opacity-40"
                      >
                        {busyTask === task.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Run
                      </button>
                    </div>
                  </div>
                </OsCard>
              ))}
            </div>
          </OsSection>
        )}

        <OsSection title="Uitvoeringsgeschiedenis" description="Recente runs">
          <OsCard className="!p-0 divide-y divide-white/[0.04]">
            {runs.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[var(--os-text-muted)]">
                Nog geen runs. Zet een workflow aan en klik Run.
              </p>
            ) : (
              runs.slice(0, 12).map((run) => {
                const fixHint =
                  run.status === "failed" ? getAutomationFixHint(run.detail) : null;
                return (
                  <div key={run.id} className="flex items-start gap-3 px-4 py-3">
                    {run.status === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : run.status === "failed" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-[var(--os-text)]">
                          {run.task_title}
                        </p>
                        <OsBadge variant={runStatusVariant(run.status)}>{run.status}</OsBadge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--os-text-subtle)]">
                        {new Date(run.created_at).toLocaleString("nl-NL")}
                        {run.detail
                          ? ` · ${run.detail.slice(0, 80)}${run.detail.length > 80 ? "…" : ""}`
                          : ""}
                      </p>
                      {fixHint ? (
                        <Link
                          href={fixHint.href}
                          className="mt-1.5 inline-flex text-[11px] font-medium text-[var(--os-accent)] underline-offset-2 hover:underline"
                        >
                          {fixHint.label} →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </OsCard>
        </OsSection>
      </div>
    </>
  );
}
