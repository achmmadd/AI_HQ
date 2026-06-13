import db from "@/lib/db/database";
import { ensureCampaignSchema } from "@/lib/photo-studio/campaign/db-migrate";
import { getBrandKit } from "@/lib/photo-studio/brand-kit/storage";
import { buildCampaignPack } from "@/lib/photo-studio/campaign/pack-builder";
import {
  getCampaignJob,
  insertCampaignJob,
  markCampaignJobDone,
  markCampaignJobError,
  markCampaignJobRunning,
  reapStaleCampaignJobs,
  touchCampaignJob,
  updateCampaignJobProgress,
  type CampaignJobRow,
} from "@/lib/photo-studio/campaign/campaign-generation-jobs";
import { getCampaignPack } from "@/lib/photo-studio/campaign/storage";
import { getCampaignStudioConfig } from "@/lib/photo-studio/campaign/studio-config";
import type {
  AdAngleId,
  AdStrategyResult,
  CampaignGoal,
  CampaignPackRow,
} from "@/lib/photo-studio/campaign/types";
import type { CompanyId } from "@/lib/types";

export type CampaignJobRequest = {
  brand_kit_id: string;
  goal: CampaignGoal;
  skip_media: boolean;
  angles?: AdAngleId[];
  strategy?: AdStrategyResult;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function campaignJobTimeoutMs(): number {
  const raw = process.env.CAMPAIGN_PACK_JOB_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 580_000;
  if (!Number.isFinite(n)) return 580_000;
  return Math.min(Math.max(n, 30_000), 600_000);
}

function staleJobMs(): number {
  return campaignJobTimeoutMs() + 60_000;
}

function newJobId(): string {
  return `cj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

const inFlight = new Map<string, Promise<void>>();

async function runCampaignJob(jobId: string, klant: string, request: CampaignJobRequest): Promise<void> {
  const startedAt = Date.now();
  markCampaignJobRunning(db, jobId);

  const row = getCampaignJob(db, jobId, klant);
  const packId = row?.pack_id;
  if (!packId) {
    markCampaignJobError(db, jobId, "Job zonder pack_id");
    return;
  }

  const heartbeat = setInterval(() => {
    try {
      touchCampaignJob(db, jobId);
    } catch {
      /* heartbeat best-effort */
    }
  }, 5_000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const timeoutMs = campaignJobTimeoutMs();
  const config = getCampaignStudioConfig();

  try {
    const kit = getBrandKit(request.brand_kit_id, klant as CompanyId);
    if (!kit) throw new Error("Brand Kit niet gevonden.");

    const pack = await withTimeout(
      buildCampaignPack(
        packId,
        {
          brandKit: kit,
          goal: request.goal,
          skip_media: request.skip_media,
          angles: request.angles,
          strategy: request.strategy,
        },
        (progress) => {
          updateCampaignJobProgress(db, jobId, {
            phase: progress.phase,
            message: progress.message,
          });
        }
      ),
      timeoutMs,
      "Campaign pack generatie"
    );

    const mediaSkipReason = request.skip_media
      ? "Media overgeslagen op verzoek (skip_media=true)."
      : null;

    markCampaignJobDone(db, jobId, {
      packId: pack.id,
      result: {
        ok: true,
        pack_id: pack.id,
        status: pack.status,
        download_url: pack.zip_path ? `/api/fumero/campaign/${pack.id}/download` : null,
        media_skipped: request.skip_media,
        media_skip_reason: mediaSkipReason,
        config,
        partial: pack.errors.length > 0,
      },
    });
  } catch (error) {
    const msg = errorMessage(error);
    const partialPack = packId ? getCampaignPack(packId) : null;
    if (partialPack && (partialPack.static_assets.some((a) => a.file_path) || partialPack.copy?.sets?.length)) {
      markCampaignJobError(db, jobId, msg, {
        packId,
        result: {
          ok: false,
          pack_id: partialPack.id,
          status: partialPack.status,
          partial: true,
          pack: partialPack,
          error: msg,
        },
      });
    } else {
      markCampaignJobError(db, jobId, msg, packId ? { packId } : undefined);
    }
  } finally {
    clearInterval(heartbeat);
    inFlight.delete(jobId);
    const elapsed = Date.now() - startedAt;
    if (elapsed > 120_000) {
      console.warn("[campaign-generation-runner] long job", {
        job_id: jobId,
        klant,
        elapsed_ms: elapsed,
      });
    }
  }
}

export function startCampaignPackJob(params: {
  klant: string;
  packId: string;
  request: CampaignJobRequest;
}): { jobId: string; packId: string } {
  ensureCampaignSchema();
  reapStaleCampaignJobs(db, staleJobMs());

  const jobId = newJobId();
  insertCampaignJob(db, {
    jobId,
    klant: params.klant,
    packId: params.packId,
    request: params.request,
  });

  const promise = runCampaignJob(jobId, params.klant, params.request).catch((error) => {
    console.error("[campaign-generation-runner] uncaught job failure", {
      job_id: jobId,
      error: errorMessage(error).slice(0, 240),
    });
  });
  inFlight.set(jobId, promise);

  return { jobId, packId: params.packId };
}

export type CampaignJobStatusResponse = {
  jobId: string;
  status: CampaignJobRow["status"] | "processing";
  packId: string | null;
  pack: CampaignPackRow | null;
  phase: string | null;
  progressMessage: string | null;
  progress: {
    static_done?: number;
    static_total?: number;
    video_done?: number;
    video_total?: number;
  } | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseProgressMessage(message: string | null): CampaignJobStatusResponse["progress"] {
  if (!message) return null;
  const staticMatch = message.match(/Static\s+(\d+)\/(\d+)/i);
  const videoMatch = message.match(/Video\s+(\d+)\/(\d+)/i);
  if (!staticMatch && !videoMatch) return null;
  return {
    static_done: staticMatch ? Number.parseInt(staticMatch[1]!, 10) : undefined,
    static_total: staticMatch ? Number.parseInt(staticMatch[2]!, 10) : undefined,
    video_done: videoMatch ? Number.parseInt(videoMatch[1]!, 10) : undefined,
    video_total: videoMatch ? Number.parseInt(videoMatch[2]!, 10) : undefined,
  };
}

export function getCampaignJobStatus(jobId: string, klant: string): CampaignJobStatusResponse | null {
  ensureCampaignSchema();
  reapStaleCampaignJobs(db, staleJobMs());

  const row = getCampaignJob(db, jobId, klant);
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

  const packId = row.pack_id ?? (typeof result?.pack_id === "string" ? result.pack_id : null);
  const pack = packId ? getCampaignPack(packId) : null;

  const status =
    row.status === "pending" || row.status === "running" ? "processing" : row.status;

  return {
    jobId: row.job_id,
    status,
    packId,
    pack,
    phase: row.phase,
    progressMessage: row.progress_message,
    progress: parseProgressMessage(row.progress_message),
    result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Sync path: skip media or no FAL — completes within Cloudflare window. */
export function shouldUseAsyncCampaignJob(skipMedia: boolean): boolean {
  const { fal_configured } = getCampaignStudioConfig();
  return !skipMedia && fal_configured;
}
