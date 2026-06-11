import db from "@/lib/db/database";
import { ensureAppsSchema } from "./apps-db";
import { refineFullApp } from "./apps-service";
import { generateFullAppV2 } from "./full-app-v2";
import {
  getGenerationJob,
  insertGenerationJob,
  markGenerationJobDone,
  markGenerationJobError,
  markGenerationJobRunning,
  reapStaleGenerationJobs,
  touchGenerationJob,
  updateGenerationJobProgress,
  type GenerationJobAction,
  type GenerationJobRow,
} from "./app-generation-jobs";

/**
 * Achtergrond-runner voor full-app generatie. Koppelt de db-agnostische
 * job-store aan de gedeelde productie-db en draait de generatie fire-and-forget
 * in hetzelfde PM2-proces (single instance — geen externe queue nodig).
 */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Absolute max wandtijd voor één job (builder krijgt z'n natuurlijke tijd). */
export function fullAppJobTimeoutMs(): number {
  const raw = process.env.MOTOR_FULL_APP_JOB_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 580_000;
  if (!Number.isFinite(n)) return 580_000;
  return Math.min(Math.max(n, 30_000), 600_000);
}

/** Een job geldt als vastgelopen na job-timeout + ruime buffer. */
function staleJobMs(): number {
  return fullAppJobTimeoutMs() + 60_000;
}

function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} duurde langer dan ${Math.round(timeoutMs / 1000)} seconden`));
    }, timeoutMs);
    if (typeof timeout.unref === "function") timeout.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

// Houdt de fire-and-forget promise vast zodat de GC hem niet opruimt en het
// event-loop levend blijft tijdens de bouw.
const inFlight = new Map<string, Promise<void>>();

async function runJob(
  jobId: string,
  action: GenerationJobAction,
  klant: string,
  prompt: string,
  slug: string | null
): Promise<void> {
  const startedAt = Date.now();
  markGenerationJobRunning(db, jobId);
  const heartbeat = setInterval(() => {
    try {
      touchGenerationJob(db, jobId);
    } catch {
      /* heartbeat best-effort */
    }
  }, 5_000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const timeoutMs = fullAppJobTimeoutMs();
  const logLabel = `${action}:${jobId}`;

  try {
    if (action === "refine") {
      if (!slug) throw new Error("Refine-job zonder slug");
      updateGenerationJobProgress(db, jobId, {
        phase: "generating",
        message: "Bestaande app wordt verfijnd...",
      });
      const res = await withTimeout(
        refineFullApp(slug, klant, prompt),
        timeoutMs,
        "Refine-job"
      );
      if ("error" in res) {
        markGenerationJobError(db, jobId, res.error);
      } else {
        markGenerationJobDone(db, jobId, {
          slug: res.slug,
          result: {
            ok: true,
            app_id: res.appId,
            slug: res.slug,
            naam: res.naam,
            tables: Array.isArray(res.schema?.tables)
              ? res.schema.tables.length
              : 0,
            refined: true,
          },
        });
      }
    } else {
      updateGenerationJobProgress(db, jobId, {
        phase: "planning",
        message: "Builder v2 maakt een generatieplan...",
      });
      const res = await withTimeout(
        generateFullAppV2(prompt, klant, {
          timeoutMs,
          logLabel,
          onProgress: (progress) => {
            updateGenerationJobProgress(db, jobId, {
              phase: progress.phase,
              message: progress.message,
              plan: progress.plan,
            });
          },
        }),
        timeoutMs,
        "Full-app generatie"
      );
      if ("error" in res) {
        markGenerationJobError(db, jobId, res.error);
      } else {
        markGenerationJobDone(db, jobId, {
          slug: res.slug,
          result: {
            ok: true,
            app_id: res.appId,
            slug: res.slug,
            naam: res.naam,
            tables: Array.isArray(res.schema?.tables)
              ? res.schema.tables.length
              : 0,
            builder_version: res.generationMeta?.builder_version ?? "v2",
            phase: "done",
            plan: res.generationPlan,
            generation_meta: res.generationMeta,
          },
        });
      }
    }
  } catch (error) {
    markGenerationJobError(db, jobId, errorMessage(error));
  } finally {
    clearInterval(heartbeat);
    inFlight.delete(jobId);
    const elapsed = Date.now() - startedAt;
    if (elapsed > 120_000) {
      console.warn("[app-generation-runner] long job", {
        job_id: jobId,
        action,
        klant,
        elapsed_ms: elapsed,
      });
    }
  }
}

/**
 * Start een achtergrond-generatie en geef direct een jobId terug (202-flow).
 * De promise loopt door nadat de HTTP-request is afgerond.
 */
export function startGenerationJob(params: {
  action: GenerationJobAction;
  klant: string;
  prompt: string;
  slug?: string | null;
}): { jobId: string } {
  ensureAppsSchema();
  reapStaleGenerationJobs(db, staleJobMs());

  const jobId = newJobId();
  insertGenerationJob(db, {
    jobId,
    klant: params.klant,
    action: params.action,
    prompt: params.prompt,
    slug: params.slug ?? null,
  });

  const promise = runJob(
    jobId,
    params.action,
    params.klant,
    params.prompt,
    params.slug ?? null
  ).catch((error) => {
    console.error("[app-generation-runner] uncaught job failure", {
      job_id: jobId,
      error: errorMessage(error).slice(0, 240),
    });
  });
  inFlight.set(jobId, promise);

  return { jobId };
}

export type GenerationJobStatusResponse = {
  jobId: string;
  status: GenerationJobRow["status"];
  action: GenerationJobAction;
  slug: string | null;
  result: Record<string, unknown> | null;
  phase: string | null;
  progressMessage: string | null;
  plan: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Klant-scoped status-poll. Schoont eerst vastgelopen jobs op. */
export function getGenerationJobStatus(
  jobId: string,
  klant: string
): GenerationJobStatusResponse | null {
  ensureAppsSchema();
  reapStaleGenerationJobs(db, staleJobMs());

  const row = getGenerationJob(db, jobId, klant);
  if (!row) return null;

  let result: Record<string, unknown> | null = null;
  let plan: Record<string, unknown> | null = null;
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
  if (row.plan_json) {
    try {
      const parsed = JSON.parse(row.plan_json);
      if (parsed && typeof parsed === "object") {
        plan = parsed as Record<string, unknown>;
      }
    } catch {
      plan = null;
    }
  }

  return {
    jobId: row.job_id,
    status: row.status,
    action: row.action,
    slug: row.slug,
    result,
    phase: row.phase,
    progressMessage: row.progress_message,
    plan,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
