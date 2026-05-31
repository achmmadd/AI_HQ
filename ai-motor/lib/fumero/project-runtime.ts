import type { ProjectStack } from "@/lib/project-types";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import type {
  ProjectenGarageApp,
  ProjectenGarageTool,
} from "@/lib/fumero/projecten-shared";
import { motorPublicOrigin } from "@/lib/fumero/public-url";

/** Bouw-runtime: HTML-widget, multi-file website, of data-gedreven app. */
export type ProjectRuntime = "html" | "react" | "full_app";

export type RuntimeBadge = "Widget" | "Website" | "App";

export type ProjectRuntimeSource =
  | { kind: "tool"; tool: Pick<ProjectenGarageTool, "id" | "slug" | "deploy_type"> }
  | { kind: "app"; app: Pick<ProjectenGarageApp, "slug" | "type"> }
  | {
      kind: "project";
      projectId: number;
      slug?: string;
      stack?: ProjectStack | null;
    };

export type ResolvedProjectRuntime = {
  runtime: ProjectRuntime;
  badge: RuntimeBadge;
  buildHref: string;
  previewUrl: string | null;
  liveUrl: string | null;
};

export function runtimeBadgeLabel(runtime: ProjectRuntime): RuntimeBadge {
  switch (runtime) {
    case "full_app":
      return "App";
    case "react":
      return "Website";
    default:
      return "Widget";
  }
}

export function runtimeFromDeployType(deployType: FumeroDeployType): ProjectRuntime {
  return deployType === "internal" ? "full_app" : "html";
}

export function runtimeFromAppType(type: ProjectenGarageApp["type"]): ProjectRuntime {
  return type === "internal" ? "full_app" : "html";
}

export function runtimeFromProjectStack(stack?: ProjectStack | null): ProjectRuntime {
  if (stack === "react" || stack === "next") return "react";
  return "html";
}

export function badgeForToolDeployType(deployType: FumeroDeployType): RuntimeBadge {
  if (deployType === "internal") return "App";
  return "Widget";
}

export function fullAppPreviewUrl(slug: string): string {
  return `${motorPublicOrigin()}/apps/${encodeURIComponent(slug)}?preview=1`;
}

export function normalizeMotorPublicUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const origin = motorPublicOrigin();
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/** Deep links voor Projecten → Bouwen en preview-URLs per bron. */
export function resolveProjectRuntime(source: ProjectRuntimeSource): ResolvedProjectRuntime {
  const origin = motorPublicOrigin();

  if (source.kind === "tool") {
    const { tool } = source;
    const runtime = runtimeFromDeployType(tool.deploy_type);
    const badge = badgeForToolDeployType(tool.deploy_type);
    let previewUrl: string | null = null;
    let liveUrl: string | null = null;
    if (tool.deploy_type === "widget") {
      previewUrl = `${origin}/embed/fumero/preview?tool=${tool.id}`;
      liveUrl = `${origin}/embed/fumero/widget/${tool.slug}`;
    } else if (tool.deploy_type === "customer") {
      liveUrl = `${origin}/embed/fumero/app/${tool.slug}`;
    } else {
      liveUrl = `${origin}/apps/${tool.slug}`;
      previewUrl = `${origin}/apps/${tool.slug}?preview=1`;
    }
    return {
      runtime,
      badge,
      buildHref: `/fumero/bouwen?tool=${tool.id}`,
      previewUrl,
      liveUrl,
    };
  }

  if (source.kind === "app") {
    const { app } = source;
    const runtime = runtimeFromAppType(app.type);
    const badge = runtimeBadgeLabel(runtime);
    const previewUrl = fullAppPreviewUrl(app.slug);
    const liveUrl =
      app.type === "customer"
        ? `${origin}/embed/fumero/app/${app.slug}`
        : `${origin}/apps/${app.slug}`;
    return {
      runtime,
      badge,
      buildHref: `/fumero/bouwen?app=${encodeURIComponent(app.slug)}`,
      previewUrl,
      liveUrl,
    };
  }

  const runtime = runtimeFromProjectStack(source.stack);
  const badge = runtimeBadgeLabel(runtime);
  const slug = source.slug ?? `project-${source.projectId}`;
  return {
    runtime,
    badge,
    buildHref: `/fumero/bouwen?project=${source.projectId}`,
    previewUrl: null,
    liveUrl: `${origin}/apps/${slug}`,
  };
}

/** Team-tab filter: interne full-app items (auth later). */
export function filterTeamWorkItems(
  tools: ProjectenGarageTool[],
  apps: ProjectenGarageApp[]
): { tools: ProjectenGarageTool[]; apps: ProjectenGarageApp[] } {
  return {
    tools: tools.filter((t) => !t.archived && t.deploy_type === "internal"),
    apps: apps.filter((a) => a.type === "internal"),
  };
}

export function resolveActiveBouwenRuntime(opts: {
  activeToolId: number | null;
  activeAppSlug: string | null;
  toolDeployType?: FumeroDeployType | null;
  hasActiveProject?: boolean;
  projectStack?: ProjectStack | null;
}): ProjectRuntime | null {
  if (opts.activeAppSlug) return "full_app";
  if (opts.hasActiveProject) {
    return runtimeFromProjectStack(opts.projectStack);
  }
  if (opts.activeToolId) {
    return opts.toolDeployType
      ? runtimeFromDeployType(opts.toolDeployType)
      : "html";
  }
  return null;
}
