"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  ChevronRight,
  FileText,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { OsBadge } from "@/components/os/os-primitives";
import { cn } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/types";

type AutomationTask = {
  task_key: string;
  title: string;
  description?: string;
  schedule: string;
  enabled: number;
};

type ContentDoc = {
  id: number;
  title?: string;
  content_type?: string;
  updated_at?: string;
};

type ActivityRun = {
  id: number;
  task_title?: string;
  status?: string;
  created_at?: string;
};

type ContextPayload = {
  brainOk: boolean;
  usageToday: { tokens: number; eur: number };
  automations: AutomationTask[];
  documents: ContentDoc[];
  runs: ActivityRun[];
};

function ContextSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("chat-os-context-section", className)}>
      <div className="chat-os-context-section__head">
        <h3 className="chat-os-context-section__title">{title}</h3>
        {action ? (
          <Link href={action.href} className="chat-os-context-section__action">
            {action.label}
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ContextSkeleton() {
  return (
    <div className="space-y-5 p-4">
      <div className="os-shimmer h-24 rounded-[var(--os-radius-lg)]" />
      <div className="os-shimmer h-20 rounded-[var(--os-radius-lg)]" />
      <div className="os-shimmer h-32 rounded-[var(--os-radius-lg)]" />
    </div>
  );
}

export function ChatOsContextPanel({
  workspace = "fumero",
  agentName = "Smokey",
  agentRole = "Shop & content agent",
  className,
}: {
  workspace?: WorkspaceId;
  agentName?: string;
  agentRole?: string;
  className?: string;
}) {
  const klant = workspace === "bokas" ? "bokas" : workspace === "fumero" ? "fumero" : "personal";
  const [data, setData] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [startRes, autoRes, contentRes, runsRes] = await Promise.all([
        fetch(`/api/home/start?klant=${encodeURIComponent(klant)}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/automation/tasks", { credentials: "include" }),
        fetch(`/api/content?klant=${encodeURIComponent(klant)}`, { credentials: "include" }),
        fetch("/api/automation/runs?limit=6", { credentials: "include" }),
      ]);

      const start = startRes.ok
        ? ((await startRes.json()) as {
            brain_ok?: boolean;
            usage_today?: { tokens: number; eur: number };
          })
        : {};
      const auto = autoRes.ok
        ? ((await autoRes.json()) as { tasks?: AutomationTask[] })
        : { tasks: [] };
      const content = contentRes.ok
        ? ((await contentRes.json()) as { posts?: ContentDoc[] })
        : { posts: [] };
      const runs = runsRes.ok
        ? ((await runsRes.json()) as { runs?: ActivityRun[] })
        : { runs: [] };

      setData({
        brainOk: start.brain_ok ?? false,
        usageToday: start.usage_today ?? { tokens: 0, eur: 0 },
        automations: (auto.tasks ?? []).filter((t) => t.enabled),
        documents: (content.posts ?? []).slice(0, 5),
        runs: runs.runs ?? [],
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [klant]);

  useEffect(() => {
    void load();
  }, [load]);

  const settingsHref =
    workspace === "bokas"
      ? "/bokas/settings/context"
      : workspace === "fumero"
        ? "/fumero/settings/context"
        : "/settings/context";
  const automationsHref =
    workspace === "fumero"
      ? "/fumero/automations"
      : workspace === "bokas"
        ? "/bokas/marketing"
        : "/cowork?tab=tasks";
  const libraryHref =
    workspace === "fumero"
      ? "/fumero/bibliotheek"
      : workspace === "bokas"
        ? "/bokas/content"
        : "/kennisbank";

  return (
    <aside
      aria-label="Context"
      className={cn("chat-os-context-panel", className)}
    >
      <div className="chat-os-context-panel__inner">
        <div className="chat-os-context-panel__header">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--os-accent)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--os-text-subtle)]">
              Context
            </span>
          </div>
        </div>

        {loading && !data ? (
          <ContextSkeleton />
        ) : (
          <div className="chat-os-context-panel__scroll scrollbar-ios">
            {/* Agent */}
            <ContextSection title="Agent">
              <div className="chat-os-agent-card os-glass">
                <div className="flex items-start gap-3">
                  <AgentAvatar
                    workspace={workspace === "personal" ? "fumero" : workspace}
                    size="md"
                    variant={
                      workspace === "fumero" || workspace === "personal"
                        ? "chat"
                        : "plain"
                    }
                    motion={
                      workspace === "fumero" || workspace === "personal"
                        ? "chat"
                        : false
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-semibold text-[var(--os-text)]">
                        {agentName}
                      </p>
                      <OsBadge variant={data?.brainOk ? "success" : "warning"}>
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            data?.brainOk ? "bg-emerald-400 os-pulse-dot" : "bg-amber-400"
                          )}
                        />
                        {data?.brainOk ? "Online" : "Idle"}
                      </OsBadge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--os-text-muted)]">{agentRole}</p>
                    {data?.usageToday ? (
                      <p className="mt-2 text-[11px] tabular-nums text-[var(--os-text-subtle)]">
                        {data.usageToday.tokens.toLocaleString("nl-NL")} tokens vandaag
                        {data.usageToday.eur > 0
                          ? ` · ~€${data.usageToday.eur.toFixed(3)}`
                          : null}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Link href={settingsHref} className="chat-os-agent-card__link">
                  <Zap className="h-3.5 w-3.5" />
                  Context & instellingen
                </Link>
              </div>
            </ContextSection>

            {/* Automations */}
            <ContextSection
              title="Automations"
              action={{ label: "Beheren", href: automationsHref }}
            >
              <div className="chat-os-context-list">
                {(data?.automations ?? []).length === 0 ? (
                  <p className="chat-os-context-empty">
                    Geen actieve automations —{" "}
                    <Link href={automationsHref} className="text-[var(--os-accent)] hover:underline">
                      instellen
                    </Link>
                  </p>
                ) : (
                  (data?.automations ?? []).slice(0, 4).map((task) => (
                    <Link
                      key={task.task_key}
                      href={automationsHref}
                      className="chat-os-context-item"
                    >
                      <span className="chat-os-context-item__icon">
                        <Workflow className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--os-text)]">
                          {task.title}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--os-text-subtle)]">
                          {task.schedule}
                        </span>
                      </span>
                      <span className="chat-os-context-item__dot chat-os-context-item__dot--active" />
                    </Link>
                  ))
                )}
              </div>
            </ContextSection>

            {/* Documents */}
            <ContextSection
              title="Documenten"
              action={{ label: "Bibliotheek", href: libraryHref }}
            >
              <div className="chat-os-context-list">
                {(data?.documents ?? []).length === 0 ? (
                  <p className="chat-os-context-empty">
                    Nog geen documenten —{" "}
                    <Link href={libraryHref} className="text-[var(--os-accent)] hover:underline">
                      uploaden
                    </Link>
                  </p>
                ) : (
                  (data?.documents ?? []).map((doc) => (
                    <Link
                      key={doc.id}
                      href={libraryHref}
                      className="chat-os-context-item"
                    >
                      <span className="chat-os-context-item__icon">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--os-text)]">
                          {doc.title ?? `Document #${doc.id}`}
                        </span>
                        {doc.updated_at ? (
                          <span className="block text-[11px] text-[var(--os-text-subtle)]">
                            {new Date(doc.updated_at).toLocaleDateString("nl-NL")}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </ContextSection>

            {/* Recent activity */}
            <ContextSection title="Recente activiteit">
              <div className="chat-os-context-list">
                {(data?.runs ?? []).length === 0 ? (
                  <p className="chat-os-context-empty">Nog geen recente runs</p>
                ) : (
                  (data?.runs ?? []).slice(0, 5).map((run) => (
                    <Link
                      key={run.id}
                      href={automationsHref}
                      className="chat-os-context-item"
                    >
                      <span className="chat-os-context-item__icon">
                        <Activity className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--os-text)]">
                          {run.task_title ?? "Automation run"}
                        </span>
                        <span className="block text-[11px] text-[var(--os-text-subtle)]">
                          {run.created_at
                            ? new Date(run.created_at).toLocaleString("nl-NL", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : run.status ?? "—"}
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </ContextSection>

            <ContextSection title="Kennisbank">
              <Link href={libraryHref} className="chat-os-knowledge-card os-glass os-glass-hover">
                <BookOpen className="h-4 w-4 text-[var(--os-accent)]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--os-text)]">
                    Doorzoekbare docs
                  </p>
                  <p className="text-[11px] text-[var(--os-text-subtle)]">
                    Teamcontext & geheugen
                  </p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 text-[var(--os-text-subtle)]" />
              </Link>
            </ContextSection>
          </div>
        )}
      </div>
    </aside>
  );
}
