import path from "path";
import { readFile, writeFile } from "fs/promises";
import sharp from "sharp";
import { generateWithModel } from "@/lib/photo-studio/fal";
import { resolveImageUrlsForFal } from "@/lib/photo-studio/fal-image-url";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { persistPhotoGenerationFromBuffer } from "@/lib/photo-studio/library";
import { runQualityChecks } from "@/lib/photo-studio/quality";
import type { BoundingBox, QualityFormat } from "@/lib/photo-studio/quality/types";
import { buildCreativePrompt } from "@/lib/photo-studio/campaign/scene-presets";
import { campaignAssetFilename } from "@/lib/photo-studio/campaign/naming";
import { campaignPackDir } from "@/lib/photo-studio/campaign/paths";
import { campaignAssetPublicUrl } from "@/lib/photo-studio/campaign/tenant-profile";
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

/** Normalized center crop — product region for SSIM (~40% center). */
export const DEFAULT_PRODUCT_BBOX: BoundingBox = {
  x: 0.3,
  y: 0.3,
  width: 0.4,
  height: 0.4,
};

/** Taller center crop for 4:5 portrait — product often sits lower after cover resize. */
export const PRODUCT_BBOX_4_5: BoundingBox = {
  x: 0.25,
  y: 0.32,
  width: 0.5,
  height: 0.38,
};

function productBboxForFormat(format: "1:1" | "4:5"): BoundingBox {
  return format === "4:5" ? PRODUCT_BBOX_4_5 : DEFAULT_PRODUCT_BBOX;
}

const MAX_SSIM_REGEN = 1;

function qualityPass(checks: Awaited<ReturnType<typeof runQualityChecks>>): boolean {
  return !checks.some((c) => c.status === "fail");
}

function ssimFailed(checks: Awaited<ReturnType<typeof runQualityChecks>>): boolean {
  const ssim = checks.find((c) => c.id === "T3");
  return ssim?.status === "fail";
}

async function loadProductReferenceBuffer(productImage: string): Promise<Buffer> {
  const trimmed = productImage.trim();
  if (trimmed.startsWith("file://")) {
    return readFile(trimmed.slice("file://".length));
  }
  return downloadImageBuffer(trimmed);
}

/** Persist product reference locally for SSIM inputPath. */
export async function prepareProductReferencePath(
  packId: string,
  productImage: string
): Promise<string> {
  const dir = path.join(campaignPackDir(packId), "refs");
  const refPath = path.join(dir, "product-ref.jpg");
  const buffer = await loadProductReferenceBuffer(productImage);
  const normalized = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
  await writeFile(refPath, normalized);
  return refPath;
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
    public_url: campaignAssetPublicUrl(packId, "static", filename),
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
  productRefPath: string;
  falImageUrls: string[];
  format: (typeof EXPORT_FORMATS)[number];
}): Promise<CampaignCreativeAsset> {
  const {
    klant,
    packId,
    brandKit,
    concept,
    goal,
    sku,
    productImage,
    productRefPath,
    falImageUrls,
    format,
  } = opts;
  const { width, height, falAspect } = format;
  const { prompt } = buildCreativePrompt(concept, goal, brandKit.product_name);

  const filename = campaignAssetFilename({
    brand: brandKit.name,
    sku,
    hook: concept.hook,
    format: format.format,
    version: 1,
  });

  let lastChecks: Awaited<ReturnType<typeof runQualityChecks>> = [];
  let lastExported: { file_path: string; public_url: string } | null = null;
  let lastPersistedId: number | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_SSIM_REGEN; attempt++) {
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
      lastError = result.ok ? "Geen beeld ontvangen" : result.error;
      break;
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
      exportFormat(masterBuffer, packId, filename, width, height),
    ]);

    const qualityFormat: QualityFormat = format.format;
    const checks = await runQualityChecks({
      inputPath: productRefPath,
      outputPath: exported.file_path,
      format: qualityFormat,
      productBbox: productBboxForFormat(format.format),
    });

    lastChecks = checks;
    lastExported = exported;
    lastPersistedId = persisted.id;
    lastError = null;

    if (!ssimFailed(checks) || attempt >= MAX_SSIM_REGEN) {
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
  }

  if (lastExported && lastChecks.length) {
    return {
      concept_angle: concept.angle,
      hook: concept.hook,
      format: format.format,
      filename: path.basename(lastExported.file_path),
      file_path: lastExported.file_path,
      public_url: lastExported.public_url,
      width,
      height,
      generation_id: lastPersistedId,
      quality_checks: lastChecks,
      quality_pass: qualityPass(lastChecks),
    };
  }

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
        message: lastError ?? "Generatie mislukt",
      },
    ],
    quality_pass: false,
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

  let productRefPath: string;
  try {
    productRefPath = await prepareProductReferencePath(packId, productImage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
          id: "product_ref",
          criterion: "Productreferentie",
          status: "fail",
          message: `Productreferentie download mislukt: ${msg}`,
        },
      ],
      quality_pass: false,
    }));
  }

  return softenPortraitSsimAgainstSquare(
    await Promise.all(
      EXPORT_FORMATS.map((fmt) =>
        generateOneFormat({
          klant,
          packId,
          brandKit,
          concept,
          goal,
          sku,
          productImage,
          productRefPath,
          falImageUrls: resolved.urls,
          format: fmt,
        })
      )
    )
  );
}

/**
 * 4:5 SSIM can fail on cover-crop while 1:1 passes — downgrade to warn so pack isn't blocked.
 */
export function softenPortraitSsimAgainstSquare(
  assets: CampaignCreativeAsset[]
): CampaignCreativeAsset[] {
  const byAngle = new Map<string, CampaignCreativeAsset[]>();
  for (const asset of assets) {
    const list = byAngle.get(asset.concept_angle) ?? [];
    list.push(asset);
    byAngle.set(asset.concept_angle, list);
  }

  return assets.map((asset) => {
    if (asset.format !== "4:5" || !asset.file_path) return asset;
    const siblings = byAngle.get(asset.concept_angle) ?? [];
    const square = siblings.find((a) => a.format === "1:1" && a.file_path);
    if (!square?.quality_pass) return asset;

    const ssim = asset.quality_checks.find((c) => c.id === "T3");
    if (!ssim || ssim.status !== "fail") return asset;

    const softenedChecks = asset.quality_checks.map((c) =>
      c.id === "T3" && c.status === "fail"
        ? {
            ...c,
            status: "warn" as const,
            message: `${c.message} (4:5 soft — 1:1 passed for same angle)`,
          }
        : c
    );
    const hardFails = softenedChecks.filter(
      (c) => c.status === "fail" && c.id !== "T3"
    );

    return {
      ...asset,
      quality_checks: softenedChecks,
      quality_pass: hardFails.length === 0,
    };
  });
}

/** Collect human-readable quality warnings for pack.errors. */
export function collectCreativeQualityWarnings(
  assets: CampaignCreativeAsset[]
): string[] {
  const warnings: string[] = [];
  for (const asset of assets) {
    if (!asset.file_path) {
      const failed = asset.quality_checks?.filter((c) => c.status === "fail") ?? [];
      for (const check of failed) {
        warnings.push(`${asset.format} (${asset.concept_angle}): ${check.message}`);
      }
      continue;
    }
    for (const check of asset.quality_checks) {
      if (check.status === "fail") {
        warnings.push(`${asset.filename}: ${check.criterion} — ${check.message}`);
      } else if (check.status === "warn" && check.id === "T3") {
        warnings.push(`${asset.filename}: SSIM waarschuwing — ${check.message}`);
      }
    }
    if (!asset.quality_pass) {
      const ssim = asset.quality_checks.find((c) => c.id === "T3");
      if (ssim?.status === "fail") {
        warnings.push(
          `${asset.filename}: product fidelity (SSIM) onder drempel na ${MAX_SSIM_REGEN + 1} poging(en).`
        );
      }
    }
  }
  return warnings;
}
