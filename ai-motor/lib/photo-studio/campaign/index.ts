export type {
  AdAngleId,
  AdConcept,
  AdStrategyResult,
  BuildCampaignPackInput,
  CampaignCreativeAsset,
  CampaignGoal,
  CampaignPackData,
  CampaignPackRow,
  CampaignPackStatus,
  CampaignVideoAsset,
  CopyGeneratorResult,
  CopySet,
} from "@/lib/photo-studio/campaign/types";

export {
  AD_ANGLE_TEMPLATES,
  generateAdStrategy,
} from "@/lib/photo-studio/campaign/ad-strategy";

export { generateCampaignCopy } from "@/lib/photo-studio/campaign/copy-generator";

export { buildCampaignPack } from "@/lib/photo-studio/campaign/pack-builder";

export {
  checkCopySetPolicy,
  checkMetaPolicy,
  sanitizeHeadline,
} from "@/lib/photo-studio/campaign/meta-policy";

export {
  SCENE_PRESETS,
  buildCreativePrompt,
  buildVideoPrompt,
  pickScenePreset,
} from "@/lib/photo-studio/campaign/scene-presets";

export {
  getCampaignPack,
  listCampaignPacks,
  saveCampaignPack,
} from "@/lib/photo-studio/campaign/storage";

export { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";

export { campaignAssetFilename, deriveSku } from "@/lib/photo-studio/campaign/naming";

export { FUMERO_BRAND_VOICE } from "@/lib/photo-studio/campaign/brand-voice";
