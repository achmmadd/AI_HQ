import type {
  ContentStudioPlatform,
  PromptBlocks,
  PromptVariationMode,
} from "@/lib/photo-studio/types";

/**
 * Composes a user-facing prompt from the 5 Content Studio blocks.
 *
 * Note: `lib/photo-studio/fal.ts` adds server-side enrichment on top of this
 * string (product/food base, system context, optional style_hint). The UI and
 * library store only this composed user prompt — never the fal-enriched text.
 */
export function composePromptFromBlocks(
  blocks: PromptBlocks,
  platform?: ContentStudioPlatform
): string {
  const segments = [
    blocks.subject.trim(),
    blocks.lighting.trim(),
    blocks.style.trim(),
    blocks.composition.trim(),
    blocks.mood.trim(),
  ].filter(Boolean);

  let prompt = segments.join(", ");

  if (platform) {
    const hints: Record<ContentStudioPlatform, string> = {
      Website: "geschikt voor e-commerce website",
      Instagram: "geschikt voor Instagram feed",
      TikTok: "geschikt voor TikTok verticaal formaat",
      Print: "geschikt voor hoogwaardige print",
    };
    if (prompt) prompt += `. ${hints[platform]}`;
    else prompt = hints[platform];
  }

  return prompt.trim();
}

const LIGHT_STYLE_SWAPS: Record<string, string[]> = {
  "luxury minimalist": ["refined minimalist", "elegant understated"],
  "modern casual": ["relaxed contemporary", "approachable modern"],
  "moody cinematic": ["soft cinematic", "atmospheric moody"],
  "clean editorial": ["polished editorial", "crisp editorial"],
  "bold graphic": ["vivid graphic", "striking graphic"],
};

const LIGHT_MOOD_SWAPS: Record<string, string[]> = {
  "aspirational professional": ["confident professional", "polished aspirational"],
  "approachable trendy": ["friendly trendy", "relatable approachable"],
  "premium luxury": ["refined luxury", "exclusive premium"],
  "energetic youthful": ["lively youthful", "dynamic energetic"],
  "calm trustworthy": ["serene trustworthy", "reassuring calm"],
};

function pickAlternate(value: string, swaps: Record<string, string[]>): string {
  const key = Object.keys(swaps).find((k) =>
    value.toLowerCase().includes(k.toLowerCase())
  );
  if (!key) return value;
  const alts = swaps[key];
  return alts[Math.floor(Math.random() * alts.length)] ?? value;
}

/** Client-side prompt variation for A/B-style generation (Phase 3). */
export function varyPromptBlocks(
  blocks: PromptBlocks,
  mode: PromptVariationMode
): PromptBlocks {
  if (mode === "exact") return { ...blocks };

  if (mode === "light") {
    return {
      ...blocks,
      style: pickAlternate(blocks.style, LIGHT_STYLE_SWAPS),
      mood: pickAlternate(blocks.mood, LIGHT_MOOD_SWAPS),
      lighting: blocks.lighting.includes("soft")
        ? blocks.lighting.replace(/soft/i, "gentle")
        : `${blocks.lighting}, subtle warmth`,
    };
  }

  // bold
  return {
    ...blocks,
    style: blocks.style.includes("bold")
      ? `${blocks.style}, high contrast`
      : `bold ${blocks.style}`,
    mood: blocks.mood.includes("energetic")
      ? `${blocks.mood}, striking`
      : `energetic ${blocks.mood}`,
    lighting: blocks.lighting.includes("dramatic")
      ? `${blocks.lighting}, intense shadows`
      : `dramatic ${blocks.lighting}`,
    composition: blocks.composition.includes("dynamic")
      ? blocks.composition
      : `dynamic ${blocks.composition}`,
  };
}

export const VARIATION_MODES: PromptVariationMode[] = [
  "exact",
  "light",
  "bold",
];
