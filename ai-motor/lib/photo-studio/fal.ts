import type { CompanyId } from "@/lib/types";
import type {
  ContentStudioAspectRatio,
  ContentStudioModelId,
  ContentStudioQuality,
  FalBatchGenerateResult,
  FalGenerateResult,
  PhotoStudioMode,
} from "@/lib/photo-studio/types";

const NB2_TXT2IMG = "fal-ai/nano-banana-2";
const NB2_EDIT = "fal-ai/nano-banana-2/edit";

/** Phase B stubs — verified on fal.ai, not wired in Phase A. */
export const FAL_MODEL_REGISTRY = {
  "nano-banana-2": {
    label: "Nano Banana 2",
    txt2img: NB2_TXT2IMG,
    edit: NB2_EDIT,
    phase: "A" as const,
  },
  "seedream-5-lite": {
    label: "Seedream 5.0",
    txt2img: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    edit: "fal-ai/bytedance/seedream/v5/lite/edit",
    phase: "B" as const,
  },
  "gpt-image-2": {
    label: "GPT Image 2",
    txt2img: "openai/gpt-image-2",
    edit: "openai/gpt-image-2/edit",
    phase: "B" as const,
  },
} as const;

export type PhotoStudioContentType = "product" | "food";

const SYSTEM_CONTEXT: Record<PhotoStudioContentType, string> = {
  product: "Je bent een professioneel product fotograaf.",
  food: "Je bent een professioneel food fotograaf.",
};

const BASE_ENRICHMENT: Record<PhotoStudioContentType, string> = {
  product:
    "Professional studio product photography. Pure white seamless background. Soft box studio lighting from above-left. Sharp focus on product, no distractions. Clean minimal composition, shot on Hasselblad 907X. Commercial e-commerce quality, not AI generated. Fine details crisp, professional color grading. No text, no labels, no props whatsoever. Magazine cover quality.",
  food:
    "Professional food photography for restaurant menu. Appetizing presentation, natural warm lighting. Shot from 45 degrees, food in focus, shallow depth. Captured on Canon 5D Mark IV with 85mm lens. Fine culinary details visible, professional plating. Not AI generated, shot on camera. Michelin-guide restaurant quality. Clean neutral background, warm golden hour light.",
};

const IMG2IMG_BASE: Record<PhotoStudioContentType, string> = {
  product:
    "Professional product photography remake. Same product, studio lighting upgrade. White seamless background, soft box fill light. Remove: shadows, bad background, phone artifacts. Keep: product shape, colors, details exact. Output: magazine-quality product shot. Clean, minimal, Hasselblad 907X style. Not AI generated, shot on professional camera.",
  food:
    "Professional food photography remake. Same dish, presentation and plating preserved. Warm natural restaurant lighting upgrade. Clean neutral background. Remove: shadows, bad background, phone artifacts. Keep: food shape, colors, garnishes exact. Output: Michelin-guide menu-quality food shot. Canon 5D Mark IV with 85mm lens style. Not AI generated, shot on professional camera.",
};

export function contentTypeForKlant(klant: CompanyId): PhotoStudioContentType {
  return klant === "bokas" ? "food" : "product";
}

export function enrichTextToImagePrompt(
  userPrompt: string,
  type: PhotoStudioContentType
): string {
  const base = BASE_ENRICHMENT[type] ?? BASE_ENRICHMENT.product;
  return `${userPrompt.trim()}\n\n${base}`;
}

export function enrichImageToImagePrompt(
  userPrompt: string,
  type: PhotoStudioContentType = "product"
): string {
  const base = IMG2IMG_BASE[type] ?? IMG2IMG_BASE.product;
  return `${base}\n\nUser context: ${userPrompt.trim()}`;
}

export function buildTextToImagePromptParts(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): { system_prompt: string; prompt: string; fal_prompt: string } {
  const type = contentTypeForKlant(opts.klant);
  const enriched = enrichTextToImagePrompt(opts.userPrompt, type);
  const style = opts.style_hint?.trim();
  const prompt = style ? `${enriched}\n\nStyle: ${style}.` : enriched;
  const system_prompt = SYSTEM_CONTEXT[type];
  const fal_prompt = [system_prompt, prompt].join("\n\n");
  return { system_prompt, prompt, fal_prompt };
}

export function buildImageToImagePromptParts(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): { system_prompt: string; prompt: string; fal_prompt: string } {
  const type = contentTypeForKlant(opts.klant);
  const enriched = enrichImageToImagePrompt(opts.userPrompt, type);
  const style = opts.style_hint?.trim();
  const prompt = style ? `${enriched}\n\nStyle: ${style}.` : enriched;
  const system_prompt = SYSTEM_CONTEXT[type];
  const fal_prompt = [system_prompt, prompt].join("\n\n");
  return { system_prompt, prompt, fal_prompt };
}

/** @deprecated Use buildTextToImagePromptParts — kept for fixtures. */
export function buildTextToImageFalPrompt(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): string {
  return buildTextToImagePromptParts(opts).fal_prompt;
}

/** @deprecated Use buildImageToImagePromptParts — kept for fixtures. */
export function buildImageToImageFalPrompt(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): string {
  return buildImageToImagePromptParts(opts).fal_prompt;
}

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

function shouldLogPrompts(): boolean {
  return (
    process.env.PHOTO_STUDIO_LOG_PROMPTS === "1" ||
    process.env.NODE_ENV === "development"
  );
}

export function logFalPrompt(mode: PhotoStudioMode, prompt: string): void {
  const key = falKey();
  if (!shouldLogPrompts() && key) return;
  console.info(
    `[photo-studio/fal] ${mode}${key ? "" : " (no FAL key — prompt only)"}:\n${prompt}`
  );
}

async function parseFalResponse(
  res: Response
): Promise<{ ok: true; images: string[] } | { ok: false; error: string }> {
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: `fal.ai: ${res.status} — ${text.slice(0, 200)}` };
  }

  if (!res.ok) {
    const errObj = data as { detail?: string; message?: string };
    return {
      ok: false,
      error: errObj.detail || errObj.message || `fal HTTP ${res.status}`,
    };
  }

  const out = data as { images?: Array<{ url?: string }> };
  const images = (out.images ?? [])
    .map((im) => (typeof im.url === "string" ? im.url : ""))
    .filter(Boolean);
  return { ok: true, images };
}

type Nb2CallOpts = {
  endpoint: string;
  body: Record<string, unknown>;
};

async function callNb2(opts: Nb2CallOpts): Promise<
  { ok: true; images: string[] } | { ok: false; error: string }
> {
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
      signal: AbortSignal.timeout(180_000),
    });
    return parseFalResponse(res);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
    };
  }
}

function nb2BodyBase(opts: {
  prompt: string;
  system_prompt: string;
  aspectRatio: ContentStudioAspectRatio;
  quality: ContentStudioQuality;
  num_images: number;
  seed?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    system_prompt: opts.system_prompt,
    num_images: opts.num_images,
    aspect_ratio: opts.aspectRatio,
    resolution: opts.quality,
    output_format: "jpeg",
    limit_generations: true,
  };
  if (opts.seed != null) body.seed = opts.seed;
  return body;
}

export async function generateWithModel(opts: {
  model: ContentStudioModelId;
  userPrompt: string;
  klant: CompanyId;
  imageUrls?: string[];
  aspectRatio?: ContentStudioAspectRatio;
  quality?: ContentStudioQuality;
  count?: number;
  style_hint?: string;
  seed?: number;
}): Promise<FalBatchGenerateResult> {
  if (opts.model !== "nano-banana-2") {
    return { ok: false, error: `${opts.model} is nog niet beschikbaar (Phase B).` };
  }

  const user_prompt = opts.userPrompt.trim();
  const imageUrls = (opts.imageUrls ?? []).filter(Boolean);
  const isEdit = imageUrls.length > 0;
  const aspectRatio = opts.aspectRatio ?? "1:1";
  const quality = opts.quality ?? "2K";
  const count = Math.min(5, Math.max(1, opts.count ?? 1));

  const parts = isEdit
    ? buildImageToImagePromptParts({
        userPrompt: user_prompt,
        klant: opts.klant,
        style_hint: opts.style_hint,
      })
    : buildTextToImagePromptParts({
        userPrompt: user_prompt,
        klant: opts.klant,
        style_hint: opts.style_hint,
      });

  logFalPrompt(isEdit ? "image_to_image" : "text_to_image", parts.fal_prompt);

  const endpoint = isEdit ? NB2_EDIT : NB2_TXT2IMG;
  const modelId = isEdit ? NB2_EDIT : NB2_TXT2IMG;
  const allImages: string[] = [];

  const runBatch = async (num_images: number) => {
    const base = nb2BodyBase({
      prompt: parts.prompt,
      system_prompt: parts.system_prompt,
      aspectRatio,
      quality,
      num_images,
      seed: opts.seed,
    });
    if (isEdit) {
      base.image_urls = imageUrls;
    }
    return callNb2({ endpoint, body: base });
  };

  if (count <= 4) {
    const result = await runBatch(count);
    if (!result.ok) return result;
    allImages.push(...result.images);
  } else {
    const first = await runBatch(4);
    if (!first.ok) return first;
    allImages.push(...first.images.slice(0, 4));
    const second = await runBatch(1);
    if (!second.ok) return second;
    allImages.push(...second.images.slice(0, 1));
  }

  if (!allImages.length) {
    return { ok: false, error: "Geen afbeelding in fal-response" };
  }

  return {
    ok: true,
    images: allImages,
    fal_prompt: parts.fal_prompt,
    user_prompt,
    model: modelId,
  };
}

/** Backward-compatible single-image wrapper for carousel / menu-batch workflows. */
export async function generateWithFal(opts: {
  mode: PhotoStudioMode;
  prompt: string;
  image_url?: string;
  style_hint?: string;
  seed?: number;
  klant?: CompanyId;
}): Promise<FalGenerateResult> {
  const klant: CompanyId = opts.klant === "bokas" ? "bokas" : "fumero";
  const userPrompt = opts.prompt.trim();
  const imageUrls =
    opts.mode === "image_to_image" && opts.image_url?.trim()
      ? [opts.image_url.trim()]
      : [];

  if (opts.mode === "image_to_image" && !imageUrls.length) {
    return { ok: false, error: "image_url is verplicht voor image-to-image." };
  }

  const result = await generateWithModel({
    model: "nano-banana-2",
    userPrompt,
    klant,
    imageUrls,
    style_hint: opts.style_hint,
    seed: opts.seed,
    count: 1,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    url: result.images[0]!,
    prompt: result.fal_prompt,
    user_prompt: result.user_prompt,
    model: result.model,
  };
}

export function photoStudioPromptFixtures(): Record<string, string> {
  return {
    "1_txt2img_fumero_hhc_vape": buildTextToImageFalPrompt({
      userPrompt: "HHC vape premium",
      klant: "fumero",
    }),
    "2_txt2img_bokas_pancake": buildTextToImageFalPrompt({
      userPrompt: "Café pancake with berries",
      klant: "bokas",
    }),
    "3_img2img_fumero_vape_upload": buildImageToImageFalPrompt({
      userPrompt: "Verbeter deze productfoto.",
      klant: "fumero",
    }),
    "4_img2img_bokas_pancake_upload": buildImageToImageFalPrompt({
      userPrompt: "Zelfde gerecht, betere menu-foto.",
      klant: "bokas",
    }),
  };
}
