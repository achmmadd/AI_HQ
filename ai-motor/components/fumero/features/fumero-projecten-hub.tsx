"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Hammer,
  MessageSquare,
  Users,
} from "lucide-react";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
import { FumeroStatusBadge } from "@/components/fumero/ops/fumero-status-badge";
import { Button } from "@/components/ui/button";
import {
  APP_TYPE_LABEL,
  appLiveUrl,
  formatRelativeDate,
  toolGarageStatus,
  toolLiveUrl,
  toolTypeLabel,
  toolVersionLabel,
  type ProjectenGarageApp,
  type ProjectenGarageTool,
  type ProjectenMyWorkItem,
} from "@/lib/fumero/projecten-shared";
import {
  filterTeamWorkItems,
  resolveProjectRuntime,
} from "@/lib/fumero/project-runtime";

type TabId = "website" | "widget" | "team";

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-[var(--fumero-border)]" />
      <div className="mb-4 h-3 w-1/3 rounded bg-[var(--fumero-border)]" />
      <div className="h-8 w-full rounded-lg bg-[var(--fumero-surface-muted)]" />
    </div>
  );
}

function EmptyTabState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-6 py-14 text-center">
      <p className="text-sm font-medium text-[var(--fumero-text-muted)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-[var(--fumero-text-muted)]">{description}</p>
      <Button
        asChild
        className="mt-4 rounded-lg bg-[var(--fumero-accent)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
      >
        <Link href="/fumero/bouwen">
          <Hammer className="mr-1.5 h-4 w-4" />
          Start in Bouwen
        </Link>
      </Button>
    </div>
  );
}

function ProjectCard({
  title,
  meta,
  status,
  updatedAt,
  buildHref,
  liveHref,
}: {
  title: string;
  meta: string;
  status: "published" | "concept" | "archived";
  updatedAt: string;
  buildHref: string;
  liveHref: string | null;
}) {
  return (
    <article className="fumero-card-flat flex flex-col rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--fumero-text)]">{title}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--fumero-text-muted)]">{meta}</p>
          </div>
          <FumeroStatusBadge status={status} />
        </div>
        <p className="mb-4 text-xs text-[var(--fumero-text-muted)]">
          Laatste edit · {formatRelativeDate(updatedAt)}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="h-8 flex-1 rounded-lg bg-[var(--fumero-accent)] text-xs shadow-none hover:bg-[var(--fumero-accent-hover)]"
          >
            <Link href={buildHref}>
              <MessageSquare className="mr-1 h-3 w-3" />
              Verder bouwen
            </Link>
          </Button>
          {liveHref ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg border-[var(--fumero-border)] text-xs"
            >
              <a href={liveHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                Openen
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FumeroProjectenHub() {
  const [tab, setTab] = useState<TabId>("website");
  const [tools, setTools] = useState<ProjectenGarageTool[]>([]);
  const [apps, setApps] = useState<ProjectenGarageApp[]>([]);
  const [workItems, setWorkItems] = useState<ProjectenMyWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [toolsRes, appsRes, workRes] = await Promise.all([
        fetch("/api/fumero/tools", { credentials: "include" }),
        fetch("/api/apps", { credentials: "include" }),
        fetch("/api/my-work?klant=fumero", { credentials: "include" }),
      ]);
      const toolsJson = (await toolsRes.json()) as {
        error?: string;
        tools?: ProjectenGarageTool[];
      };
      if (!toolsRes.ok) throw new Error(toolsJson.error || "Tools laden mislukt");
      const appsJson = (await appsRes.json()) as {
        error?: string;
        apps?: ProjectenGarageApp[];
      };
      if (!appsRes.ok) throw new Error(appsJson.error || "Apps laden mislukt");
      const workJson = (await workRes.json()) as {
        items?: ProjectenMyWorkItem[];
      };
      setTools(toolsJson.tools ?? []);
      setApps(appsJson.apps ?? []);
      setWorkItems(workJson.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Projecten laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const widgetTools = tools.filter(
    (t) => !t.archived && (t.deploy_type === "widget" || t.deploy_type === "customer")
  );

  const { tools: teamTools, apps: teamApps } = filterTeamWorkItems(tools, apps);

  const websiteProjects = workItems.filter(
    (w) => w.kind === "project" || w.kind === "linked" || w.kind === "app"
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "website", label: "Website" },
    { id: "widget", label: "Widget" },
    { id: "team", label: "Team" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <FumeroPageHeader
        title="Projecten"
        description="Widgets, websites en team-apps — alles wat je met Max hebt gebouwd."
        actionLabel="Nieuw bouwen"
        actionHref="/fumero/bouwen"
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-3 py-2 text-sm text-[var(--fumero-danger-fg)]">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-0.5 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text)] shadow-sm"
                  : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

      {tab === "website" ? (
        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : websiteProjects.length === 0 && apps.length === 0 ? (
            <EmptyTabState
              title="Nog geen websites of apps"
              description="Beschrijf in Bouwen wat je wilt — bijvoorbeeld een voorraad-app of klantenlijst."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {websiteProjects.map((item) => {
                const buildHref = item.build_project_id
                  ? resolveProjectRuntime({
                      kind: "project",
                      projectId: item.build_project_id,
                      slug: item.slug,
                    }).buildHref
                  : resolveProjectRuntime({
                      kind: "app",
                      app: { slug: item.slug, type: "internal" },
                    }).buildHref;
                const liveHref = `${appLiveUrl({
                  id: item.custom_app_id ?? 0,
                  slug: item.slug,
                  naam: item.title,
                  type: "internal",
                  version: 1,
                  status: (item.status as ProjectenGarageApp["status"]) ?? "concept",
                  updated_at: item.updated_at,
                })}`;
                const status =
                  item.status === "published" || item.status === "live"
                    ? "published"
                    : item.status === "archived"
                      ? "archived"
                      : "concept";
                return (
                  <ProjectCard
                    key={`${item.kind}-${item.slug}`}
                    title={item.title}
                    meta={item.stack ? `${item.stack} · website` : "Website / app"}
                    status={status}
                    updatedAt={item.updated_at}
                    buildHref={buildHref}
                    liveHref={liveHref}
                  />
                );
              })}
              {apps
                .filter(
                  (a) =>
                    a.type === "internal" &&
                    !websiteProjects.some((w) => w.slug === a.slug)
                )
                .map((app) => (
                  <ProjectCard
                    key={`app-${app.id}`}
                    title={app.naam}
                    meta={`${APP_TYPE_LABEL[app.type]} · v${app.version}`}
                    status={app.status}
                    updatedAt={app.updated_at}
                    buildHref={resolveProjectRuntime({ kind: "app", app }).buildHref}
                    liveHref={appLiveUrl(app)}
                  />
                ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "widget" ? (
        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : widgetTools.length === 0 ? (
            <EmptyTabState
              title="Nog geen widgets"
              description="Maak een chat-widget, keuzehulp of klantpagina — alles wat je op fumero.nl embed."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {widgetTools.map((tool) => (
                <ProjectCard
                  key={tool.id}
                  title={tool.name}
                  meta={`${toolTypeLabel(tool.deploy_type)} · ${toolVersionLabel(tool)}`}
                  status={toolGarageStatus(tool)}
                  updatedAt={tool.updated_at}
                  buildHref={resolveProjectRuntime({ kind: "tool", tool }).buildHref}
                  liveHref={toolLiveUrl(tool)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "team" ? (
        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : teamTools.length === 0 && teamApps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-6 py-16 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]">
                <Users className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-[var(--fumero-text-muted)]">
                Nog geen team-apps
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--fumero-text-muted)]">
                Interne apps voor je team verschijnen hier. Bouw ze nu al via Bouwen —
                ze staan intussen onder Website.
              </p>
              <Button
                asChild
                variant="secondary"
                className="mt-5 rounded-lg border-[var(--fumero-border)] text-xs"
              >
                <Link href="/fumero/bouwen">Start in Bouwen</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teamTools.map((tool) => (
                <ProjectCard
                  key={`team-tool-${tool.id}`}
                  title={tool.name}
                  meta={`Intern · ${toolVersionLabel(tool)}`}
                  status={toolGarageStatus(tool)}
                  updatedAt={tool.updated_at}
                  buildHref={resolveProjectRuntime({ kind: "tool", tool }).buildHref}
                  liveHref={toolLiveUrl(tool)}
                />
              ))}
              {teamApps.map((app) => (
                <ProjectCard
                  key={`team-app-${app.id}`}
                  title={app.naam}
                  meta={`${APP_TYPE_LABEL[app.type]} · v${app.version}`}
                  status={app.status}
                  updatedAt={app.updated_at}
                  buildHref={resolveProjectRuntime({ kind: "app", app }).buildHref}
                  liveHref={appLiveUrl(app)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
