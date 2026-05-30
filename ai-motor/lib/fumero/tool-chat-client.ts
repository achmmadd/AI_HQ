import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";

export type ToolDetailResponse = {
  tool: {
    id: number;
    name: string;
    slug: string;
    deploy_type: FumeroDeployType;
    template_id: string | null;
    archived: boolean;
  };
  concept: { id: number; version: number; prompt: string | null } | null;
  published: { id: number; version: number } | null;
  preview_url: string | null;
  embed_code: string | null;
  internal_url: string | null;
  stats_views?: number;
  stats_interactions?: number;
};

export async function fetchToolDetail(toolId: number): Promise<ToolDetailResponse> {
  const res = await fetch(`/api/fumero/tools/${toolId}`, { credentials: "include" });
  const json = (await res.json()) as ToolDetailResponse & { error?: string };
  if (!res.ok) throw new Error(formatFumeroBuilderError(json.error || "Tool laden mislukt"));
  return json;
}

export async function createFumeroTool(opts: {
  name: string;
  prompt: string;
  deploy_type: FumeroDeployType;
  template_id?: string;
}): Promise<{ tool_id: number; preview_url?: string }> {
  const res = await fetch("/api/fumero/tools", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const json = (await res.json()) as {
    error?: string;
    tool_id?: number;
    tool?: { id: number };
  };
  if (!res.ok) throw new Error(formatFumeroBuilderError(json.error || "Genereren mislukt"));
  const toolId = json.tool_id ?? json.tool?.id;
  if (!toolId) throw new Error("Geen tool-id terug");
  const detail = await fetchToolDetail(toolId);
  return { tool_id: toolId, preview_url: detail.preview_url ?? undefined };
}

export async function iterateFumeroTool(
  toolId: number,
  mergedPrompt: string
): Promise<{ preview_url: string | null }> {
  const res = await fetch(`/api/fumero/tools/${toolId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: mergedPrompt, iterate: true }),
  });
  const json = (await res.json()) as { error?: string; preview_url?: string };
  if (!res.ok) throw new Error(formatFumeroBuilderError(json.error || "Aanpassen mislukt"));
  return { preview_url: json.preview_url ?? null };
}

export async function publishFumeroTool(toolId: number): Promise<ToolDetailResponse> {
  const res = await fetch(`/api/fumero/tools/${toolId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish" }),
  });
  const json = (await res.json()) as ToolDetailResponse & { error?: string };
  if (!res.ok) throw new Error(json.error || "Publiceren mislukt");
  return json;
}
