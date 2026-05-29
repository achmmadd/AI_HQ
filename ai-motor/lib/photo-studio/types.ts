import type { CompanyId } from "@/lib/types";

export type PhotoStudioMode = "text_to_image" | "image_to_image";

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
  | { ok: true; url: string; prompt: string; model: string }
  | { ok: false; error: string };
