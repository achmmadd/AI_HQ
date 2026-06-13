import path from "path";
import { writeFile } from "fs/promises";
import { generateVideoWithFal } from "@/lib/photo-studio/fal-video";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { persistVideoGenerationFromBuffer } from "@/lib/photo-studio/library";
import { stat } from "fs/promises";
import type { QualityCheckResult } from "@/lib/photo-studio/quality/types";
import { buildVideoPrompt } from "@/lib/photo-studio/campaign/scene-presets";
import { campaignAssetFilename } from "@/lib/photo-studio/campaign/naming";
import { campaignPackDir } from "@/lib/photo-studio/campaign/paths";
import { FAL_VIDEO_TIMEOUT_MS } from "@/lib/photo-studio/generation-timeouts";
import type { AdConcept, CampaignGoal, CampaignVideoAsset } from "@/lib/photo-studio/campaign/types";
import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import type { CompanyId } from "@/lib/types";
import { downloadMediaBuffer } from "@/lib/photo-studio/download-master";
import { campaignAssetPublicUrl } from "@/lib/photo-studio/campaign/tenant-profile";

async function checkVideoFile(filePath: string): Promise<QualityCheckResult[]> {
  const fileStat = await stat(filePath);
  const checks: QualityCheckResult[] = [
    {
      id: "V1",
      criterion: "Video bestand",
      status: fileStat.size > 0 ? "pass" : "fail",
      message:
        fileStat.size > 0
          ? `MP4, ${(fileStat.size / (1024 * 1024)).toFixed(1)}MB`
          : "Leeg videobestand",
    },
    {
      id: "V2",
      criterion: "Reels formaat",
      status: "pass",
      message: "9:16 verticaal (Meta Reels)",
    },
  ];
  if (fileStat.size > 100 * 1024 * 1024) {
    checks.push({
      id: "V3",
      criterion: "Bestandsgrootte",
      status: "warn",
      message: "Video >100MB — comprimeer voor Meta upload",
    });
  }
  return checks;
}

function qualityPass(checks: QualityCheckResult[]): boolean {
  return !checks.some((c) => c.status === "fail");
}

export async function generateCampaignVideo(opts: {
  klant: CompanyId;
  packId: string;
  brandKit: BrandKitRow;
  concept: AdConcept;
  goal: CampaignGoal;
  sku: string;
  skipMedia?: boolean;
}): Promise<CampaignVideoAsset | null> {
  const { klant, packId, brandKit, concept, goal, sku, skipMedia } = opts;
  const productImage =
    brandKit.images.find((i) => i.role === "product")?.url ??
    brandKit.images[0]?.url ??
    null;

  const filename = campaignAssetFilename({
    brand: brandKit.name,
    sku,
    hook: concept.hook,
    format: "9:16",
    version: 1,
    ext: "mp4",
  });

  if (skipMedia) {
    return {
      concept_angle: concept.angle,
      hook: concept.hook,
      format: "9:16",
      filename,
      file_path: "",
      public_url: "",
      generation_id: null,
      quality_checks: [],
      quality_pass: false,
    };
  }

  const prompt = buildVideoPrompt(concept, goal, brandKit.name);
  let imageUrl: string | undefined;
  if (productImage) {
    const resolved = await resolveImageUrlsForFal([productImage]);
    if (resolved.ok) imageUrl = resolved.urls[0];
  }

  const result = await generateVideoWithFal({
    userPrompt: prompt,
    klant,
    imageUrl,
    brandEnhancement: true,
  });

  if (!result.ok) {
    return {
      concept_angle: concept.angle,
      hook: concept.hook,
      format: "9:16",
      filename,
      file_path: "",
      public_url: "",
      generation_id: null,
      quality_checks: [
        {
          id: "fal_video",
          criterion: "Video generatie",
          status: "fail",
          message: result.error,
        },
      ],
      quality_pass: false,
    };
  }

  const buffer = await downloadMediaBuffer(result.video_url, FAL_VIDEO_TIMEOUT_MS);
  const dir = campaignPackDir(packId);
  const filePath = path.join(dir, "video", filename);

  const [persisted] = await Promise.all([
    persistVideoGenerationFromBuffer({
      klant,
      mode: imageUrl ? "image_to_image" : "text_to_image",
      user_prompt: result.user_prompt,
      fal_prompt: result.fal_prompt,
      video_url: result.video_url,
      source_image_url: productImage,
      buffer,
    }),
    writeFile(filePath, buffer),
  ]);

  const checks = await checkVideoFile(filePath);

  return {
    concept_angle: concept.angle,
    hook: concept.hook,
    format: "9:16",
    filename,
    file_path: filePath,
    public_url: campaignAssetPublicUrl(packId, "video", filename),
    generation_id: persisted.id,
    quality_checks: checks,
    quality_pass: qualityPass(checks),
  };
}
