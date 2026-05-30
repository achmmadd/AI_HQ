import type { CompanyId } from "@/lib/types";

export type PhotoStudioMode = "text_to_image" | "image_to_image";

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

/** NB2 native: 2K / 4K only (no 3K). */
export type ContentStudioQuality = "2K" | "4K";

export type ContentStudioSettings = {
  aspect_ratio: ContentStudioAspectRatio;
  quality: ContentStudioQuality;
  count: number;
  auto_variants: boolean;
  model: ContentStudioModelId;
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
  content_id: number | null;
  created_at: string;
  variants: Array<{
    aspect: string;
    public_url: string;
    width: number;
    height: number;
  }>;
};
