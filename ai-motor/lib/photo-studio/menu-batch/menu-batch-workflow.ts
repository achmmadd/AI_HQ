import { generateWithFal } from "@/lib/photo-studio/fal-generation";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { persistPhotoGeneration } from "@/lib/photo-studio/library";
import type { CompanyId } from "@/lib/types";
import type { MenuBatchItemResult } from "./menu-batch-types";

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

  const items: MenuBatchItemResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const source_image_url = urls[i]!;
    const resolved = await resolveImageUrlsForFal([source_image_url]);
    if (!resolved.ok) {
      items.push({ index: i + 1, source_image_url, error: resolved.error });
      continue;
    }
    const gen = await generateWithFal({
      mode: "image_to_image",
      klant: opts.klant,
      prompt: opts.extra_prompt?.trim() || "Zelfde gerecht, betere menu-foto.",
      image_url: resolved.urls[0],
      style_hint: styleHint,
    });

    if (!gen.ok) {
      items.push({ index: i + 1, source_image_url, error: gen.error });
      continue;
    }

    try {
      const persisted = await persistPhotoGeneration({
        klant: opts.klant,
        mode: "image_to_image",
        user_prompt: opts.extra_prompt?.trim() || "Zelfde gerecht, betere menu-foto.",
        fal_prompt: gen.prompt,
        master_url: gen.url,
        source_image_url,
        workspace_preset: "menu_batch",
      });
      items.push({
        index: i + 1,
        source_image_url,
        generation_id: persisted.id,
        tracking_id: persisted.tracking_id,
        master_url: persisted.master_public_url,
      });
    } catch (e) {
      items.push({
        index: i + 1,
        source_image_url,
        error: e instanceof Error ? e.message : "opslaan mislukt",
      });
    }
  }

  return { items };
}
