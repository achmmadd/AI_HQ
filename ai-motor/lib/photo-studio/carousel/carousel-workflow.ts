import { randomInt } from "crypto";
import { generateWithFal } from "@/lib/photo-studio/fal-generation";
import {
  persistPhotoGenerationFromBuffer,
} from "@/lib/photo-studio/library";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { applyCarouselSlideOverlay } from "@/lib/photo-studio/carousel/slide-overlay";
import type { CompanyId } from "@/lib/types";
import type { CarouselSlideInput, CarouselSlideResult } from "./carousel-types";

const SLIDE_COUNT = 5;

async function generateOneSlide(opts: {
  klant: CompanyId;
  base_prompt: string;
  styleHint: string;
  slide: CarouselSlideInput;
  index: number;
  seed: number;
}): Promise<{ result?: CarouselSlideResult; error?: string }> {
  const { klant, base_prompt, styleHint, slide, index, seed } = opts;
  const slidePrompt = [
    base_prompt,
    `Carousel slide ${index + 1} of ${SLIDE_COUNT}.`,
    `Visual focus: ${slide.headline}.`,
    slide.subline ? `Context: ${slide.subline}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const gen = await generateWithFal({
    mode: "text_to_image",
    klant,
    prompt: slidePrompt,
    style_hint: styleHint,
    seed,
  });

  if (!gen.ok) {
    return { error: `Slide ${index + 1}: ${gen.error}` };
  }

  try {
    let buffer = await downloadImageBuffer(gen.url);
    buffer = await applyCarouselSlideOverlay(buffer, slide.headline, slide.subline);
    const persisted = await persistPhotoGenerationFromBuffer({
      klant,
      mode: "text_to_image",
      user_prompt: slidePrompt,
      fal_prompt: gen.prompt,
      master_url: gen.url,
      seed,
      workspace_preset: "carousel",
      buffer,
    });

    return {
      result: {
        slide_index: index + 1,
        headline: slide.headline,
        generation_id: persisted.id,
        tracking_id: persisted.tracking_id,
        master_url: persisted.master_public_url,
        variants: persisted.variants,
      },
    };
  } catch (e) {
    return {
      error: `Slide ${index + 1}: ${e instanceof Error ? e.message : "opslaan mislukt"}`,
    };
  }
}

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

  const outcomes = await Promise.all(
    slides.map((slide, index) =>
      generateOneSlide({
        klant: opts.klant,
        base_prompt: opts.base_prompt,
        styleHint,
        slide,
        index,
        seed,
      })
    )
  );

  const results: CarouselSlideResult[] = [];
  const errors: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.result) results.push(outcome.result);
    if (outcome.error) errors.push(outcome.error);
  }

  results.sort((a, b) => a.slide_index - b.slide_index);
  return { seed, slides: results, errors };
}
