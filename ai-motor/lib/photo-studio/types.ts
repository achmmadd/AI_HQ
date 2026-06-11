import type { CompanyId } from "@/lib/types";

export type PhotoStudioMode = "text_to_image" | "image_to_image";

export type ContentStudioMediaType = "image" | "video";

export type ContentStudioSkeletonMode = "generate" | "edit";

export type ContentStudioModelId =
  | "nano-banana-2"
  | "seedream-5-lite"
  | "gpt-image-2";

export type ContentStudioAspectRatio =
  | "1:1"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

/** UI quality — NB2 supports 2K/4K only; Seedream/GPT also support 3K. */
export type ContentStudioQuality = "2K" | "3K" | "4K";

export const MAX_REF_IMAGES: Record<ContentStudioModelId, number> = {
  "nano-banana-2": 14,
  "seedream-5-lite": 10,
  "gpt-image-2": 14,
};

export function qualitiesForModel(
  model: ContentStudioModelId
): ContentStudioQuality[] {
  return model === "nano-banana-2" ? ["2K", "4K"] : ["2K", "3K", "4K"];
}

export function normalizeQualityForModel(
  model: ContentStudioModelId,
  quality: ContentStudioQuality
): ContentStudioQuality {
  if (model === "nano-banana-2" && quality === "3K") return "2K";
  return quality;
}

export type CreationSpeedPreset = "snel" | "balans" | "beste";

export const CREATION_SPEED_PRESETS: Record<
  CreationSpeedPreset,
  { label: string; model: ContentStudioModelId; quality: ContentStudioQuality }
> = {
  snel: { label: "Snel", model: "nano-banana-2", quality: "2K" },
  balans: { label: "Balans", model: "gpt-image-2", quality: "2K" },
  beste: { label: "Beste", model: "gpt-image-2", quality: "4K" },
};

export type ContentStudioSettings = {
  aspect_ratio: ContentStudioAspectRatio;
  quality: ContentStudioQuality;
  count: number;
  auto_variants: boolean;
  model: ContentStudioModelId;
  /** Optional product/food studio enrichment — off by default for general creation. */
  brand_enhancement?: boolean;
  speed_preset?: CreationSpeedPreset;
};

export type PhotoStudioAspect =
  | "ig_1_1"
  | "stories_9_16"
  | "pinterest_2_3"
  | "hero_16_9";

export type PhotoStudioGenerationRow = {
  id: number;
  tracking_id: string;
  klant: CompanyId;
  mode: PhotoStudioMode;
  prompt: string;
  user_prompt: string;
  fal_prompt: string | null;
  source_image_url: string | null;
  seed: number | null;
  master_url: string;
  master_path: string | null;
  workspace_preset: string | null;
  content_id: number | null;
  created_at: string;
};

export type PhotoStudioVariantRow = {
  id: number;
  generation_id: number;
  aspect: PhotoStudioAspect;
  width: number;
  height: number;
  file_path: string;
  public_url: string;
  created_at: string;
};

export type FalGenerateResult =
  | {
      ok: true;
      url: string;
      prompt: string;
      user_prompt: string;
      model: string;
    }
  | { ok: false; error: string };

export type FalBatchGenerateResult =
  | {
      ok: true;
      images: string[];
      fal_prompt: string;
      user_prompt: string;
      model: string;
    }
  | { ok: false; error: string };

export type ContentStudioGridItem = {
  id: number;
  tracking_id: string;
  user_prompt: string;
  master_url: string;
  media_type: ContentStudioMediaType;
  content_id: number | null;
  created_at: string;
  variants: Array<{
    aspect: string;
    public_url: string;
    width: number;
    height: number;
  }>;
};

export type PromptBlockKey =
  | "subject"
  | "lighting"
  | "style"
  | "composition"
  | "mood";

export type PromptBlocks = Record<PromptBlockKey, string>;

export type ContentStudioPlatform =
  | "Website"
  | "Instagram"
  | "TikTok"
  | "Print";

export type ContentStudioTemplateCategory =
  | "Product"
  | "Food"
  | "Lifestyle"
  | "Banner"
  | "Social";

export type StarterTemplate = {
  id: string;
  title: string;
  category: ContentStudioTemplateCategory;
  platform: ContentStudioPlatform;
  blocks: PromptBlocks;
  aspect_ratio: ContentStudioAspectRatio;
  quality: ContentStudioQuality;
  tags: string[];
};

export type ContentStudioTemplateRow = StarterTemplate & {
  klant: CompanyId;
  thumbnail_url: string | null;
  is_recipe: boolean;
  created_at: string;
};

export type PromptVariationMode = "exact" | "light" | "bold";
