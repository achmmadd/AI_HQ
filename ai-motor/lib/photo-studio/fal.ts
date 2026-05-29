import type { CompanyId } from "@/lib/types";
import type { FalGenerateResult, PhotoStudioMode } from "@/lib/photo-studio/types";

const TXT2IMG_MODEL = "fal-ai/flux/schnell";
const IMG2IMG_MODEL = "fal-ai/flux-kontext/dev";

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

/** fumero → product, bokas → food */
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

export function buildTextToImageFalPrompt(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): string {
  const type = contentTypeForKlant(opts.klant);
  const enriched = enrichTextToImagePrompt(opts.userPrompt, type);
  const parts = [SYSTEM_CONTEXT[type], enriched];
  const style = opts.style_hint?.trim();
  if (style) parts.push(`Style: ${style}.`);
  return parts.join("\n\n");
}

export function buildImageToImageFalPrompt(opts: {
  userPrompt: string;
  klant: CompanyId;
  style_hint?: string;
}): string {
  const type = contentTypeForKlant(opts.klant);
  const enriched = enrichImageToImagePrompt(opts.userPrompt, type);
  const style = opts.style_hint?.trim();
  if (!style) return enriched;
  return `${enriched}\n\nStyle: ${style}.`;
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

export async function generateWithFal(opts: {
  mode: PhotoStudioMode;
  prompt: string;
  image_url?: string;
  style_hint?: string;
  seed?: number;
  klant?: CompanyId;
}): Promise<FalGenerateResult> {
  const klant: CompanyId = opts.klant === "bokas" ? "bokas" : "fumero";
  const key = falKey();
  const userPrompt = opts.prompt.trim();

  if (opts.mode === "text_to_image") {
    const fullPrompt = buildTextToImageFalPrompt({
      userPrompt,
      klant,
      style_hint: opts.style_hint,
    });
    logFalPrompt("text_to_image", fullPrompt);

    if (!key) {
      return { ok: false, error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." };
    }

    const body: Record<string, unknown> = {
      prompt: fullPrompt,
      num_images: 1,
      image_size: "square_hd",
    };
    if (opts.seed != null) body.seed = opts.seed;

    try {
      const res = await fetch(`https://fal.run/${TXT2IMG_MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      const parsed = await parseFalResponse(res);
      if (!parsed.ok) return parsed;
      const url = parsed.images[0];
      if (!url) return { ok: false, error: "Geen afbeelding in fal-response" };
      return { ok: true, url, prompt: fullPrompt, model: TXT2IMG_MODEL };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
      };
    }
  }

  const image_url = opts.image_url?.trim() ?? "";
  if (!image_url) {
    return { ok: false, error: "image_url is verplicht voor image-to-image." };
  }

  const kontextPrompt = buildImageToImageFalPrompt({
    userPrompt,
    klant,
    style_hint: opts.style_hint,
  });
  logFalPrompt("image_to_image", kontextPrompt);

  if (!key) {
    return { ok: false, error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." };
  }

  try {
    const res = await fetch(`https://fal.run/${IMG2IMG_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: kontextPrompt,
        image_url,
        num_images: 1,
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const parsed = await parseFalResponse(res);
    if (!parsed.ok) return parsed;
    const url = parsed.images[0];
    if (!url) return { ok: false, error: "Geen afbeelding in fal-response" };
    return { ok: true, url, prompt: kontextPrompt, model: IMG2IMG_MODEL };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
    };
  }
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

/** Fixture prompts for manual / script verification (no API key). */
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
