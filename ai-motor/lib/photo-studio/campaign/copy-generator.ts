import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import { AD_ANGLE_TEMPLATES } from "@/lib/photo-studio/campaign/ad-strategy";
import { FUMERO_BRAND_VOICE, FUMERO_FACTS } from "@/lib/photo-studio/campaign/brand-voice";
import { callCampaignLlmJson } from "@/lib/photo-studio/campaign/llm";
import {
  checkCopySetPolicy,
  sanitizeHeadline,
} from "@/lib/photo-studio/campaign/meta-policy";
import type {
  AdAngleId,
  AdConcept,
  AdStrategyResult,
  CampaignGoal,
  CopyGeneratorResult,
  CopySet,
} from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";

const CTA_BY_GOAL: Record<CampaignGoal, [string, string]> = {
  verkoop: ["Bestel nu", "Naar de shop"],
  bereik: ["Ontdek Fumero", "Meer info"],
  retargeting: ["Maak je bestelling af", "Bekijk opnieuw"],
};

function goalLabel(goal: CampaignGoal): string {
  return CAMPAIGN_GOALS.find((g) => g.id === goal)?.label ?? goal;
}

function templateCopySet(
  concept: AdConcept,
  hookVariant: 1 | 2,
  kit: BrandKitRow,
  goal: CampaignGoal
): CopySet {
  const angle = AD_ANGLE_TEMPLATES[concept.angle];
  const hook =
    hookVariant === 1
      ? String(concept.hook ?? "")
      : angle.hookPatterns[(hookVariant + concept.angle.length) % angle.hookPatterns.length]!;

  const headline = sanitizeHeadline(
    hookVariant === 1
      ? String(concept.hook ?? "")
      : `${String(kit.product_name ?? "")} — ${String(angle.label).toLowerCase()}`
  );

  const primaryParts = [
    hook,
    String(kit.description ?? "").slice(0, 120) || `${String(kit.product_name ?? "")} bij Fumero.`,
    kit.price ? `Vanaf ${kit.price} ${kit.currency}.` : null,
    "Discreet verpakt, snelle levering in NL.",
  ].filter(Boolean);

  const [ctaPrimary, ctaSecondary] = CTA_BY_GOAL[goal];

  const fields = {
    headline,
    primary_text: primaryParts.join(" "),
    description: `${String(kit.product_name ?? "")} — premium HHC lifestyle. 18+. Geen gezondheidsclaims.`,
    cta_primary: ctaPrimary,
    cta_secondary: ctaSecondary,
  };

  const policy = checkCopySetPolicy(fields);

  return {
    angle: concept.angle,
    hook_variant: hookVariant,
    headline: fields.headline,
    primary_text: fields.primary_text,
    description: fields.description,
    cta_primary: fields.cta_primary,
    cta_secondary: fields.cta_secondary,
    policy_warnings: policy.warnings,
    policy_pass: policy.pass,
  };
}

type LlmCopyResponse = {
  sets?: Array<{
    angle?: string;
    hook_variant?: number;
    headline?: string;
    primary_text?: string;
    description?: string;
    cta_primary?: string;
    cta_secondary?: string;
  }>;
};

export async function generateCampaignCopy(
  kit: BrandKitRow,
  strategy: AdStrategyResult,
  opts?: { templateOnly?: boolean }
): Promise<CopyGeneratorResult> {
  const goal = strategy.goal;
  const concepts = strategy.concepts;

  if (opts?.templateOnly) {
    const sets: CopySet[] = [];
    for (const concept of concepts) {
      for (const variant of [1, 2] as const) {
        sets.push(templateCopySet(concept, variant, kit, goal));
      }
    }
    return {
      goal,
      brand_kit_id: kit.id,
      sets: sets.slice(0, 6),
      generated_at: new Date().toISOString(),
      source: "template",
    };
  }

  const system = `Je bent copywriter voor Meta Ads voor ${FUMERO_BRAND_VOICE}
Schrijf 6 advertentieteksten (2 hook-varianten × 3 angles: prijs, vertrouwen, probleem_oplossing).
Regels:
- headline max 40 tekens
- primary_text: 2-3 zinnen NL
- description: 1 zin
- 2 CTA-varianten per set (cta_primary, cta_secondary)
- Geen gezondheidsclaims, geen emoji, geen iDEAL/creditcard
Antwoord ALLEEN JSON:
{"sets":[{"angle":"prijs|vertrouwen|probleem_oplossing","hook_variant":1|2,"headline":"...","primary_text":"...","description":"...","cta_primary":"...","cta_secondary":"..."}]}`;

  const user = [
    `Campagnedoel: ${goalLabel(goal)}`,
    `Product: ${kit.product_name}`,
    kit.price ? `Prijs: ${kit.price} ${kit.currency}` : "",
    "",
    "Concepten:",
    ...concepts.map(
      (c) =>
        `- ${c.angle}: hook="${c.hook}", visual="${c.visual_direction.slice(0, 80)}"`
    ),
    "",
    "Feiten:",
    FUMERO_FACTS.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await callCampaignLlmJson<LlmCopyResponse>({
    system,
    user,
    n8nType: "campaign_copy",
    maxTokens: 3000,
  });

  const sets: CopySet[] = [];

  if (llm.ok && Array.isArray(llm.data.sets) && llm.data.sets.length >= 3) {
    const validAngles = new Set<AdAngleId>(["prijs", "vertrouwen", "probleem_oplossing"]);
    for (const raw of llm.data.sets) {
      const angle = raw.angle as AdAngleId;
      if (!validAngles.has(angle)) continue;
      const hookVariant = raw.hook_variant === 2 ? 2 : 1;
      const fields = {
        headline: sanitizeHeadline(String(raw.headline ?? "")),
        primary_text: String(raw.primary_text ?? "").trim(),
        description: String(raw.description ?? "").trim(),
        cta_primary: String(raw.cta_primary ?? CTA_BY_GOAL[goal][0]).trim(),
        cta_secondary: String(raw.cta_secondary ?? CTA_BY_GOAL[goal][1]).trim(),
      };
      const policy = checkCopySetPolicy(fields);
      sets.push({
        angle,
        hook_variant: hookVariant as 1 | 2,
        ...fields,
        policy_warnings: policy.warnings,
        policy_pass: policy.pass,
      });
    }
  }

  if (sets.length < 6) {
    for (const concept of concepts) {
      for (const variant of [1, 2] as const) {
        if (!sets.some((s) => s.angle === concept.angle && s.hook_variant === variant)) {
          sets.push(templateCopySet(concept, variant, kit, goal));
        }
      }
    }
  }

  return {
    goal,
    brand_kit_id: kit.id,
    sets: sets.slice(0, 6),
    generated_at: new Date().toISOString(),
    source: llm.ok ? "llm" : "template",
  };
}
