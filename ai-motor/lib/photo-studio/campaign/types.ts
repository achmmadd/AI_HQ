import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import type { QualityCheckResult } from "@/lib/photo-studio/quality/types";

/** Campagnedoel — Meta Ads objective mapping. */
export type CampaignGoal = "verkoop" | "bereik" | "retargeting";

export const CAMPAIGN_GOALS: Array<{ id: CampaignGoal; label: string; description: string }> = [
  {
    id: "verkoop",
    label: "Verkoop",
    description: "Conversie en directe aankoop stimuleren",
  },
  {
    id: "bereik",
    label: "Bereik",
    description: "Bekendheid en nieuwe doelgroep bereiken",
  },
  {
    id: "retargeting",
    label: "Retargeting",
    description: "Bezoekers opnieuw activeren die nog niet kochten",
  },
];

export type AdAngleId = "prijs" | "vertrouwen" | "probleem_oplossing";

export type AdAngleTemplate = {
  id: AdAngleId;
  label: string;
  description: string;
  hookPatterns: string[];
  visualKeywords: string[];
};

export type AdConcept = {
  angle: AdAngleId;
  angle_label: string;
  hook: string;
  visual_direction: string;
  rationale: string;
};

export type AdStrategyResult = {
  goal: CampaignGoal;
  goal_label: string;
  brand_kit_id: string;
  product_name: string;
  concepts: AdConcept[];
  generated_at: string;
  source: "llm" | "template";
};

export type CopySet = {
  angle: AdAngleId;
  hook_variant: 1 | 2;
  headline: string;
  primary_text: string;
  description: string;
  cta_primary: string;
  cta_secondary: string;
  policy_warnings: string[];
  policy_pass: boolean;
};

export type CopyGeneratorResult = {
  goal: CampaignGoal;
  brand_kit_id: string;
  sets: CopySet[];
  generated_at: string;
  source: "llm" | "template";
};

export type CampaignCreativeAsset = {
  concept_angle: AdAngleId;
  hook: string;
  format: "1:1" | "4:5";
  filename: string;
  file_path: string;
  public_url: string;
  width: number;
  height: number;
  generation_id: number | null;
  quality_checks: QualityCheckResult[];
  quality_pass: boolean;
};

export type CampaignVideoAsset = {
  concept_angle: AdAngleId;
  hook: string;
  format: "9:16";
  filename: string;
  file_path: string;
  public_url: string;
  generation_id: number | null;
  quality_checks: QualityCheckResult[];
  quality_pass: boolean;
};

export type CampaignPackStatus = "draft" | "generating" | "ready" | "failed";

export type CampaignPackData = {
  brand_kit_id: string;
  brand_name: string;
  product_name: string;
  sku: string;
  goal: CampaignGoal;
  strategy: AdStrategyResult;
  copy: CopyGeneratorResult;
  static_assets: CampaignCreativeAsset[];
  video_assets: CampaignVideoAsset[];
  errors: string[];
};

export type CampaignPackRow = {
  id: string;
  klant: "fumero";
  status: CampaignPackStatus;
  zip_path: string | null;
  created_at: string;
  updated_at: string;
} & CampaignPackData;

export type BuildCampaignPackInput = {
  brandKit: BrandKitRow;
  goal: CampaignGoal;
  /** Skip fal image/video when keys missing or for dry-run */
  skip_media?: boolean;
  /** Only generate assets for these angles (default: all 3) */
  angles?: AdAngleId[];
  /** Reuse strategy from wizard (skips duplicate LLM call) */
  strategy?: AdStrategyResult;
};

export type CampaignPackProgress = {
  phase: string;
  message: string;
  static_done?: number;
  static_total?: number;
  video_done?: number;
  video_total?: number;
};
