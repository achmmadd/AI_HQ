import { fetchJsonChecked } from "@/lib/fetch-json-client";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import { adaptiveToolPollIntervalMs } from "@/lib/fumero/tool-generation-progress";
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

type ToolJobPollResponse = {
  ok?: boolean;
  jobId?: string;
  status?: "pending" | "running" | "done" | "error";
  phase?: string | null;
  progress_message?: string | null;
  progress_pct?: number;
  elapsed_ms?: number;
  result?: {
    tool_id?: number;
    preview_url?: string;
  } | null;
  error?: string;
};

export type ToolGenerationProgress = {
  phase?: string | null;
  message?: string | null;
  status?: string;
  progressPct?: number;
  elapsedMs?: number;
};

type ToolJobOptions = {
  onProgress?: (update: ToolGenerationProgress) => void;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function pollToolGenerationJob(
  jobId: string,
  opts?: ToolJobOptions
): Promise<{ tool_id: number; preview_url?: string }> {
  const maxWait = opts?.maxWaitMs ?? 580_000;
  const started = Date.now();

  while (Date.now() - started < maxWait) {
    if (opts?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const json = await fetchJsonChecked<ToolJobPollResponse>(
      `/api/fumero/tools/generate/status?jobId=${encodeURIComponent(jobId)}`,
      { credentials: "include", signal: opts?.signal }
    );

    opts?.onProgress?.({
      phase: json.phase,
      message: json.progress_message,
      status: json.status,
      progressPct: json.progress_pct,
      elapsedMs: json.elapsed_ms,
    });

    if (json.status === "done") {
      const toolId = json.result?.tool_id;
      if (!toolId) throw new Error("Job klaar maar geen tool-id teruggekregen");
      return {
        tool_id: toolId,
        preview_url: json.result?.preview_url,
      };
    }

    if (json.status === "error") {
      throw new Error(formatFumeroBuilderError(json.error || "Genereren mislukt"));
    }

    const elapsed = Date.now() - started;
    const interval =
      opts?.pollIntervalMs ?? adaptiveToolPollIntervalMs(elapsed);
    await sleep(interval, opts?.signal);
  }

  throw new Error("Tool-generatie duurde te lang — probeer opnieuw");
}

async function startToolGenerationJob(
  body: Record<string, unknown>,
  opts?: ToolJobOptions
): Promise<string> {
  const json = await fetchJsonChecked<{ ok?: boolean; jobId?: string; error?: string }>(
    "/api/fumero/tools/generate/start",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts?.signal,
    }
  );
  if (!json.jobId) {
    throw new Error(formatFumeroBuilderError(json.error || "Async generatie starten mislukt"));
  }
  opts?.onProgress?.({
    phase: "queued",
    message: "Generatie gestart…",
    status: "pending",
    progressPct: 8,
    elapsedMs: 0,
  });
  return json.jobId;
}

export async function fetchToolDetail(toolId: number): Promise<ToolDetailResponse> {
  const json = await fetchJsonChecked<ToolDetailResponse & { error?: string }>(
    `/api/fumero/tools/${toolId}`,
    { credentials: "include" }
  );
  return json;
}

export async function createFumeroTool(
  opts: {
    name: string;
    prompt: string;
    deploy_type: FumeroDeployType;
    template_id?: string;
  },
  jobOpts?: ToolJobOptions
): Promise<{ tool_id: number; preview_url?: string }> {
  const jobId = await startToolGenerationJob(
    {
      action: "create",
      name: opts.name,
      prompt: opts.prompt,
      deploy_type: opts.deploy_type,
      template_id: opts.template_id,
    },
    jobOpts
  );
  const result = await pollToolGenerationJob(jobId, jobOpts);
  const detail = await fetchToolDetail(result.tool_id);
  return { tool_id: result.tool_id, preview_url: detail.preview_url ?? result.preview_url };
}

export async function iterateFumeroTool(
  toolId: number,
  mergedPrompt: string,
  jobOpts?: ToolJobOptions
): Promise<{ preview_url: string | null }> {
  const jobId = await startToolGenerationJob(
    {
      action: "iterate",
      tool_id: toolId,
      prompt: mergedPrompt,
    },
    jobOpts
  );
  const result = await pollToolGenerationJob(jobId, jobOpts);
  const detail = await fetchToolDetail(result.tool_id);
  return { preview_url: detail.preview_url ?? result.preview_url ?? null };
}

export async function publishFumeroTool(toolId: number): Promise<ToolDetailResponse> {
  const json = await fetchJsonChecked<ToolDetailResponse & { error?: string }>(
    `/api/fumero/tools/${toolId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    }
  );
  if (json.error) throw new Error(json.error);
  return json;
}
