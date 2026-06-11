"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Workflow,
  Zap,
  Activity,
  BarChart3,
  Plus,
  Terminal,
  BookOpen,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Receipt,
  UtensilsCrossed,
  TrendingUp,
} from "lucide-react";
import {
  OsCard,
  OsMetric,
  OsSection,
  OsQuickAction,
  OsActivityRow,
  OsAgentCard,
  OsBadge,
} from "@/components/os/os-primitives";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { isOnboardingDone } from "@/lib/onboarding-storage";
import type { CompanyId } from "@/lib/types";
import { MOTORSAI_WORKSPACE_LABEL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { FumeroCommandCenterTasks } from "@/components/fumero/ops/fumero-command-center-tasks";

type StartPayload = {
  brain_ok: boolean;
  dev_panel: boolean;
  brain: {
    openclaw: { configured: boolean; ok: boolean };
    executor: { configured: boolean; ok: boolean };
    openrouter: { configured: boolean };
  };
  last_conversation: { id: number; title: string; updated_at: string } | null;
  usage_today: { tokens: number; eur: number };
  integrations: Array<{ id: string; label: string; connected: boolean; hint: string }>;
  autonomy_tasks: Array<{ task_key: string; title: string; description: string; schedule: string }>;
};

function CommandCenterSkeleton({ slowLoad = false }: { slowLoad?: boolean }) {
  return (
    <div className="os-gradient-mesh min-h-full space-y-6 p-1">
      <div className="space-y-2">
        <div className="os-shimmer h-10 w-64 rounded-lg" />
        {slowLoad ? (
          <p className="text-sm text-[var(--os-text-muted)]">
            Het duurt langer dan normaal — je data wordt opgehaald…
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="os-shimmer h-28 rounded-[var(--os-radius-lg)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="os-shimmer h-64 rounded-[var(--os-radius-lg)] lg:col-span-2" />
        <div className="os-shimmer h-64 rounded-[var(--os-radius-lg)]" />
      </div>
    </div>
  );
}

export function CommandCenter({
  workspace = "personal",
}: {
  workspace?: "personal" | "fumero" | "bokas";
}) {
  const router = useRouter();
  const company = useCompanyStore((s) => s.company);
  const klant: CompanyId =
    workspace === "fumero"
      ? "fumero"
      : workspace === "bokas"
        ? "bokas"
        : company;
  const [data, setData] = useState<StartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automationCount, setAutomationCount] = useState<number | null>(null);
  const [fumeroHealth, setFumeroHealth] = useState<{
    ok: boolean;
    label: string;
    level?: string;
    checked_at?: string;
    automation_success_pct?: number | null;
  } | null>(null);

  useEffect(() => {
    if (workspace === "personal" && !isOnboardingDone()) {
      router.replace("/onboarding");
    }
  }, [router, workspace]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [startRes, autoRes, healthRes] = await Promise.all([
        fetch(`/api/home/start?klant=${encodeURIComponent(klant)}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/automation/tasks", { credentials: "include" }),
        workspace === "fumero"
          ? fetch("/api/fumero/health", { credentials: "include", cache: "no-store" })
          : Promise.resolve(null),
      ]);
      if (!startRes.ok) throw new Error("Command Center laden mislukt");
      setData((await startRes.json()) as StartPayload);
      if (autoRes.ok) {
        const auto = (await autoRes.json()) as { tasks?: Array<{ enabled: number }> };
        setAutomationCount((auto.tasks ?? []).filter((t) => t.enabled).length);
      }
      if (healthRes) {
        if (healthRes.ok) {
          const h = (await healthRes.json()) as typeof fumeroHealth;
          setFumeroHealth(h);
        } else {
          setFumeroHealth({ ok: false, label: "Storing" });
        }
      } else {
        setFumeroHealth(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [klant, workspace]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading || data) {
      setSlowLoad(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowLoad(true), 8000);
    return () => window.clearTimeout(timer);
  }, [loading, data]);

  const chatBase =
    workspace === "fumero"
      ? "/fumero/chat"
      : workspace === "bokas"
        ? "/bokas/chat"
        : "/chat";
  const settingsHref =
    workspace === "bokas"
      ? "/bokas/settings/context"
      : workspace === "fumero"
        ? "/fumero/settings/context"
        : "/settings/context";
  const workspaceEyebrow =
    workspace === "fumero"
      ? "Fumero"
      : workspace === "bokas"
        ? "Bokas"
        : MOTORSAI_WORKSPACE_LABEL;
  const chatHref = data?.last_conversation
    ? `${chatBase}?c=${data.last_conversation.id}`
    : chatBase;

  if (loading && !data) return <CommandCenterSkeleton slowLoad={slowLoad} />;

  if (error && !data) {
    return (
      <div className="os-gradient-mesh flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-[var(--os-text)]">Command Center niet beschikbaar</p>
        <p className="text-sm text-[var(--os-text-muted)]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border-strong)] px-4 py-2 text-sm hover:bg-[var(--os-hover-overlay-strong)]"
        >
          <RefreshCw className="h-4 w-4" /> Opnieuw
        </button>
      </div>
    );
  }

  const brainOk = data?.brain_ok ?? false;
  const systemOk = workspace === "fumero" && fumeroHealth ? fumeroHealth.ok : brainOk;
  const systemLabel =
    workspace === "fumero" && fumeroHealth
      ? fumeroHealth.label
      : brainOk
        ? "Systeem operationeel"
        : "Configuratie nodig";
  const systemBadgeVariant =
    workspace === "fumero" && fumeroHealth?.level === "config_required"
      ? "warning"
      : systemOk
        ? "success"
        : "warning";
  const tokensToday = data?.usage_today.tokens ?? 0;
  const tasksCount = data?.autonomy_tasks.length ?? 0;
  const connectedIntegrations = data?.integrations.filter((i) => i.connected).length ?? 0;

  return (
    <div className="os-gradient-mesh min-h-full space-y-8 pb-8">
      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--os-accent)]" />
            <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--os-text-subtle)]">
              {workspaceEyebrow}
            </span>
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--os-text)] md:text-[32px]">
            Command Center
          </h1>
          <p className="mt-1 text-[14px] text-[var(--os-text-muted)]">
            {workspace === "bokas"
              ? "Restaurant, reserveringen en team — Bas helpt je dagelijks."
              : workspace === "fumero"
                ? "Smokey, automatisering en shopactiviteit — alles op één plek."
                : "AI-agents, automatisering en activiteit — alles op één plek."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OsBadge variant={systemBadgeVariant}>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                systemOk ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            {systemLabel}
          </OsBadge>
          {workspace === "fumero" && fumeroHealth?.checked_at ? (
            <span className="hidden text-[11px] text-[var(--os-text-subtle)] lg:inline">
              Bijgewerkt{" "}
              {new Date(fumeroHealth.checked_at).toLocaleTimeString("nl-NL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--os-radius-md)] border border-[var(--os-border)] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)]"
            aria-label="Vernieuwen"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OsMetric
          label="Tokens vandaag"
          value={tokensToday.toLocaleString("nl-NL")}
          delta={data?.usage_today.eur ? `~€${data.usage_today.eur.toFixed(3)}` : undefined}
          icon={BarChart3}
        />
        <OsMetric
          label="Actieve automatiseringen"
          value={automationCount ?? tasksCount}
          delta="Geplande taken"
          icon={Workflow}
          trend="neutral"
        />
        <OsMetric
          label="Integraties"
          value={`${connectedIntegrations}/${data?.integrations.length ?? 0}`}
          delta="Verbonden"
          icon={Zap}
          trend={connectedIntegrations > 0 ? "up" : "neutral"}
        />
        <OsMetric
          label="AI Stack"
          value={brainOk ? "Online" : "Check"}
          delta={
            [
              data?.brain.openclaw.ok && "OpenClaw",
              data?.brain.executor.ok && "Executor",
              data?.brain.openrouter.configured && "OpenRouter",
            ]
              .filter(Boolean)
              .join(" · ") || "Niet geconfigureerd"
          }
          icon={Activity}
          trend={brainOk ? "up" : "down"}
        />
      </div>

      {workspace === "fumero" ? <FumeroCommandCenterTasks /> : null}

      {/* Quick actions */}
      <OsSection title="Snel starten" description="Direct aan de slag">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workspace === "bokas" ? (
            <>
              <OsQuickAction
                icon={MessageSquare}
                label="Chat met Bas"
                description="Reserveringen, menu of team"
                href={chatHref}
                accent
              />
              <OsQuickAction
                icon={UtensilsCrossed}
                label="Operaties"
                description="Reserveringen en weekplanning"
                href="/bokas/operations"
              />
              <OsQuickAction
                icon={Receipt}
                label="Boekhouding"
                description="Bonnen en administratie"
                href="/bokas/bonnen"
              />
              <OsQuickAction
                icon={TrendingUp}
                label="Marketing"
                description="Posts en campagnes"
                href="/bokas/marketing"
              />
            </>
          ) : (
            <>
              <OsQuickAction
                icon={MessageSquare}
                label="Nieuwe chat"
                description="Stel een vraag aan je AI-agent"
                href={chatHref}
                accent
              />
              <OsQuickAction
                icon={Plus}
                label="Bouwen"
                description="App, chatbot of pagina maken"
                href={workspace === "fumero" ? "/fumero/bouwen" : "/builder"}
              />
              <OsQuickAction
                icon={Workflow}
                label="Automatisering"
                description="Geplande taken beheren"
                href={workspace === "fumero" ? "/fumero/automations" : "/cowork?tab=tasks"}
              />
              <OsQuickAction
                icon={BookOpen}
                label="Kennisbank"
                description="Documenten en geheugen"
                href="/kennisbank"
              />
            </>
          )}
        </div>
      </OsSection>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active agents */}
        <OsSection
          title="Actieve agents"
          description="Je AI-team"
          action={{ label: "Alle agents", href: "/agents" }}
          className="lg:col-span-1"
        >
          <div className="space-y-3">
            <OsAgentCard
              name={
                workspace === "fumero"
                  ? "Smokey"
                  : workspace === "bokas"
                    ? "Bas"
                    : "Motor"
              }
              role={
                workspace === "fumero"
                  ? "Shop & content agent"
                  : workspace === "bokas"
                    ? "Restaurant & operations agent"
                    : "Hoofdagent · code & automatisering"
              }
              status={brainOk ? "online" : "idle"}
              tasksToday={Math.round(tokensToday / 1000)}
              href={chatBase}
            />
            {workspace === "personal" ? (
              <>
                <OsAgentCard name="Max" role="Research & briefing" status="online" href="/fumero/chat" />
                <OsAgentCard name="Bas" role="Restaurant operations" status="idle" href="/bokas/chat" />
              </>
            ) : workspace === "bokas" ? (
              <OsAgentCard
                name="Operaties"
                role="Reserveringen, menu & personeel"
                status="online"
                href="/bokas/operations"
              />
            ) : null}
          </div>
        </OsSection>

        {/* Recent activity */}
        <OsSection
          title="Recente activiteit"
          description="Gesprekken en taken"
          action={{ label: "Open chat", href: chatBase }}
          className="lg:col-span-2"
        >
          <OsCard className="divide-y divide-white/[0.04] !p-0">
            {data?.last_conversation ? (
              <OsActivityRow
                title={data.last_conversation.title}
                meta={`Laatste gesprek · ${new Date(data.last_conversation.updated_at).toLocaleDateString("nl-NL")}`}
                status="active"
                href={chatHref}
              />
            ) : (
              <div className="px-4 py-6 text-center text-[13px] text-[var(--os-text-muted)]">
                Nog geen gesprekken —{" "}
                <Link href={chatBase} className="text-[var(--os-accent)] hover:underline">
                  start je eerste chat
                </Link>
              </div>
            )}
            {(data?.autonomy_tasks ?? []).slice(0, 4).map((t) => (
              <OsActivityRow
                key={t.task_key}
                title={t.title}
                meta={t.schedule}
                status="pending"
                href={
                  workspace === "fumero"
                    ? "/fumero/automations"
                    : workspace === "bokas"
                      ? "/bokas/marketing"
                      : "/cowork?tab=tasks"
                }
              />
            ))}
          </OsCard>
        </OsSection>
      </div>

      {/* System health + integrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OsSection title="Systeemstatus" description="Infrastructuur en stack">
          <OsCard>
            <div className="space-y-3">
              {[
                { label: "OpenClaw", ok: data?.brain.openclaw.ok, hint: "Agent runtime" },
                { label: "NUC Executor", ok: data?.brain.executor.ok, hint: "Lokale uitvoering" },
                { label: "OpenRouter", ok: data?.brain.openrouter.configured, hint: "Model gateway" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--os-text)]">{item.label}</p>
                    <p className="text-[11px] text-[var(--os-text-subtle)]">{item.hint}</p>
                  </div>
                  <OsBadge variant={item.ok ? "success" : "error"}>
                    {item.ok ? "OK" : "Offline"}
                  </OsBadge>
                </div>
              ))}
            </div>
          </OsCard>
        </OsSection>

        <OsSection title="Integraties" description="Koppelingen en data">
          <OsCard>
            <div className="space-y-2">
              {(data?.integrations ?? []).map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--os-radius-sm)] px-2 py-1.5 hover:bg-[var(--os-hover-overlay)]"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--os-text)]">{i.label}</p>
                    <p className="truncate text-[11px] text-[var(--os-text-subtle)]">{i.hint}</p>
                  </div>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      i.connected ? "bg-emerald-400" : "bg-red-400/70"
                    )}
                  />
                </div>
              ))}
            </div>
            <Link
              href={settingsHref}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--os-accent)] hover:underline"
            >
              Instellingen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </OsCard>
        </OsSection>
      </div>

      {data?.dev_panel ? (
        <OsSection title="Developer">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dev"
              className="inline-flex items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border)] px-4 py-2 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)]"
            >
              <Terminal className="h-4 w-4" /> Dev panel
            </Link>
            <Link
              href="/kosten/usage"
              className="inline-flex items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border)] px-4 py-2 text-[13px] text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)]"
            >
              <BarChart3 className="h-4 w-4" /> Usage
            </Link>
          </div>
        </OsSection>
      ) : null}
    </div>
  );
}
