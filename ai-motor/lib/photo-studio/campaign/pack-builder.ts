import { readFile, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { buildAssetFeedSpec } from "@/lib/photo-studio/campaign/asset-feed-spec";
import { generateAdStrategy } from "@/lib/photo-studio/campaign/ad-strategy";
import { generateCampaignCopy } from "@/lib/photo-studio/campaign/copy-generator";
import { generateCampaignCreatives, collectCreativeQualityWarnings } from "@/lib/photo-studio/campaign/creative";
import { isCampaignTemplateOnly } from "@/lib/photo-studio/campaign/llm";
import { deriveSku } from "@/lib/photo-studio/campaign/naming";
import { campaignPackDir, campaignZipPath } from "@/lib/photo-studio/campaign/paths";
import { saveCampaignPack } from "@/lib/photo-studio/campaign/storage";
import { generateCampaignVideo } from "@/lib/photo-studio/campaign/video";
import { getCampaignStudioConfig } from "@/lib/photo-studio/campaign/studio-config";
import { resolveTenantKlant } from "@/lib/photo-studio/campaign/tenant-profile";
import { CAMPAIGN_VIDEO_TIMEOUT_MS } from "@/lib/photo-studio/generation-timeouts";
import type {
  AdAngleId,
  BuildCampaignPackInput,
  CampaignPackData,
  CampaignPackProgress,
  CampaignPackRow,
} from "@/lib/photo-studio/campaign/types";

function copyToCsv(data: CampaignPackData): string {
  const header =
    "angle,hook_variant,headline,primary_text,description,cta_primary,cta_secondary,policy_pass,policy_warnings";
  const rows = data.copy.sets.map((s) =>
    [
      s.angle,
      s.hook_variant,
      `"${s.headline.replace(/"/g, '""')}"`,
      `"${s.primary_text.replace(/"/g, '""')}"`,
      `"${s.description.replace(/"/g, '""')}"`,
      `"${s.cta_primary.replace(/"/g, '""')}"`,
      `"${s.cta_secondary.replace(/"/g, '""')}"`,
      s.policy_pass,
      `"${s.policy_warnings.join("; ").replace(/"/g, '""')}"`,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

function buildReadme(data: CampaignPackData, packId: string): string {
  return [
    `# Campaign Pack — ${data.brand_name}`,
    ``,
    `Pack ID: ${packId}`,
    `Brand: ${data.brand_name}`,
    `Product: ${data.product_name}`,
    `SKU: ${data.sku}`,
    `Doel: ${data.goal}`,
    `Gegenereerd: ${data.strategy.generated_at}`,
    ``,
    `## Concepten`,
    ...data.strategy.concepts.map(
      (c) => `- **${c.angle_label}**: ${c.hook}\n  Visual: ${c.visual_direction}`
    ),
    ``,
    `## Assets`,
    `- static/: ${data.static_assets.filter((a) => a.file_path).length} bestanden (1:1 + 4:5 per angle)`,
    `- video/: ${data.video_assets.filter((a) => a.file_path).length} Reels (9:16)`,
    `- copy.csv: ${data.copy.sets.length} copy sets`,
    `- meta/asset_feed_spec.json: Meta Marketing API skeleton (headlines, bodies, images, CTAs)`,
    ``,
    `## Kwaliteit`,
    ...data.static_assets
      .filter((a) => a.file_path)
      .map(
        (a) =>
          `- ${a.filename}: ${a.quality_pass ? "PASS" : "CHECK"} (${a.quality_checks.filter((c) => c.status === "fail").length} fails)`
      ),
    ``,
    data.errors.length ? `## Waarschuwingen\n${data.errors.map((e) => `- ${e}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildZip(packId: string, data: CampaignPackData): Promise<string> {
  const zip = new JSZip();
  const dir = campaignPackDir(packId);

  zip.file("copy.csv", copyToCsv(data));
  zip.file("README.md", buildReadme(data, packId));

  const metaFolder = zip.folder("meta");
  metaFolder?.file(
    "asset_feed_spec.json",
    JSON.stringify(buildAssetFeedSpec(data), null, 2)
  );

  const staticFolder = zip.folder("static");
  const videoFolder = zip.folder("video");

  for (const asset of data.static_assets) {
    if (!asset.file_path) continue;
    const buf = await readFile(asset.file_path);
    staticFolder?.file(asset.filename, buf);
  }

  for (const asset of data.video_assets) {
    if (!asset.file_path) continue;
    const buf = await readFile(asset.file_path);
    videoFolder?.file(asset.filename, buf);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipPath = campaignZipPath(packId);
  await writeFile(zipPath, zipBuffer);
  return zipPath;
}

export async function buildCampaignPack(
  packId: string,
  input: BuildCampaignPackInput,
  onProgress?: (progress: CampaignPackProgress) => void
): Promise<CampaignPackRow> {
  const { brandKit, goal, skip_media, angles, strategy: presetStrategy } = input;
  const klant = resolveTenantKlant(brandKit);
  const sku = deriveSku(brandKit.product_name, brandKit.id);
  const { fal_configured: falReady } = getCampaignStudioConfig();
  const skipMedia = skip_media ?? !falReady;
  const selectedAngles: AdAngleId[] =
    angles ?? (["prijs", "vertrouwen", "probleem_oplossing"] as AdAngleId[]);

  const errors: string[] = [];
  if (skipMedia) {
    errors.push(
      falReady
        ? "Media overgeslagen (skip_media=true)."
        : "FAL_KEY ontbreekt — media overgeslagen, alleen strategy + copy gegenereerd."
    );
  }

  campaignPackDir(packId);

  const templateOnly = isCampaignTemplateOnly();
  const llmOpts = templateOnly ? ({ templateOnly: true } as const) : undefined;

  let strategy = presetStrategy;
  if (!strategy) {
    onProgress?.({ phase: "strategy", message: "Advertentiestrategie genereren..." });
    strategy = await generateAdStrategy(brandKit, goal, llmOpts);
  }

  onProgress?.({ phase: "copy", message: "Copy sets genereren..." });
  const copy = await generateCampaignCopy(brandKit, strategy, llmOpts);

  const concepts = strategy.concepts.filter((c) => selectedAngles.includes(c.angle));
  const staticTotal = skipMedia ? 0 : concepts.length;
  const videoTotal = skipMedia ? 0 : concepts.length > 0 ? 1 : 0;

  const baseData = (): CampaignPackData => ({
    brand_kit_id: brandKit.id,
    brand_name: brandKit.name,
    product_name: brandKit.product_name,
    sku,
    goal,
    strategy,
    copy,
    static_assets: [],
    video_assets: [],
    errors: [...errors],
  });

  const saveDraft = (data: CampaignPackData) => {
    saveCampaignPack(packId, klant, data, "generating", null);
  };

  onProgress?.({
    phase: "static",
    message: skipMedia ? "Static creatives overgeslagen." : `Static 0/${staticTotal}...`,
    static_done: 0,
    static_total: staticTotal,
  });

  const static_assets = [];
  if (skipMedia) {
    for (const concept of concepts) {
      const assets = await generateCampaignCreatives({
        klant,
        packId,
        brandKit,
        concept,
        goal,
        sku,
        skipMedia: true,
      });
      static_assets.push(...assets);
    }
  } else {
    let staticDone = 0;
    const staticResults = await Promise.all(
      concepts.map(async (concept, index) => {
        onProgress?.({
          phase: "static",
          message: `Static ${index + 1}/${staticTotal} (${concept.angle_label})...`,
          static_done: staticDone,
          static_total: staticTotal,
        });
        const assets = await generateCampaignCreatives({
          klant,
          packId,
          brandKit,
          concept,
          goal,
          sku,
          skipMedia: false,
        });
        staticDone += 1;
        onProgress?.({
          phase: "static",
          message: `Static ${staticDone}/${staticTotal} klaar`,
          static_done: staticDone,
          static_total: staticTotal,
        });
        return assets;
      })
    );
    for (const assets of staticResults) {
      static_assets.push(...assets);
    }
  }

  const qualityWarnings = collectCreativeQualityWarnings(static_assets);
  if (qualityWarnings.length) {
    errors.push(...qualityWarnings);
  }

  saveDraft({ ...baseData(), static_assets, video_assets: [] });

  const video_assets = [];
  const primaryConcept = concepts[0];
  if (primaryConcept) {
    onProgress?.({
      phase: "video",
      message: skipMedia ? "Video overgeslagen." : "Video 0/1 genereren...",
      static_done: staticTotal,
      static_total: staticTotal,
      video_done: 0,
      video_total: videoTotal,
    });
    const videoTimeoutMs = CAMPAIGN_VIDEO_TIMEOUT_MS;
    let video: Awaited<ReturnType<typeof generateCampaignVideo>> = null;
    try {
      video = await Promise.race([
        generateCampaignVideo({
          klant,
          packId,
          brandKit,
          concept: primaryConcept,
          goal,
          sku,
          skipMedia,
        }),
        new Promise<null>((_, reject) => {
          const t = setTimeout(() => {
            reject(
              new Error(
                `Video-generatie time-out na ${Math.round(videoTimeoutMs / 1000)} seconden — probeer “Alleen strategy + copy”.`
              )
            );
          }, videoTimeoutMs);
          if (typeof t.unref === "function") t.unref();
        }),
      ]);
    } catch (videoErr) {
      const msg = videoErr instanceof Error ? videoErr.message : String(videoErr);
      errors.push(msg);
    }
    if (video) video_assets.push(video);
    onProgress?.({
      phase: "video",
      message: skipMedia ? "Video overgeslagen." : "Video 1/1 klaar",
      static_done: staticTotal,
      static_total: staticTotal,
      video_done: skipMedia ? 0 : video ? 1 : 0,
      video_total: videoTotal,
    });
  }

  const data: CampaignPackData = {
    brand_kit_id: brandKit.id,
    brand_name: brandKit.name,
    product_name: brandKit.product_name,
    sku,
    goal,
    strategy,
    copy,
    static_assets,
    video_assets,
    errors,
  };

  onProgress?.({ phase: "zip", message: "ZIP samenstellen..." });
  let zipPath: string | null = null;
  try {
    zipPath = await buildZip(packId, data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`ZIP export mislukt: ${msg}`);
    data.errors = errors;
  }

  return saveCampaignPack(packId, klant, data, zipPath ? "ready" : "failed", zipPath);
}

export { generateAdStrategy, generateCampaignCopy };
