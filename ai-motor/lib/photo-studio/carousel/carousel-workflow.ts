import { randomInt } from "crypto";
import { generateWithFal } from "@/lib/photo-studio/fal-generation";
import {
  persistPhotoGeneration,
  persistPhotoGenerationFromBuffer,
} from "@/lib/photo-studio/library";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { applyCarouselSlideOverlay } from "@/lib/photo-studio/carousel/slide-overlay";
import type { CompanyId } from "@/lib/types";
import type { CarouselSlideInput, CarouselSlideResult } from "./carousel-types";

const SLIDE_COUNT = 5;

export async function runCarouselWorkflow(opts: {
  klant: CompanyId;
  base_prompt: string;
  background_lock: string;
  slides: CarouselSlideInput[];
  seed?: number;
}): Promise<{ seed: number; slides: CarouselSlideResult[]; errors: string[] }> {
  const seed = opts.seed ?? randomInt(1, 2_147_483_647);
  const slides = opts.slides.slice(0, SLIDE_COUNT);
  while (slides.length < SLIDE_COUNT) {
    slides.push({ headline: `Slide ${slides.length + 1}` });
  }

  const styleHint = [
    "Consistent carousel series — identical background and lighting:",
    opts.background_lock,
  ].join(" ");

  const results: CarouselSlideResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < SLIDE_COUNT; i++) {
    const slide = slides[i];
    const slidePrompt = [
      opts.base_prompt,
      `Carousel slide ${i + 1} of ${SLIDE_COUNT}.`,
      `Visual focus: ${slide.headline}.`,
      slide.subline ? `Context: ${slide.subline}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const gen = await generateWithFal({
      mode: "text_to_image",
      prompt: slidePrompt,
      style_hint: styleHint,
      seed,
    });

    if (!gen.ok) {
      errors.push(`Slide ${i + 1}: ${gen.error}`);
      continue;
    }

    try {
      let buffer = await downloadImageBuffer(gen.url);
      buffer = await applyCarouselSlideOverlay(
        buffer,
        slide.headline,
        slide.subline
      );
      const persisted = await persistPhotoGenerationFromBuffer({
        klant: opts.klant,
        mode: "text_to_image",
        prompt: slidePrompt,
        master_url: gen.url,
        seed,
        workspace_preset: "carousel",
        buffer,
      });

      results.push({
        slide_index: i + 1,
        headline: slide.headline,
        generation_id: persisted.id,
        tracking_id: persisted.tracking_id,
        master_url: persisted.master_public_url,
        variants: persisted.variants,
      });
    } catch (e) {
      errors.push(
        `Slide ${i + 1}: ${e instanceof Error ? e.message : "opslaan mislukt"}`
      );
    }
  }

  return { seed, slides: results, errors };
}
