import type { CompanyId } from "@/lib/types";
import { FAL_VIDEO_TIMEOUT_MS } from "@/lib/photo-studio/generation-timeouts";
import { contentTypeForKlant, type PhotoStudioContentType } from "@/lib/photo-studio/fal";

const MINIMAX_I2V = "fal-ai/minimax/video-01/image-to-video";
const MINIMAX_T2V = "fal-ai/minimax/video-01/text-to-video";

const VIDEO_MOTION: Record<PhotoStudioContentType, string> = {
  product:
    "Subtle cinematic product reveal. Slow push-in, soft studio lighting, gentle rotation. Commercial e-commerce quality, smooth motion.",
  food:
    "Appetizing food video. Slow camera orbit, warm natural lighting, steam or garnish motion if natural. Restaurant menu quality.",
};

export type FalVideoGenerateResult =
  | {
      ok: true;
      video_url: string;
      fal_prompt: string;
      user_prompt: string;
      model: string;
    }
  | { ok: false; error: string };

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

function buildVideoPrompt(
  userPrompt: string,
  klant: CompanyId,
  brandEnhancement?: boolean
): string {
  if (!brandEnhancement) return userPrompt.trim();
  const type = contentTypeForKlant(klant);
  const motion = VIDEO_MOTION[type];
  return `${userPrompt.trim()}\n\n${motion}`;
}

async function callFalVideo(opts: {
  endpoint: string;
  body: Record<string, unknown>;
}): Promise<FalVideoGenerateResult> {
  const key = falKey();
  if (!key) {
    return { ok: false, error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." };
  }

  try {
    const res = await fetch(`https://fal.run/${opts.endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opts.body),
      signal: AbortSignal.timeout(FAL_VIDEO_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        error: `fal.ai video: ${res.status} — ${text.slice(0, 200)}`,
      };
    }

    if (!res.ok) {
      const errObj = data as { detail?: string; message?: string };
      return {
        ok: false,
        error: errObj.detail || errObj.message || `fal HTTP ${res.status}`,
      };
    }

    const out = data as { video?: { url?: string } };
    const videoUrl =
      typeof out.video?.url === "string" ? out.video.url.trim() : "";
    if (!videoUrl) {
      return { ok: false, error: "Geen video in fal-response" };
    }

    return { ok: true, video_url: videoUrl, fal_prompt: "", user_prompt: "", model: opts.endpoint };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fal.ai video aanroep mislukt",
    };
  }
}

/** MiniMax Video 01 — image-to-video or text-to-video. */
export async function generateVideoWithFal(opts: {
  userPrompt: string;
  klant: CompanyId;
  imageUrl?: string;
  brandEnhancement?: boolean;
}): Promise<FalVideoGenerateResult> {
  const user_prompt = opts.userPrompt.trim();
  const fal_prompt = buildVideoPrompt(user_prompt, opts.klant, opts.brandEnhancement);
  const imageUrl = opts.imageUrl?.trim();

  const endpoint = imageUrl ? MINIMAX_I2V : MINIMAX_T2V;
  const body: Record<string, unknown> = {
    prompt: fal_prompt,
    prompt_optimizer: true,
  };
  if (imageUrl) {
    body.image_url = imageUrl;
  }

  const result = await callFalVideo({ endpoint, body });
  if (!result.ok) return result;

  return {
    ok: true,
    video_url: result.video_url,
    fal_prompt,
    user_prompt,
    model: endpoint,
  };
}

export { FAL_VIDEO_MODEL_LABEL } from "@/lib/photo-studio/fal-video-label";
