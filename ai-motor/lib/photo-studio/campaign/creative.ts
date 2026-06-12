import path from "path";
import { writeFile } from "fs/promises";
import sharp from "sharp";
import { generateWithModel } from "@/lib/photo-studio/fal";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { persistPhotoGenerationFromBuffer } from "@/lib/photo-studio/library";
import { runQualityChecks } from "@/lib/photo-studio/quality";
import type { QualityFormat } from "@/lib/photo-studio/quality/types";
import { buildCreativePrompt } from "@/lib/photo-studio/campaign/scene-presets";
import { campaignAssetFilename } from "@/lib/photo-studio/campaign/naming";
import { campaignPackDir } from "@/lib/photo-studio/campaign/paths";
import type {
  AdConcept,
  CampaignCreativeAsset,
  CampaignGoal,
} from "@/lib/photo-studio/campaign/types";
import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import type { CompanyId } from "@/lib/types";

const EXPORT_FORMATS: Array<{
  format: "1:1" | "4:5";
  width: number;
  height: number;
  falAspect: "1:1" | "3:4";
}> = [
  { format: "1:1", width: 1080, height: 1080, falAspect: "1:1" },
  { format: "4:5", width: 1080, height: 1350, falAspect: "3:4" },
];

function qualityPass(checks: Awaited<ReturnType<typeof runQualityChecks>>): boolean {
  return !checks.some((c) => c.status === "fail");
}

async function exportFormat(
  masterBuffer: Buffer,
  packId: string,
  filename: string,
  width: number,
  height: number
): Promise<{ file_path: string; public_url: string }> {
  const dir = campaignPackDir(packId);
  const filePath = path.join(dir, "static", filename);
  const resized = await sharp(masterBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();
  await writeFile(filePath, resized);
  return {
    file_path: filePath,
    public_url: `/api/fumero/campaign/assets/${encodeURIComponent(packId)}/static/${encodeURIComponent(filename)}`,
  };
}

async function generateOneFormat(opts: {
  klant: CompanyId;
  packId: string;
  brandKit: BrandKitRow;
  concept: AdConcept;
  goal: CampaignGoal;
  sku: string;
  productImage: string;
  falImageUrls: string[];
  format: (typeof EXPORT_FORMATS)[number];
}): Promise<CampaignCreativeAsset> {
  const { klant, packId, brandKit, concept, goal, sku, productImage, falImageUrls, format } =
    opts;
  const { width, height, falAspect } = format;
  const { prompt } = buildCreativePrompt(concept, goal, brandKit.product_name);

  const result = await generateWithModel({
    model: "nano-banana-2",
    userPrompt: prompt,
    klant,
    imageUrls: falImageUrls,
    aspectRatio: falAspect,
    quality: "2K",
    count: 1,
    brandEnhancement: true,
  });

  if (!result.ok || !result.images[0]) {
    return {
      concept_angle: concept.angle,
      hook: concept.hook,
      format: format.format,
      filename: "",
      file_path: "",
      public_url: "",
      width,
      height,
      generation_id: null,
      quality_checks: [
        {
          id: "fal",
          criterion: "Generatie",
          status: "fail",
          message: result.ok ? "Geen beeld ontvangen" : result.error,
        },
      ],
      quality_pass: false,
    };
  }

  const masterBuffer = await downloadImageBuffer(result.images[0]);
  const [persisted, exported] = await Promise.all([
    persistPhotoGenerationFromBuffer({
      klant,
      mode: "image_to_image",
      user_prompt: result.user_prompt,
      fal_prompt: result.fal_prompt,
      master_url: result.images[0],
      source_image_url: productImage,
      auto_variants: false,
      buffer: masterBuffer,
    }),
    exportFormat(
      masterBuffer,
      packId,
      campaignAssetFilename({
        brand: brandKit.name,
        sku,
        hook: concept.hook,
        format: format.format,
        version: 1,
      }),
      width,
      height
    ),
  ]);

  const qualityFormat: QualityFormat = format.format;
  const checks = await runQualityChecks({
    inputPath: undefined,
    outputPath: exported.file_path,
    format: qualityFormat,
  });

  return {
    concept_angle: concept.angle,
    hook: concept.hook,
    format: format.format,
    filename: path.basename(exported.file_path),
    file_path: exported.file_path,
    public_url: exported.public_url,
    width,
    height,
    generation_id: persisted.id,
    quality_checks: checks,
    quality_pass: qualityPass(checks),
  };
}

export async function generateCampaignCreatives(opts: {
  klant: CompanyId;
  packId: string;
  brandKit: BrandKitRow;
  concept: AdConcept;
  goal: CampaignGoal;
  sku: string;
  skipMedia?: boolean;
}): Promise<CampaignCreativeAsset[]> {
  const { klant, packId, brandKit, concept, goal, sku, skipMedia } = opts;
  const productImage =
    brandKit.images.find((i) => i.role === "product")?.url ??
    brandKit.images[0]?.url ??
    null;

  if (skipMedia || !productImage) {
    return EXPORT_FORMATS.map(({ format, width, height }) => ({
      concept_angle: concept.angle,
      hook: concept.hook,
      format,
      filename: campaignAssetFilename({
        brand: brandKit.name,
        sku,
        hook: concept.hook,
        format,
        version: 1,
      }),
      file_path: "",
      public_url: "",
      width,
      height,
      generation_id: null,
      quality_checks: [],
      quality_pass: false,
    }));
  }

  const refCache = new Map<string, string>();
  const resolved = await resolveImageUrlsForFal([productImage], refCache);
  if (!resolved.ok) {
    return EXPORT_FORMATS.map(({ format, width, height }) => ({
      concept_angle: concept.angle,
      hook: concept.hook,
      format,
      filename: "",
      file_path: "",
      public_url: "",
      width,
      height,
      generation_id: null,
      quality_checks: [
        {
          id: "resolve",
          criterion: "Referentiebeeld",
          status: "fail",
          message: resolved.error,
        },
      ],
      quality_pass: false,
    }));
  }

  return Promise.all(
    EXPORT_FORMATS.map((fmt) =>
      generateOneFormat({
        klant,
        packId,
        brandKit,
        concept,
        goal,
        sku,
        productImage,
        falImageUrls: resolved.urls,
        format: fmt,
      })
    )
  );
}
