"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Copy,
  Database,
  ExternalLink,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
} from "lucide-react";
import { FumeroAppDataModal } from "@/components/fumero/features/fumero-app-data-modal";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
import { FumeroStatusBadge } from "@/components/fumero/ops/fumero-status-badge";
import { Button } from "@/components/ui/button";
import { deployTypeLabel, type FumeroDeployType } from "@/lib/fumero/tool-templates";
import { showFumeroToast } from "@/lib/fumero/fumero-toast";

type GarageTool = {
  id: number;
  name: string;
  slug: string;
  deploy_type: FumeroDeployType;
  archived: boolean;
  published_version: number | null;
  concept_version: number | null;
  version_count: number;
  stats_views: number;
  stats_interactions: number;
  updated_at: string;
  embed_code?: string;
  internal_url?: string;
};

type GarageApp = {
  id: number;
  slug: string;
  naam: string;
  type: "widget" | "internal" | "customer";
  version: number;
  status: "concept" | "published" | "archived";
  updated_at: string;
  row_count?: number;
  db_schema?: string | null;
};

const TYPE_BADGE: Record<GarageApp["type"], string> = {
  widget: "bg-[var(--fumero-border)] text-[var(--fumero-text-muted)]",
  internal: "bg-blue-50 text-blue-700",
  customer: "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)]",
};

const TYPE_LABEL: Record<GarageApp["type"], string> = {
  widget: "Widget",
  internal: "Intern",
  customer: "Klant",
};

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function toolPreviewUrl(tool: GarageTool): string | null {
  if (tool.archived) return null;
  if (tool.deploy_type === "customer") return `/embed/fumero/app/${tool.slug}`;
  if (tool.deploy_type === "internal") return `/apps/${tool.slug}`;
  if (tool.deploy_type === "widget") return `/embed/fumero/widget/${tool.slug}`;
  return null;
}

function appPreviewUrl(app: GarageApp): string {
  if (app.type === "customer") return `/embed/fumero/app/${app.slug}`;
  return `/apps/${app.slug}?preview=1`;
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-[var(--fumero-border)]" />
      <div className="mb-4 h-3 w-1/3 rounded bg-[var(--fumero-border)]" />
      <div className="mb-2 h-3 w-full rounded bg-[var(--fumero-surface-muted)]" />
      <div className="h-8 w-full rounded-lg bg-[var(--fumero-surface-muted)]" />
    </div>
  );
}

export function FumeroToolsGarage({
  title = "Apps & garage",
  description = "Gebouwde widgets, tools en full-stack apps. Alles bouw en bewerk je via Max in chat.",
}: {
  title?: string;
  description?: string;
} = {}) {
  const [garageTools, setGarageTools] = useState<GarageTool[]>([]);
  const [garageApps, setGarageApps] = useState<GarageApp[]>([]);
  const [error, setError] = useState("");
  const [loadingGarage, setLoadingGarage] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [viewingApp, setViewingApp] = useState<GarageApp | null>(null);

  const loadGarage = useCallback(async () => {
    setLoadingGarage(true);
    setError("");
    try {
      const [toolsRes, appsRes] = await Promise.all([
        fetch("/api/fumero/tools", { credentials: "include" }),
        fetch("/api/apps", { credentials: "include" }),
      ]);
      const toolsJson = (await toolsRes.json()) as { error?: string; tools?: GarageTool[] };
      if (!toolsRes.ok) throw new Error(toolsJson.error || "Tools laden mislukt");
      setGarageTools(toolsJson.tools ?? []);

      const appsJson = (await appsRes.json()) as { error?: string; apps?: GarageApp[] };
      if (!appsRes.ok) throw new Error(appsJson.error || "Apps laden mislukt");
      setGarageApps(appsJson.apps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Garage laden mislukt");
    } finally {
      setLoadingGarage(false);
    }
  }, []);

  useEffect(() => {
    void loadGarage();
  }, [loadGarage]);

  const archive = async (id: number) => {
    if (!confirm("Tool archiveren? Live versie gaat offline.")) return;
    setError("");
    try {
      const res = await fetch(`/api/fumero/tools/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Archiveren mislukt");
      await loadGarage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archiveren mislukt");
    }
  };

  const garageStatus = (t: GarageTool): "published" | "concept" | "archived" => {
    if (t.archived) return "archived";
    if (t.published_version) return "published";
    return "concept";
  };

  const versionLabel = (t: GarageTool) => {
    const parts: string[] = [];
    if (t.published_version) parts.push(`v${t.published_version}`);
    else if (t.concept_version) parts.push(`v${t.concept_version} concept`);
    return parts.join(" · ") || "v1";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <FumeroPageHeader title={title} description={description} />

      {error ? (
        <p className="mb-4 rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-3 py-2 text-sm text-[var(--fumero-danger-fg)]">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "cards"
                ? "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text)] shadow-sm"
                : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kaarten
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text)] shadow-sm"
                : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Tabel
          </button>
        </div>
        <Button
          asChild
          className="rounded-lg bg-[var(--fumero-accent)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
        >
          <Link href="/fumero/bouwen">
            <Plus className="mr-1.5 h-4 w-4" />
            Nieuw in chat (Bouwen)
          </Link>
        </Button>
      </div>

      {/* Tools section */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--fumero-text)]">Tools & widgets</h2>
          {!loadingGarage && garageTools.length > 0 ? (
            <span className="text-xs text-[var(--fumero-text-muted)]">{garageTools.length} projecten</span>
          ) : null}
        </div>

        {loadingGarage ? (
          viewMode === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-8 text-center text-sm text-[var(--fumero-text-muted)]">
              Laden…
            </div>
          )
        ) : garageTools.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-6 py-12 text-center">
            <p className="text-sm font-medium text-[var(--fumero-text-muted)]">Nog geen tools gebouwd</p>
            <p className="mt-1 text-xs text-[var(--fumero-text-muted)]">
              Open chat en zeg bv. &quot;maak een chat widget&quot;.
            </p>
            <Button
              asChild
              className="mt-4 rounded-lg bg-[var(--fumero-accent)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
            >
              <Link href="/fumero/bouwen">Start in Bouwen</Link>
            </Button>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {garageTools.map((tool) => {
              const preview = toolPreviewUrl(tool);
              const status = garageStatus(tool);
              return (
                <article
                  key={tool.id}
                  className={`fumero-card-flat group flex flex-col rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] ${
                    tool.archived ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--fumero-text)]">
                          {tool.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[var(--fumero-text-muted)]">
                          {deployTypeLabel(tool.deploy_type)}
                        </p>
                      </div>
                      <FumeroStatusBadge status={status} />
                    </div>
                    <dl className="mb-4 space-y-1 text-xs text-[var(--fumero-text-muted)]">
                      <div className="flex justify-between">
                        <dt>Versie</dt>
                        <dd className="tabular-nums font-medium text-[var(--fumero-text-muted)]">
                          {versionLabel(tool)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Laatste edit</dt>
                        <dd>{formatRelativeDate(tool.updated_at)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Weergaven / interacties</dt>
                        <dd className="tabular-nums">
                          {tool.stats_views} / {tool.stats_interactions}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-2">
                      {!tool.archived ? (
                        <Button
                          asChild
                          size="sm"
                          className="h-8 flex-1 rounded-lg bg-[var(--fumero-accent)] text-xs shadow-none hover:bg-[var(--fumero-accent-hover)]"
                        >
                          <Link href={`/fumero/bouwen?tool=${tool.id}`}>
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Bewerk
                          </Link>
                        </Button>
                      ) : null}
                      {preview ? (
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-lg border-[var(--fumero-border)] text-xs"
                        >
                          <a href={preview} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Preview
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!tool.archived ? (
                    <div className="flex border-t border-[var(--fumero-border)] px-2 py-1.5">
                      {(tool.embed_code || tool.internal_url) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-md text-[11px] text-[var(--fumero-text-muted)]"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(tool.embed_code || tool.internal_url || "")
                              .then(() => showFumeroToast("Embed-code gekopieerd"))
                              .catch(() =>
                                showFumeroToast("Kopiëren mislukt", "error")
                              );
                          }}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Embed kopiëren
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 rounded-md text-[11px] text-[var(--fumero-text-muted)] hover:text-[var(--fumero-destructive)]"
                        onClick={() => void archive(tool.id)}
                      >
                        <Archive className="mr-1 h-3 w-3" />
                        Archiveer
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] text-left text-xs font-medium text-[var(--fumero-text-muted)]">
                  <th className="px-4 py-2">Naam</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Versie</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Stats</th>
                  <th className="px-4 py-2 text-right">Acties</th>
                </tr>
              </thead>
              <tbody>
                {garageTools.map((tool) => (
                  <tr
                    key={tool.id}
                    className={`border-b border-[var(--fumero-border)] last:border-0 ${
                      tool.archived ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{tool.name}</td>
                    <td className="px-4 py-2 text-[var(--fumero-text-muted)]">
                      {deployTypeLabel(tool.deploy_type)}
                    </td>
                    <td className="px-4 py-2 text-[var(--fumero-text-muted)]">{versionLabel(tool)}</td>
                    <td className="px-4 py-2">
                      <FumeroStatusBadge status={garageStatus(tool)} />
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[var(--fumero-text-muted)]">
                      {tool.stats_views} / {tool.stats_interactions}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!tool.archived ? (
                        <Link
                          href={`/fumero/bouwen?tool=${tool.id}`}
                          className="text-xs text-[var(--fumero-accent)] hover:underline"
                        >
                          Bewerk
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Full-stack apps section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--fumero-text)]">Full-stack apps</h2>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg border-[var(--fumero-border)] text-xs"
          >
            <Link href="/fumero/bouwen?q=maak%20een%20volledige%20app%20voor%20voorraad">
              Nieuwe app in Bouwen
            </Link>
          </Button>
        </div>

        {loadingGarage ? (
          viewMode === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : null
        ) : garageApps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-6 py-10 text-center">
            <p className="text-sm font-medium text-[var(--fumero-text-muted)]">Nog geen full-stack apps</p>
            <p className="mt-1 max-w-md mx-auto text-xs text-[var(--fumero-text-muted)]">
              Zeg in chat: &quot;maak een volledige app voor voorraad&quot; of &quot;bouw een
              klantenlijst app&quot;.
            </p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {garageApps.map((app) => (
              <article
                key={app.id}
                className="group flex flex-col rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[var(--fumero-text)]">
                        {app.naam}
                      </h3>
                      <span
                        className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_BADGE[app.type]}`}
                      >
                        {TYPE_LABEL[app.type]}
                      </span>
                    </div>
                    <FumeroStatusBadge status={app.status} />
                  </div>
                  <dl className="mb-4 space-y-1 text-xs text-[var(--fumero-text-muted)]">
                    <div className="flex justify-between">
                      <dt>Versie</dt>
                      <dd className="tabular-nums font-medium text-[var(--fumero-text-muted)]">v{app.version}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Data rijen</dt>
                      <dd className="tabular-nums font-medium text-[var(--fumero-text-muted)]">
                        {app.row_count ?? 0}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Laatste edit</dt>
                      <dd>{formatRelativeDate(app.updated_at)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="h-8 flex-1 rounded-lg bg-[var(--fumero-accent)] text-xs shadow-none hover:bg-[var(--fumero-accent-hover)]"
                    >
                      <Link href={`/fumero/bouwen?app=${app.slug}`}>
                        <MessageSquare className="mr-1 h-3 w-3" />
                        Bewerk
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-lg border-[var(--fumero-border)] text-xs"
                    >
                      <a href={appPreviewUrl(app)} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Preview
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-lg border-[var(--fumero-border)] text-xs"
                      onClick={() => setViewingApp(app)}
                    >
                      <Database className="mr-1 h-3 w-3" />
                      Data
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] text-left text-xs font-medium text-[var(--fumero-text-muted)]">
                  <th className="px-4 py-2">Naam</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Versie</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Laatste edit</th>
                  <th className="px-4 py-2 text-right">Acties</th>
                </tr>
              </thead>
              <tbody>
                {garageApps.map((app) => (
                  <tr key={app.id} className="border-b border-[var(--fumero-border)] last:border-0">
                    <td className="px-4 py-2 font-medium">{app.naam}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${TYPE_BADGE[app.type]}`}
                      >
                        {TYPE_LABEL[app.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[var(--fumero-text-muted)]">v{app.version}</td>
                    <td className="px-4 py-2">
                      <FumeroStatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[var(--fumero-text-muted)]">
                      {app.row_count ?? 0} rijen
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--fumero-text-muted)]">
                      {formatRelativeDate(app.updated_at)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/fumero/bouwen?app=${app.slug}`}
                          className="text-xs text-[var(--fumero-accent)] hover:underline"
                        >
                          Bewerk
                        </Link>
                        <button
                          type="button"
                          className="text-xs text-[var(--fumero-text-muted)] hover:underline"
                          onClick={() => setViewingApp(app)}
                        >
                          Data
                        </button>
                        <a
                          href={appPreviewUrl(app)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--fumero-text-muted)] hover:underline"
                        >
                          Preview
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewingApp ? (
        <FumeroAppDataModal
          app={viewingApp}
          open
          onClose={() => setViewingApp(null)}
        />
      ) : null}
    </div>
  );
}
