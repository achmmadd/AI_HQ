import { NextRequest, NextResponse } from "next/server";
import { generateWithModel } from "@/lib/photo-studio/fal";
import { generateVideoWithFal } from "@/lib/photo-studio/fal-video";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import {
  persistPhotoGeneration,
  persistVideoGeneration,
} from "@/lib/photo-studio/library";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
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
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const userPrompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";

  const legacyImageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";
  const imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u) => typeof u === "string" && u.trim()).map((u) => u.trim())
    : legacyImageUrl
      ? [legacyImageUrl]
      : [];

  const mode: PhotoStudioMode =
    imageUrls.length > 0 || body.mode === "image_to_image"
      ? "image_to_image"
      : "text_to_image";

  if (!userPrompt) {
    return NextResponse.json({ error: "prompt is verplicht." }, { status: 400 });
  }
  if (mode === "image_to_image" && !imageUrls.length) {
    return NextResponse.json(
      { error: "image_urls is verplicht voor bewerking met referentie." },
      { status: 400 }
    );
  }

  const modelRaw =
    typeof body.model === "string" ? body.model : "nano-banana-2";
  const model = MODELS.has(modelRaw as ContentStudioModelId)
    ? (modelRaw as ContentStudioModelId)
    : "nano-banana-2";

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
    const imageUrl = imageUrls[0];
    const videoResult = await generateVideoWithFal({
      userPrompt,
      klant: auth.klant,
      imageUrl,
    });
    if (!videoResult.ok) {
      return NextResponse.json({ error: videoResult.error }, { status: 502 });
    }

    const persisted = await persistVideoGeneration({
      klant: auth.klant,
      mode: imageUrl ? "image_to_image" : "text_to_image",
      user_prompt: videoResult.user_prompt,
      fal_prompt: videoResult.fal_prompt,
      video_url: videoResult.video_url,
      source_image_url: imageUrl ?? null,
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

    return NextResponse.json({
      ok: true,
      klant: auth.klant,
      mode: imageUrl ? "image_to_image" : "text_to_image",
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
  }

  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? Math.floor(body.seed)
      : undefined;

  const result = await generateWithModel({
    model,
    userPrompt,
    klant: auth.klant,
    imageUrls,
    aspectRatio,
    quality,
    count,
    style_hint:
      typeof body.style_hint === "string" ? body.style_hint : undefined,
    seed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const items = [];
  for (const url of result.images) {
    const persisted = await persistPhotoGeneration({
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
    });
    items.push({
      tracking_id: persisted.tracking_id,
      master_url: persisted.master_public_url,
      variants: persisted.variants,
      content_id: persisted.content_id,
      generation_id: persisted.id,
      media_type: "image" as const,
      analytics: persisted.analytics,
    });
  }

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
