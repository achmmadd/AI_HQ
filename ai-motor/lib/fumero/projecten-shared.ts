import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import { deployTypeLabel } from "@/lib/fumero/tool-templates";
import { motorPublicOrigin } from "@/lib/fumero/public-url";

export type ProjectenGarageTool = {
  id: number;
  name: string;
  slug: string;
  deploy_type: FumeroDeployType;
  archived: boolean;
  published_version: number | null;
  concept_version: number | null;
  updated_at: string;
  embed_code?: string;
  internal_url?: string;
};

export type ProjectenGarageApp = {
  id: number;
  slug: string;
  naam: string;
  type: "widget" | "internal" | "customer";
  version: number;
  status: "concept" | "published" | "archived";
  updated_at: string;
};

export type ProjectenMyWorkItem = {
  kind: "linked" | "project" | "app";
  title: string;
  slug: string;
  updated_at: string;
  build_project_id: number | null;
  custom_app_id: number | null;
  stack: string | null;
  status: string | null;
  /** Voorbereid voor team-filter (interne deploy). */
  deploy_type?: FumeroDeployType | null;
};

export type ProjectenTeamFilter = {
  deployTypes?: FumeroDeployType[];
  appTypes?: ProjectenGarageApp["type"][];
};

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function toolGarageStatus(
  t: ProjectenGarageTool
): "published" | "concept" | "archived" {
  if (t.archived) return "archived";
  if (t.published_version) return "published";
  return "concept";
}

export function toolVersionLabel(t: ProjectenGarageTool): string {
  if (t.published_version) return `v${t.published_version}`;
  if (t.concept_version) return `v${t.concept_version} · concept`;
  return "v1";
}

export function toolLiveUrl(tool: ProjectenGarageTool): string | null {
  if (tool.archived) return null;
  const origin = motorPublicOrigin();
  if (tool.deploy_type === "customer") return `${origin}/embed/fumero/app/${tool.slug}`;
  if (tool.deploy_type === "internal") return tool.internal_url ?? `${origin}/apps/${tool.slug}`;
  if (tool.deploy_type === "widget") return `${origin}/embed/fumero/widget/${tool.slug}`;
  return null;
}

export function appLiveUrl(app: ProjectenGarageApp): string {
  const origin = motorPublicOrigin();
  if (app.type === "customer") return `${origin}/embed/fumero/app/${app.slug}`;
  return `${origin}/apps/${app.slug}`;
}

export function toolTypeLabel(deployType: FumeroDeployType): string {
  return deployTypeLabel(deployType);
}

export const APP_TYPE_LABEL: Record<ProjectenGarageApp["type"], string> = {
  widget: "Widget",
  internal: "Intern",
  customer: "Klant",
};
