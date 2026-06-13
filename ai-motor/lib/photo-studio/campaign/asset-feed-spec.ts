import type { CampaignGoal, CampaignPackData } from "@/lib/photo-studio/campaign/types";

/** Skeleton aligned with Meta Marketing API `asset_feed_spec` (manual upload / Fase 2 prep). */
export type MetaAssetFeedSpec = {
  /** Meta dynamic creative optimization hint */
  optimization_type: "REGULAR" | "LANGUAGE";
  ad_formats: string[];
  titles: Array<{ text: string; adlabel_id?: string }>;
  bodies: Array<{ text: string; adlabel_id?: string }>;
  descriptions: Array<{ text: string; adlabel_id?: string }>;
  images: Array<{
    filename: string;
    format: "1:1" | "4:5";
    angle: string;
    /** Relative path inside ZIP for Ads Manager manual upload */
    zip_path: string;
  }>;
  videos: Array<{
    filename: string;
    format: "9:16";
    angle: string;
    zip_path: string;
  }>;
  call_to_action_types: string[];
  link_urls: string[];
  /** Locale hint for multi-market beta */
  locale_hint: string;
  generated_at: string;
  pack_sku: string;
};

function goalToCtaTypes(goal: CampaignGoal): string[] {
  switch (goal) {
    case "verkoop":
      return ["SHOP_NOW", "ORDER_NOW"];
    case "bereik":
      return ["LEARN_MORE", "SEE_MORE"];
    case "retargeting":
      return ["SHOP_NOW", "GET_OFFER"];
    default:
      return ["SHOP_NOW"];
  }
}

/** Build Meta `asset_feed_spec` skeleton from a campaign pack (filenames, no live URLs). */
export function buildAssetFeedSpec(data: CampaignPackData): MetaAssetFeedSpec {
  const titles = data.copy.sets.map((s, i) => ({
    text: s.headline,
    adlabel_id: `angle_${s.angle}_v${s.hook_variant}`,
  }));

  const bodies = data.copy.sets.map((s) => ({
    text: s.primary_text,
    adlabel_id: `angle_${s.angle}_v${s.hook_variant}`,
  }));

  const descriptions = data.copy.sets.map((s) => ({
    text: s.description,
    adlabel_id: `angle_${s.angle}_v${s.hook_variant}`,
  }));

  const images = data.static_assets
    .filter((a) => a.filename)
    .map((a) => ({
      filename: a.filename,
      format: a.format,
      angle: a.concept_angle,
      zip_path: `static/${a.filename}`,
    }));

  const videos = data.video_assets
    .filter((a) => a.filename)
    .map((a) => ({
      filename: a.filename,
      format: "9:16" as const,
      angle: a.concept_angle,
      zip_path: `video/${a.filename}`,
    }));

  return {
    optimization_type: "REGULAR",
    ad_formats: ["SINGLE_IMAGE", "CAROUSEL", ...(videos.length ? ["SINGLE_VIDEO"] : [])],
    titles,
    bodies,
    descriptions,
    images,
    videos,
    call_to_action_types: goalToCtaTypes(data.goal),
    link_urls: [],
    locale_hint: "nl-NL",
    generated_at: data.copy.generated_at,
    pack_sku: data.sku,
  };
}
