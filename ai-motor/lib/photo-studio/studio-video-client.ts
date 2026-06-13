import { failedResponseToError } from "@/lib/fetch-json-client";
import { FAL_VIDEO_TIMEOUT_MS } from "@/lib/photo-studio/generation-timeouts";

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_MS = FAL_VIDEO_TIMEOUT_MS + 60_000;

type StudioVideoJobPoll = {
  ok?: boolean;
  status?: "processing" | "done" | "error";
  progress_message?: string | null;
  error?: string;
  items?: Array<{
    tracking_id: string;
    master_url: string;
    content_id: number | null;
    generation_id: number;
    media_type?: "video" | "image";
    variants: Array<{
      aspect: string;
      public_url: string;
      width: number;
      height: number;
    }>;
  }>;
  user_prompt?: string;
};

export async function pollStudioVideoJob(
  jobId: string,
  opts?: {
    klant?: string;
    signal?: AbortSignal;
    onProgress?: (message: string | null) => void;
  }
): Promise<StudioVideoJobPoll> {
  const started = Date.now();
  const klantQuery = opts?.klant ? `?klant=${encodeURIComponent(opts.klant)}` : "";
  while (Date.now() - started < MAX_POLL_MS) {
    if (opts?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const res = await fetch(
      `/api/photo-studio/generate/jobs/${encodeURIComponent(jobId)}${klantQuery}`,
      { credentials: "include", signal: opts?.signal }
    );
    const text = await res.text();
    let job: StudioVideoJobPoll;
    try {
      job = JSON.parse(text) as StudioVideoJobPoll;
    } catch {
      throw failedResponseToError(text, res.status);
    }

    if (!res.ok) {
      throw failedResponseToError(text, res.status);
    }

    opts?.onProgress?.(job.progress_message ?? null);

    if (job.status === "done") return job;
    if (job.status === "error") {
      throw new Error(job.error || "Video genereren mislukt.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    "Video-generatie duurde te lang. Probeer opnieuw of kies een kortere prompt."
  );
}
