import db from "@/lib/db/database";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import { fumeroPreviewPath } from "@/lib/fumero/public-url";
import {
  createTool,
  generateToolHtml,
  updateConceptCode,
} from "@/lib/fumero/tools-service";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import {
  ensureToolGenerationJobsSchema,
  getToolGenerationJob,
  insertToolGenerationJob,
  markToolGenerationJobDone,
  markToolGenerationJobError,
  markToolGenerationJobRunning,
  parseToolGenerationPayload,
  reapStaleToolGenerationJobs,
  touchToolGenerationJob,
  updateToolGenerationJobProgress,
  type ToolGenerationJobAction,
  type ToolGenerationJobPayload,
  type ToolGenerationJobRow,
} from "@/lib/fumero/tool-generation-jobs";
import {
  toolGenerationElapsedMs,
  toolGenerationProgressPct,
} from "@/lib/fumero/tool-generation-progress";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function toolGenerationJobTimeoutMs(): number {
  const raw = process.env.MOTOR_TOOL_JOB_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 300_000;
  if (!Number.isFinite(n)) return 300_000;
  return Math.min(Math.max(n, 30_000), 600_000);
}

function staleJobMs(): number {
  return toolGenerationJobTimeoutMs() + 60_000;
}

function newJobId(): string {
  return `tjob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          `${label} duurde langer dan ${Math.round(timeoutMs / 1000)} seconden`
        )
      );
    }, timeoutMs);
    if (typeof timeout.unref === "function") timeout.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

const inFlight = new Map<string, Promise<void>>();

async function runCreateJob(
  jobId: string,
  prompt: string,
  payload: ToolGenerationJobPayload
): Promise<void> {
  const name = String(payload.name || "").trim();
  const deployType = (payload.deploy_type || "widget") as FumeroDeployType;
  const templateId = payload.template_id;

  if (!name) throw new Error("name is verplicht voor create-job");

  updateToolGenerationJobProgress(db, jobId, {
    phase: "analyzing",
    message: "Opdracht wordt geanalyseerd…",
  });

  updateToolGenerationJobProgress(db, jobId, {
    phase: "generating",
    message: "Structuur en inhoud worden opgebouwd…",
  });

  const gen = await generateToolHtml(deployType, prompt, templateId);
  if ("error" in gen) {
    throw new Error(formatFumeroBuilderError(gen.error));
  }

  updateToolGenerationJobProgress(db, jobId, {
    phase: "validating",
    message: "Styling en inhoud worden gecontroleerd…",
  });

  updateToolGenerationJobProgress(db, jobId, {
    phase: "saving",
    message: "Preview wordt klaargezet…",
  });

  const created = createTool({
    name,
    prompt,
    deployType,
    templateId,
    code: gen.html,
  });
  if ("error" in created) throw new Error(created.error);

  markToolGenerationJobDone(db, jobId, {
    ok: true,
    tool_id: created.toolId,
    version_id: created.versionId,
    preview_url: fumeroPreviewPath(created.toolId, created.versionId),
  });
}

async function runIterateJob(
  jobId: string,
  prompt: string,
  payload: ToolGenerationJobPayload
): Promise<void> {
  const toolId = payload.tool_id;
  if (!toolId || !Number.isFinite(toolId)) {
    throw new Error("tool_id is verplicht voor iterate-job");
  }

  updateToolGenerationJobProgress(db, jobId, {
    phase: "analyzing",
    message: "Aanpassingen worden bekeken…",
  });

  updateToolGenerationJobProgress(db, jobId, {
    phase: "generating",
    message: "Tool wordt verfijnd…",
  });

  const updated = await updateConceptCode(toolId, prompt, undefined, {
    iterate: true,
  });
  if ("error" in updated) {
    throw new Error(formatFumeroBuilderError(updated.error));
  }

  updateToolGenerationJobProgress(db, jobId, {
    phase: "validating",
    message: "Resultaat wordt gecontroleerd…",
  });

  updateToolGenerationJobProgress(db, jobId, {
    phase: "saving",
    message: "Preview wordt bijgewerkt…",
  });

  markToolGenerationJobDone(db, jobId, {
    ok: true,
    tool_id: toolId,
    version: updated.version.version,
    preview_url: fumeroPreviewPath(toolId, updated.version.id),
  });
}

async function runJob(
  jobId: string,
  action: ToolGenerationJobAction,
  klant: string,
  prompt: string,
  payload: ToolGenerationJobPayload
): Promise<void> {
  const startedAt = Date.now();
  markToolGenerationJobRunning(db, jobId);
  const heartbeat = setInterval(() => {
    try {
      touchToolGenerationJob(db, jobId);
    } catch {
      /* best-effort */
    }
  }, 5_000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const timeoutMs = toolGenerationJobTimeoutMs();
  const label = `tool-${action}:${jobId}`;

  try {
    if (action === "iterate") {
      await withTimeout(runIterateJob(jobId, prompt, payload), timeoutMs, label);
    } else {
      await withTimeout(runCreateJob(jobId, prompt, payload), timeoutMs, label);
    }
  } catch (error) {
    markToolGenerationJobError(db, jobId, formatFumeroBuilderError(errorMessage(error)));
  } finally {
    clearInterval(heartbeat);
    inFlight.delete(jobId);
    const elapsed = Date.now() - startedAt;
    if (elapsed > 120_000) {
      console.warn("[tool-generation-runner] long job", {
        job_id: jobId,
        action,
        klant,
        elapsed_ms: elapsed,
      });
    }
  }
}

export function startToolGenerationJob(params: {
  action: ToolGenerationJobAction;
  klant: string;
  prompt: string;
  payload: ToolGenerationJobPayload;
}): { jobId: string } {
  ensureToolGenerationJobsSchema(db);
  reapStaleToolGenerationJobs(db, staleJobMs());

  const jobId = newJobId();
  insertToolGenerationJob(db, {
    jobId,
    klant: params.klant,
    action: params.action,
    prompt: params.prompt,
    payload: params.payload,
  });

  const promise = runJob(
    jobId,
    params.action,
    params.klant,
    params.prompt,
    params.payload
  ).catch((error) => {
    console.error("[tool-generation-runner] uncaught job failure", {
      job_id: jobId,
      error: errorMessage(error).slice(0, 240),
    });
  });
  inFlight.set(jobId, promise);

  return { jobId };
}

export type ToolGenerationJobStatusResponse = {
  jobId: string;
  status: ToolGenerationJobRow["status"];
  action: ToolGenerationJobAction;
  result: Record<string, unknown> | null;
  phase: string | null;
  progressMessage: string | null;
  progressPct: number;
  elapsedMs: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export function getToolGenerationJobStatus(
  jobId: string,
  klant: string
): ToolGenerationJobStatusResponse | null {
  ensureToolGenerationJobsSchema(db);
  reapStaleToolGenerationJobs(db, staleJobMs());

  const row = getToolGenerationJob(db, jobId, klant);
  if (!row) return null;

  let result: Record<string, unknown> | null = null;
  if (row.result_json) {
    try {
      const parsed = JSON.parse(row.result_json);
      if (parsed && typeof parsed === "object") {
        result = parsed as Record<string, unknown>;
      }
    } catch {
      result = null;
    }
  }

  return {
    jobId: row.job_id,
    status: row.status,
    action: row.action,
    result,
    phase: row.phase,
    progressMessage: row.progress_message,
    progressPct: toolGenerationProgressPct(row.phase, row.status),
    elapsedMs: toolGenerationElapsedMs(row.created_at, row.started_at),
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
