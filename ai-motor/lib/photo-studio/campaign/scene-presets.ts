import type { PromptBlocks } from "@/lib/photo-studio/types";
import { composePromptFromBlocks } from "@/lib/photo-studio/compose-template-prompt";
import type { AdAngleId, AdConcept, CampaignGoal } from "@/lib/photo-studio/campaign/types";

export type ScenePreset = {
  id: string;
  label: string;
  productTypes: string[];
  blocks: PromptBlocks;
  aspect_ratio: "1:1" | "3:4" | "9:16";
};

/** Scene presets for environment swap — maps angles + goals to prompt blocks. */
export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "studio-hero",
    label: "Studio Hero",
    productTypes: ["vape", "product", "default"],
    blocks: {
      subject: "premium HHC product op witte achtergrond",
      lighting: "studio soft key light",
      style: "luxury minimalist clean",
      composition: "centered hero shot",
      mood: "aspirational professional",
    },
    aspect_ratio: "1:1",
  },
  {
    id: "lifestyle-evening",
    label: "Avond Lifestyle",
    productTypes: ["vape", "lifestyle", "default"],
    blocks: {
      subject: "product in cozy evening lifestyle setting",
      lighting: "warm ambient low key",
      style: "modern casual premium",
      composition: "lifestyle in-use shot",
      mood: "calm trustworthy",
    },
    aspect_ratio: "3:4",
  },
  {
    id: "trust-editorial",
    label: "Trust Editorial",
    productTypes: ["vape", "edible", "default"],
    blocks: {
      subject: "product with premium packaging detail",
      lighting: "clean editorial soft light",
      style: "clean editorial trustworthy",
      composition: "macro close-up shallow depth",
      mood: "premium luxury",
    },
    aspect_ratio: "1:1",
  },
  {
    id: "summer-campaign",
    label: "Zomer Campagne",
    productTypes: ["lifestyle", "default"],
    blocks: {
      subject: "product met zomerse outdoor achtergrond",
      lighting: "bright natural sunlight",
      style: "vibrant energetic bold",
      composition: "flat lay overhead",
      mood: "energetic youthful fun",
    },
    aspect_ratio: "3:4",
  },
  {
    id: "reel-motion",
    label: "Reel Cover",
    productTypes: ["vape", "default"],
    blocks: {
      subject: "product in dynamic lifestyle scene",
      lighting: "neon editorial dramatic",
      style: "bold graphic high contrast",
      composition: "dynamic angle dutch tilt",
      mood: "energetic bold youthful",
    },
    aspect_ratio: "9:16",
  },
];

const ANGLE_PRESET_MAP: Record<AdAngleId, string> = {
  prijs: "studio-hero",
  vertrouwen: "trust-editorial",
  probleem_oplossing: "lifestyle-evening",
};

const GOAL_PRESET_OVERRIDE: Partial<Record<CampaignGoal, string>> = {
  bereik: "summer-campaign",
  retargeting: "trust-editorial",
};

function detectProductType(productName: string): string {
  const lower = String(productName ?? "").toLowerCase();
  if (/vape|pen|cart|disposable/i.test(lower)) return "vape";
  if (/gumm|edible|snoep|choco/i.test(lower)) return "edible";
  if (/olie|tincture|drop/i.test(lower)) return "lifestyle";
  return "default";
}

export function pickScenePreset(
  concept: AdConcept,
  goal: CampaignGoal,
  productName: string
): ScenePreset {
  const productType = detectProductType(productName);
  const overrideId = GOAL_PRESET_OVERRIDE[goal];
  const presetId = overrideId ?? ANGLE_PRESET_MAP[concept.angle];
  const preset =
    SCENE_PRESETS.find((p) => p.id === presetId) ?? SCENE_PRESETS[0]!;

  const subjectOverride = concept.visual_direction.slice(0, 200);
  return {
    ...preset,
    blocks: {
      ...preset.blocks,
      subject: subjectOverride || preset.blocks.subject,
      mood: String(concept.hook ?? "").toLowerCase().includes("premium")
        ? "premium luxury"
        : preset.blocks.mood,
    },
  };
}

export function buildCreativePrompt(
  concept: AdConcept,
  goal: CampaignGoal,
  productName: string
): { prompt: string; preset: ScenePreset; aspect_ratio: "1:1" | "3:4" | "9:16" } {
  const preset = pickScenePreset(concept, goal, productName);
  const prompt = [
    composePromptFromBlocks(preset.blocks, "Instagram"),
    `Behoud het product exact zoals op de referentiefoto. Environment swap: ${concept.visual_direction}.`,
    `Advertentie-hook context: "${concept.hook}".`,
  ].join(" ");
  return { prompt, preset, aspect_ratio: preset.aspect_ratio };
}

export function buildVideoPrompt(
  concept: AdConcept,
  goal: CampaignGoal,
  brandName: string
): string {
  const brand = brandName.trim() || "Brand";
  return [
    `Korte Meta Reels advertentie voor ${brand}. Hook: "${concept.hook}".`,
    `Doel: ${goal}. Subtle product motion, premium e-commerce quality.`,
    concept.visual_direction,
    "9:16 vertical, geen tekst-overlays, geen gezondheidsclaims.",
  ].join(" ");
}
