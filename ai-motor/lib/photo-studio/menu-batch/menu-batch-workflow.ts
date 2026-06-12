import { generateWithFal } from "@/lib/photo-studio/fal-generation";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { persistPhotoGenerationFromBuffer } from "@/lib/photo-studio/library";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { mapWithConcurrency } from "@/lib/photo-studio/concurrency";
import type { CompanyId } from "@/lib/types";
import type { MenuBatchItemResult } from "./menu-batch-types";

const MENU_BATCH_CONCURRENCY = 3;

async function processMenuItem(opts: {
  klant: CompanyId;
  source_image_url: string;
  index: number;
  styleHint: string;
  extra_prompt?: string;
  refCache: Map<string, string>;
}): Promise<MenuBatchItemResult> {
  const { klant, source_image_url, index, styleHint, extra_prompt, refCache } = opts;
  const resolved = await resolveImageUrlsForFal([source_image_url], refCache);
  if (!resolved.ok) {
    return { index: index + 1, source_image_url, error: resolved.error };
  }

  const userPrompt = extra_prompt?.trim() || "Zelfde gerecht, betere menu-foto.";
  const gen = await generateWithFal({
    mode: "image_to_image",
    klant,
    prompt: userPrompt,
    image_url: resolved.urls[0],
    style_hint: styleHint,
  });

  if (!gen.ok) {
    return { index: index + 1, source_image_url, error: gen.error };
  }

  try {
    const buffer = await downloadImageBuffer(gen.url);
    const persisted = await persistPhotoGenerationFromBuffer({
      klant,
      mode: "image_to_image",
      user_prompt: userPrompt,
      fal_prompt: gen.prompt,
      master_url: gen.url,
      source_image_url,
      workspace_preset: "menu_batch",
      buffer,
    });
    return {
      index: index + 1,
      source_image_url,
      generation_id: persisted.id,
      tracking_id: persisted.tracking_id,
      master_url: persisted.master_public_url,
    };
  } catch (e) {
    return {
      index: index + 1,
      source_image_url,
      error: e instanceof Error ? e.message : "opslaan mislukt",
    };
  }
}

export async function runMenuBatchWorkflow(opts: {
  klant: CompanyId;
  image_urls: string[];
  styling_params: string;
  extra_prompt?: string;
}): Promise<{ items: MenuBatchItemResult[] }> {
  const urls = opts.image_urls.filter(Boolean).slice(0, 20);
  const styleHint = [
    "Bokas restaurant menu photography — consistent lighting and plating style:",
    opts.styling_params,
  ].join(" ");

  const refCache = new Map<string, string>();
  const items = await mapWithConcurrency(urls, MENU_BATCH_CONCURRENCY, (url, i) =>
    processMenuItem({
      klant: opts.klant,
      source_image_url: url,
      index: i,
      styleHint,
      extra_prompt: opts.extra_prompt,
      refCache,
    })
  );

  return { items };
}
