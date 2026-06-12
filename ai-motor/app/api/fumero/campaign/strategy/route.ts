import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getBrandKit } from "@/lib/photo-studio/brand-kit/storage";
import { generateAdStrategy } from "@/lib/photo-studio/campaign/ad-strategy";
import { campaignLlmTimeoutMs } from "@/lib/photo-studio/campaign/llm";
import { getCampaignStudioConfig } from "@/lib/photo-studio/campaign/studio-config";
import type { CampaignGoal } from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";
import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";

export const runtime = "nodejs";
/** Strategy must respond quickly — template fallback on timeout. */
export const maxDuration = 30;

const VALID_GOALS = new Set<CampaignGoal>(CAMPAIGN_GOALS.map((g) => g.id));

const ROUTE_TIMEOUT_MS = Math.min(
  30_000,
  campaignLlmTimeoutMs() + 5_000
);

async function generateStrategyWithFallback(
  kit: BrandKitRow,
  goal: CampaignGoal
) {
  const config = getCampaignStudioConfig();
  if (config.template_only) {
    return generateAdStrategy(kit, goal, { templateOnly: true });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      generateAdStrategy(kit, goal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Strategie time-out")),
          ROUTE_TIMEOUT_MS
        );
      }),
    ]);
  } catch (e) {
    console.warn(
      "[api/fumero/campaign/strategy] template fallback:",
      e instanceof Error ? e.message : e
    );
    return generateAdStrategy(kit, goal, { templateOnly: true });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      brand_kit_id?: string;
      goal?: string;
    };

    const brandKitId =
      typeof body.brand_kit_id === "string" ? body.brand_kit_id.trim() : "";
    const goal = body.goal as CampaignGoal;

    if (!brandKitId) {
      return NextResponse.json({ error: "brand_kit_id is verplicht." }, { status: 400 });
    }
    if (!VALID_GOALS.has(goal)) {
      return NextResponse.json(
        { error: "goal moet verkoop, bereik of retargeting zijn." },
        { status: 400 }
      );
    }

    const kit = getBrandKit(brandKitId, "fumero");
    if (!kit) {
      return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
    }
    if (kit.status !== "confirmed") {
      return NextResponse.json(
        {
          error:
            "Alleen bevestigde Brand Kits kunnen een strategie genereren. Bevestig je kit eerst.",
          kit_status: kit.status,
        },
        { status: 400 }
      );
    }

    const strategy = await generateStrategyWithFallback(kit, goal);
    if (!strategy.concepts.length) {
      return NextResponse.json(
        {
          error: "Geen advertentieconcepten gegenereerd.",
          config: getCampaignStudioConfig(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      strategy,
      goals: CAMPAIGN_GOALS,
      config: getCampaignStudioConfig(),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[api/fumero/campaign/strategy]", e);
    return NextResponse.json(
      { error: "Strategie genereren mislukt.", detail, config: getCampaignStudioConfig() },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    goals: CAMPAIGN_GOALS,
    config: getCampaignStudioConfig(),
  });
}
