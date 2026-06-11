import type {
  ContentStudioAspectRatio,
  ContentStudioPlatform,
  ContentStudioQuality,
  ContentStudioTemplateCategory,
  PromptBlockKey,
  PromptBlocks,
  StarterTemplate,
} from "@/lib/photo-studio/types";

export const PROMPT_BLOCK_LABELS: Record<PromptBlockKey, string> = {
  subject: "Onderwerp",
  lighting: "Belichting",
  style: "Stijl",
  composition: "Compositie",
  mood: "Sfeer",
};

export const BLOCK_DROPDOWN_OPTIONS: Record<PromptBlockKey, string[]> = {
  subject: [
    "product op witte achtergrond",
    "product in lifestyle context",
    "product detail close-up",
    "product met accessoires",
    "abstract / sfeerbeeld",
  ],
  lighting: [
    "studio soft key light",
    "natural golden hour",
    "dramatic side lighting",
    "flat lay overhead",
    "neon/editorial",
  ],
  style: [
    "luxury minimalist",
    "modern casual",
    "moody cinematic",
    "clean editorial",
    "bold graphic",
  ],
  composition: [
    "centered hero shot",
    "rule of thirds",
    "flat lay",
    "macro close-up",
    "wide establishing",
  ],
  mood: [
    "aspirational professional",
    "approachable trendy",
    "premium luxury",
    "energetic youthful",
    "calm trustworthy",
  ],
};

export const DEFAULT_PROMPT_BLOCKS: PromptBlocks = {
  subject: BLOCK_DROPDOWN_OPTIONS.subject[0]!,
  lighting: BLOCK_DROPDOWN_OPTIONS.lighting[0]!,
  style: BLOCK_DROPDOWN_OPTIONS.style[0]!,
  composition: BLOCK_DROPDOWN_OPTIONS.composition[0]!,
  mood: BLOCK_DROPDOWN_OPTIONS.mood[0]!,
};

export const CONTENT_STUDIO_PLATFORMS: ContentStudioPlatform[] = [
  "Website",
  "Instagram",
  "TikTok",
  "Print",
];

function starter(
  id: string,
  title: string,
  category: ContentStudioTemplateCategory,
  platform: ContentStudioPlatform,
  blocks: PromptBlocks,
  aspect_ratio: ContentStudioAspectRatio,
  quality: ContentStudioQuality,
  tags: string[]
): StarterTemplate {
  return { id, title, category, platform, blocks, aspect_ratio, quality, tags };
}

/** 8 Fumero starter templates — mix of general + product/campaign. */
export const FUMERO_STARTER_TEMPLATES: StarterTemplate[] = [
  starter(
    "fumero-creative-free",
    "Vrije creatie",
    "Lifestyle",
    "Website",
    {
      subject: "abstract geometric art, bold colors",
      lighting: "studio even flat lighting",
      style: "bold graphic high contrast",
      composition: "centered hero shot",
      mood: "energetic youthful",
    },
    "1:1",
    "2K",
    ["#creative", "#general"]
  ),
  starter(
    "fumero-portrait",
    "Portret",
    "Social",
    "Instagram",
    {
      subject: "professional headshot, neutral background",
      lighting: "studio soft key light",
      style: "clean editorial",
      composition: "centered hero shot",
      mood: "calm trustworthy",
    },
    "3:4",
    "2K",
    ["#portrait", "#social"]
  ),
  starter(
    "fumero-product-hero",
    "Product Hero",
    "Product",
    "Website",
    {
      subject: "premium HHC vape op witte achtergrond",
      lighting: "studio soft key light",
      style: "luxury minimalist clean",
      composition: "centered hero shot",
      mood: "aspirational professional",
    },
    "1:1",
    "2K",
    ["#product", "#studio", "#ecommerce"]
  ),
  starter(
    "fumero-instagram-story",
    "Instagram Story",
    "Lifestyle",
    "Instagram",
    {
      subject: "product in hand, urban lifestyle",
      lighting: "natural golden hour warm",
      style: "modern casual vibrant",
      composition: "lifestyle in-use shot",
      mood: "approachable trendy relatable",
    },
    "9:16",
    "2K",
    ["#lifestyle", "#instagram", "#authentic"]
  ),
  starter(
    "fumero-detail-closeup",
    "Detail Close-Up",
    "Product",
    "Website",
    {
      subject: "product texture en detail",
      lighting: "dramatic side lighting",
      style: "moody artistic cinematic",
      composition: "macro close-up shallow depth",
      mood: "premium luxury intricate",
    },
    "1:1",
    "4K",
    ["#detail", "#premium", "#craftsmanship"]
  ),
  starter(
    "fumero-zomer-campagne",
    "Zomer Campagne",
    "Lifestyle",
    "Instagram",
    {
      subject: "product met zomerse achtergrond",
      lighting: "bright natural sunlight",
      style: "vibrant energetic bold",
      composition: "flat lay overhead",
      mood: "energetic youthful fun",
    },
    "4:3",
    "2K",
    ["#zomer", "#campagne", "#lifestyle"]
  ),
  starter(
    "fumero-productlijn",
    "Productlijn Overzicht",
    "Product",
    "Website",
    {
      subject: "meerdere producten naast elkaar",
      lighting: "studio even flat lighting",
      style: "clean minimal white",
      composition: "symmetrical product row",
      mood: "professional trustworthy clean",
    },
    "16:9",
    "2K",
    ["#productlijn", "#overzicht", "#webshop"]
  ),
  starter(
    "fumero-tiktok-reel",
    "TikTok Reel Cover",
    "Social",
    "TikTok",
    {
      subject: "product in actie, beweging",
      lighting: "neon editorial dramatic",
      style: "bold graphic high contrast",
      composition: "dynamic angle dutch tilt",
      mood: "energetic bold youthful",
    },
    "9:16",
    "2K",
    ["#tiktok", "#reel", "#bold"]
  ),
  starter(
    "fumero-premium-gift",
    "Premium Gift",
    "Product",
    "Website",
    {
      subject: "product als luxe cadeau presentatie",
      lighting: "soft warm luxury lighting",
      style: "luxury gift premium packaging",
      composition: "centered elevated presentation",
      mood: "premium exclusive gifting",
    },
    "1:1",
    "4K",
    ["#gift", "#premium", "#luxury"]
  ),
  starter(
    "fumero-sfeerbeeld",
    "Sfeerbeeld",
    "Lifestyle",
    "Website",
    {
      subject: "abstracte sfeer passend bij merk",
      lighting: "moody atmospheric low key",
      style: "editorial moody artistic",
      composition: "wide atmospheric establishing",
      mood: "calm trustworthy premium",
    },
    "16:9",
    "2K",
    ["#sfeer", "#brand", "#editorial"]
  ),
];

export function starterTemplatesForKlant(klant: string): StarterTemplate[] {
  return klant === "fumero" ? FUMERO_STARTER_TEMPLATES : [];
}
