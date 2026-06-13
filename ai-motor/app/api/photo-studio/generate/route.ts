import { NextRequest, NextResponse } from "next/server";
import { generateWithModel } from "@/lib/photo-studio/fal";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import {
  persistPhotoGenerationFromBuffer,
} from "@/lib/photo-studio/library";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import { startStudioVideoJob } from "@/lib/photo-studio/studio-video-runner";
import {
  MAX_REF_IMAGES,
  normalizeQualityForModel,
  type ContentStudioAspectRatio,
  type ContentStudioMediaType,
  type ContentStudioModelId,
  type ContentStudioQuality,
  type PhotoStudioMode,
} from "@/lib/photo-studio/types";

export const runtime = "nodejs";
/** Image sync path; video returns 202 immediately and runs in background. */
export const maxDuration = 300;

const ASPECTS = new Set<ContentStudioAspectRatio>([
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
]);

const MODELS = new Set<ContentStudioModelId>([
  "nano-banana-2",
  "seedream-5-lite",
  "gpt-image-2",
]);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    prompt?: string;
    model?: string;
    image_urls?: string[];
    image_url?: string;
    aspect_ratio?: string;
    quality?: string;
    count?: number;
    auto_variants?: boolean;
    media_type?: string;
    style_hint?: string;
    seed?: number;
    /** @deprecated */
    mode?: string;
    workspace_preset?: string;
    brand_enhancement?: boolean;
    start_image_url?: string;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const userPrompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";

  const legacyImageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";
  let imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u) => typeof u === "string" && u.trim()).map((u) => u.trim())
    : legacyImageUrl
      ? [legacyImageUrl]
      : [];

  const effectivePrompt =
    userPrompt ||
    (imageUrls.length > 0
      ? "Verbeter deze foto met professionele studio-kwaliteit."
      : "");

  const mode: PhotoStudioMode =
    imageUrls.length > 0 || body.mode === "image_to_image"
      ? "image_to_image"
      : "text_to_image";

  if (!effectivePrompt) {
    return NextResponse.json({ error: "prompt is verplicht." }, { status: 400 });
  }
  if (mode === "image_to_image" && !imageUrls.length) {
    return NextResponse.json(
      { error: "image_urls is verplicht voor bewerking met referentie." },
      { status: 400 }
    );
  }

  const styleHint =
    typeof body.style_hint === "string" ? body.style_hint.trim() : "";
  const workspacePreset =
    typeof body.workspace_preset === "string" ? body.workspace_preset.trim() : "";
  const brandEnhancement =
    body.brand_enhancement === true ||
    Boolean(styleHint) ||
    Boolean(workspacePreset);

  const modelRaw =
    typeof body.model === "string"
      ? body.model
      : workspacePreset || styleHint
        ? "nano-banana-2"
        : "gpt-image-2";
  const model = MODELS.has(modelRaw as ContentStudioModelId)
    ? (modelRaw as ContentStudioModelId)
    : "gpt-image-2";

  const maxRefs = MAX_REF_IMAGES[model];
  if (imageUrls.length > maxRefs) {
    return NextResponse.json(
      { error: `Maximaal ${maxRefs} referentiebeelden voor dit model.` },
      { status: 400 }
    );
  }

  const aspectRatio =
    typeof body.aspect_ratio === "string" &&
    ASPECTS.has(body.aspect_ratio as ContentStudioAspectRatio)
      ? (body.aspect_ratio as ContentStudioAspectRatio)
      : "1:1";

  const qualityRaw =
    body.quality === "4K" || body.quality === "3K" || body.quality === "2K"
      ? body.quality
      : "2K";
  const quality = normalizeQualityForModel(
    model,
    qualityRaw as ContentStudioQuality
  );

  const count =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.min(5, Math.max(1, Math.floor(body.count)))
      : 1;

  const autoVariants = body.auto_variants !== false;

  const mediaType: ContentStudioMediaType =
    body.media_type === "video" ? "video" : "image";

  ensurePhotoStudioSchema();

  if (mediaType === "video") {
    const startFrameUrl =
      typeof body.start_image_url === "string"
        ? body.start_image_url.trim()
        : "";

    const { jobId } = startStudioVideoJob({
      klant: auth.klant,
      request: {
        user_prompt: effectivePrompt,
        image_urls: imageUrls,
        start_image_url: startFrameUrl || undefined,
        brand_enhancement: brandEnhancement,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: jobId,
        jobId,
        status: "processing",
        media_type: "video",
      },
      { status: 202 }
    );
  }

  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? Math.floor(body.seed)
      : undefined;

  let falImageUrls: string[] = [];
  if (mode === "image_to_image") {
    const resolved = await resolveImageUrlsForFal(imageUrls);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    falImageUrls = resolved.urls;
  }

  const result = await generateWithModel({
    model,
    userPrompt: effectivePrompt,
    klant: auth.klant,
    imageUrls: falImageUrls,
    aspectRatio,
    quality,
    count,
    style_hint: styleHint || undefined,
    seed,
    brandEnhancement,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const items = await Promise.all(
    result.images.map(async (url) => {
      const buffer = await downloadImageBuffer(url);
      const persisted = await persistPhotoGenerationFromBuffer({
        klant: auth.klant,
        mode,
        user_prompt: result.user_prompt,
        fal_prompt: result.fal_prompt,
        master_url: url,
        source_image_url: mode === "image_to_image" ? imageUrls[0] ?? null : null,
        seed: seed ?? null,
        workspace_preset:
          typeof body.workspace_preset === "string" ? body.workspace_preset : null,
        auto_variants: autoVariants,
        buffer,
      });
      return {
        tracking_id: persisted.tracking_id,
        master_url: persisted.master_public_url,
        variants: persisted.variants,
        content_id: persisted.content_id,
        generation_id: persisted.id,
        media_type: "image" as const,
        analytics: persisted.analytics,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    klant: auth.klant,
    mode,
    media_type: "image",
    model: result.model,
    user_prompt: result.user_prompt,
    fal_prompt: result.fal_prompt,
    items,
    tracking_id: items[0]?.tracking_id,
    master_url: items[0]?.master_url,
    variants: items[0]?.variants,
    content_id: items[0]?.content_id,
    generation_id: items[0]?.generation_id,
    analytics: items[0]?.analytics,
  });
}
