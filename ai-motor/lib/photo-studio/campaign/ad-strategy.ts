import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import { FUMERO_BRAND_VOICE, FUMERO_FACTS } from "@/lib/photo-studio/campaign/brand-voice";
import { callCampaignLlmJson } from "@/lib/photo-studio/campaign/llm";
import type {
  AdAngleId,
  AdAngleTemplate,
  AdConcept,
  AdStrategyResult,
  CampaignGoal,
} from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";

export const AD_ANGLE_TEMPLATES: Record<AdAngleId, AdAngleTemplate> = {
  prijs: {
    id: "prijs",
    label: "Prijs",
    description: "Waarde, scherpe prijs, premium voor minder",
    hookPatterns: [
      "Premium kwaliteit, eerlijke prijs",
      "Scherp geprijsd — vandaag besteld, morgen thuis",
      "Meer beleving, minder gedoe",
    ],
    visualKeywords: [
      "clean product hero op wit",
      "subtle price-tag compositie",
      "heldere studio-belichting",
    ],
  },
  vertrouwen: {
    id: "vertrouwen",
    label: "Vertrouwen",
    description: "Reviews, betrouwbaarheid, discrete levering",
    hookPatterns: [
      "Vertrouwd door duizenden klanten",
      "Discreet, snel en betrouwbaar",
      "Premium kwaliteit waar je op kunt rekenen",
    ],
    visualKeywords: [
      "trustworthy lifestyle context",
      "premium packaging close-up",
      "calm editorial sfeer",
    ],
  },
  probleem_oplossing: {
    id: "probleem_oplossing",
    label: "Probleem-oplossing",
    description: "Pain point → oplossing, avondroutine upgrade",
    hookPatterns: [
      "Upgrade je avondroutine",
      "Eindelijk ontspanning na een lange dag",
      "Jouw moment, beter geregeld",
    ],
    visualKeywords: [
      "relatable evening lifestyle scene",
      "product in-use moment",
      "warm ambient lighting",
    ],
  },
};

const GOAL_VISUAL_HINTS: Record<CampaignGoal, string> = {
  verkoop: "Directe conversie: product centraal, duidelijke koopintentie, urgency zonder schreeuwerig.",
  bereik: "Breed bereik: aspirational lifestyle, merkherkenning, scroll-stoppend beeld.",
  retargeting: "Herkenning: product + subtiele reminder, vertrouwd merkbeeld, zachte CTA.",
};

function goalLabel(goal: CampaignGoal): string {
  return CAMPAIGN_GOALS.find((g) => g.id === goal)?.label ?? goal;
}

function buildBrandContext(kit: BrandKitRow): string {
  const reviews = kit.reviews
    .slice(0, 3)
    .map((r) => r.text?.slice(0, 120))
    .filter(Boolean);
  const colors = kit.colors.map((c) => c.hex).join(", ");
  return JSON.stringify(
    {
      product: kit.product_name,
      price: kit.price ? `${kit.price} ${kit.currency}` : null,
      description: kit.description ? String(kit.description).slice(0, 400) : "",
      reviews,
      colors,
      source_url: kit.source_url,
    },
    null,
    2
  );
}

function templateConcept(
  angle: AdAngleTemplate,
  kit: BrandKitRow,
  goal: CampaignGoal,
  hookIndex: number
): AdConcept {
  const hook =
    angle.hookPatterns[hookIndex % angle.hookPatterns.length]!.replace(
      "Premium kwaliteit",
      kit.product_name ? `${kit.product_name} — premium kwaliteit` : "Premium kwaliteit"
    );
  const visual = [
    ...angle.visualKeywords,
    GOAL_VISUAL_HINTS[goal],
    kit.colors[0]?.hex ? `accentkleur ${kit.colors[0].hex}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    angle: angle.id,
    angle_label: angle.label,
    hook,
    visual_direction: visual,
    rationale: `${angle.description} — geoptimaliseerd voor ${String(goalLabel(goal)).toLowerCase()}.`,
  };
}

function buildTemplateStrategy(kit: BrandKitRow, goal: CampaignGoal): AdStrategyResult {
  const concepts = (Object.values(AD_ANGLE_TEMPLATES) as AdAngleTemplate[]).map(
    (angle, i) => templateConcept(angle, kit, goal, i)
  );
  return {
    goal,
    goal_label: goalLabel(goal),
    brand_kit_id: kit.id,
    product_name: kit.product_name,
    concepts,
    generated_at: new Date().toISOString(),
    source: "template",
  };
}

type LlmStrategyResponse = {
  concepts?: Array<{
    angle?: string;
    hook?: string;
    visual_direction?: string;
    rationale?: string;
  }>;
};

export async function generateAdStrategy(
  kit: BrandKitRow,
  goal: CampaignGoal,
  opts?: { templateOnly?: boolean }
): Promise<AdStrategyResult> {
  if (opts?.templateOnly) {
    return buildTemplateStrategy(kit, goal);
  }

  const angles = Object.values(AD_ANGLE_TEMPLATES);
  const system = `Je bent een senior Meta Ads strateeg voor ${FUMERO_BRAND_VOICE}
Maak precies 3 advertentieconcepten — één per angle: prijs, vertrouwen, probleem_oplossing.
Antwoord ALLEEN met geldig JSON:
{"concepts":[{"angle":"prijs|vertrouwen|probleem_oplossing","hook":"...","visual_direction":"...","rationale":"..."}]}
Hooks: kort, Nederlands, geen gezondheidsclaims, geen emoji.
Visual direction: concreet beeld/scene voor image-to-image generatie.`;

  const user = [
    `Campagnedoel: ${goalLabel(goal)} (${goal})`,
    `Doel-hint: ${GOAL_VISUAL_HINTS[goal]}`,
    "",
    "Brand Kit:",
    buildBrandContext(kit),
    "",
    "Angle templates:",
    angles
      .map(
        (a) =>
          `- ${a.id} (${a.label}): ${a.description}. Hooks: ${a.hookPatterns.join(" | ")}`
      )
      .join("\n"),
    "",
    "Feiten:",
    FUMERO_FACTS.join("\n"),
  ].join("\n");

  const llm = await callCampaignLlmJson<LlmStrategyResponse>({
    system,
    user,
    n8nType: "campaign_strategy",
  });

  if (!llm.ok) {
    return buildTemplateStrategy(kit, goal);
  }

  const validAngles = new Set<AdAngleId>(["prijs", "vertrouwen", "probleem_oplossing"]);
  const concepts: AdConcept[] = [];

  for (const raw of llm.data.concepts ?? []) {
    const angleId = raw.angle as AdAngleId;
    if (!validAngles.has(angleId)) continue;
    const template = AD_ANGLE_TEMPLATES[angleId];
    concepts.push({
      angle: angleId,
      angle_label: template.label,
      hook: String(raw.hook ?? template.hookPatterns[0]).trim().slice(0, 120),
      visual_direction: String(
        raw.visual_direction ?? template.visualKeywords.join(", ")
      ).trim(),
      rationale: String(raw.rationale ?? template.description).trim(),
    });
  }

  for (const template of angles) {
    if (!concepts.some((c) => c.angle === template.id)) {
      concepts.push(templateConcept(template, kit, goal, concepts.length));
    }
  }

  return {
    goal,
    goal_label: goalLabel(goal),
    brand_kit_id: kit.id,
    product_name: kit.product_name,
    concepts: concepts.slice(0, 3),
    generated_at: new Date().toISOString(),
    source: "llm",
  };
}
