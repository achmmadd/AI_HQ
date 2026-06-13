import db from "@/lib/db/database";
import type { CompanyId } from "@/lib/types";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { downloadMediaBuffer } from "@/lib/photo-studio/download-master";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { generateVideoWithFal } from "@/lib/photo-studio/fal-video";
import { FAL_VIDEO_TIMEOUT_MS } from "@/lib/photo-studio/generation-timeouts";
import { persistVideoGenerationFromBuffer } from "@/lib/photo-studio/library";
import {
  getStudioVideoJob,
  insertStudioVideoJob,
  markStudioVideoJobDone,
  markStudioVideoJobError,
  markStudioVideoJobRunning,
  reapStaleStudioVideoJobs,
  touchStudioVideoJob,
  updateStudioVideoJobProgress,
  type StudioVideoJobRow,
} from "@/lib/photo-studio/studio-video-jobs";

export type StudioVideoJobRequest = {
  user_prompt: string;
  image_urls: string[];
  start_image_url?: string;
  brand_enhancement: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newJobId(): string {
  return `svj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function staleJobMs(): number {
  return FAL_VIDEO_TIMEOUT_MS + 120_000;
}

const inFlight = new Map<string, Promise<void>>();

async function runStudioVideoJob(
  jobId: string,
  klant: CompanyId,
  request: StudioVideoJobRequest
): Promise<void> {
  markStudioVideoJobRunning(db, jobId);

  const heartbeat = setInterval(() => {
    try {
      touchStudioVideoJob(db, jobId);
    } catch {
      /* best-effort */
    }
  }, 5_000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  try {
    ensurePhotoStudioSchema();

    let videoImageUrl = request.image_urls[0] || request.start_image_url?.trim() || "";
    if (videoImageUrl) {
      updateStudioVideoJobProgress(db, jobId, {
        phase: "resolve",
        message: "Startframe wordt voorbereid…",
      });
      const resolved = await resolveImageUrlsForFal([videoImageUrl]);
      if (!resolved.ok) throw new Error(resolved.error);
      videoImageUrl = resolved.urls[0]!;
    }

    updateStudioVideoJobProgress(db, jobId, {
      phase: "fal",
      message: "Video wordt gegenereerd — dit kan enkele minuten duren…",
    });

    const videoResult = await generateVideoWithFal({
      userPrompt: request.user_prompt,
      klant,
      imageUrl: videoImageUrl || undefined,
      brandEnhancement: request.brand_enhancement,
    });
    if (!videoResult.ok) throw new Error(videoResult.error);

    updateStudioVideoJobProgress(db, jobId, {
      phase: "download",
      message: "Video wordt opgeslagen…",
    });

    const videoBuffer = await downloadMediaBuffer(
      videoResult.video_url,
      FAL_VIDEO_TIMEOUT_MS
    );

    const persisted = await persistVideoGenerationFromBuffer({
      klant,
      mode: videoImageUrl ? "image_to_image" : "text_to_image",
      user_prompt: videoResult.user_prompt,
      fal_prompt: videoResult.fal_prompt,
      video_url: videoResult.video_url,
      source_image_url: request.image_urls[0] ?? null,
      buffer: videoBuffer,
    });

    const item = {
      tracking_id: persisted.tracking_id,
      master_url: persisted.master_public_url,
      variants: persisted.variants,
      content_id: persisted.content_id,
      generation_id: persisted.id,
      media_type: "video" as const,
      analytics: persisted.analytics,
    };

    markStudioVideoJobDone(db, jobId, {
      ok: true,
      klant,
      mode: videoImageUrl ? "image_to_image" : "text_to_image",
      media_type: "video",
      model: videoResult.model,
      user_prompt: videoResult.user_prompt,
      fal_prompt: videoResult.fal_prompt,
      items: [item],
      tracking_id: item.tracking_id,
      master_url: item.master_url,
      variants: item.variants,
      content_id: item.content_id,
      generation_id: item.generation_id,
      analytics: item.analytics,
    });
  } catch (error) {
    markStudioVideoJobError(db, jobId, errorMessage(error));
  } finally {
    clearInterval(heartbeat);
    inFlight.delete(jobId);
  }
}

export function startStudioVideoJob(params: {
  klant: CompanyId;
  request: StudioVideoJobRequest;
}): { jobId: string } {
  ensurePhotoStudioSchema();
  reapStaleStudioVideoJobs(db, staleJobMs());

  const jobId = newJobId();
  insertStudioVideoJob(db, {
    jobId,
    klant: params.klant,
    request: params.request,
  });

  const promise = runStudioVideoJob(jobId, params.klant, params.request).catch((error) => {
    console.error("[studio-video-runner] uncaught job failure", {
      job_id: jobId,
      error: errorMessage(error).slice(0, 240),
    });
  });
  inFlight.set(jobId, promise);

  return { jobId };
}

export type StudioVideoJobStatusResponse = {
  jobId: string;
  status: StudioVideoJobRow["status"] | "processing";
  phase: string | null;
  progressMessage: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};

export function getStudioVideoJobStatus(
  jobId: string,
  klant: CompanyId
): StudioVideoJobStatusResponse | null {
  reapStaleStudioVideoJobs(db, staleJobMs());

  const row = getStudioVideoJob(db, jobId, klant);
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

  const status =
    row.status === "pending" || row.status === "running" ? "processing" : row.status;

  return {
    jobId: row.job_id,
    status,
    phase: row.phase,
    progressMessage: row.progress_message,
    result,
    error: row.error,
  };
}
