import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getBrandKit } from "@/lib/photo-studio/brand-kit/storage";
import { generateAdStrategy } from "@/lib/photo-studio/campaign/ad-strategy";
import { generateCampaignCopy } from "@/lib/photo-studio/campaign/copy-generator";
import type { AdStrategyResult, CampaignGoal } from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    brand_kit_id?: string;
    goal?: CampaignGoal;
    strategy?: AdStrategyResult;
  };

  const brandKitId =
    typeof body.brand_kit_id === "string" ? body.brand_kit_id.trim() : "";
  if (!brandKitId) {
    return NextResponse.json({ error: "brand_kit_id is verplicht." }, { status: 400 });
  }

  const kit = getBrandKit(brandKitId, "fumero");
  if (!kit) {
    return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
  }

  let strategy = body.strategy;
  if (!strategy?.concepts?.length) {
    const goal =
      body.goal && CAMPAIGN_GOALS.some((g) => g.id === body.goal)
        ? body.goal
        : "verkoop";
    strategy = await generateAdStrategy(kit, goal);
  }

  const copy = await generateCampaignCopy(kit, strategy);
  return NextResponse.json({ ok: true, copy, strategy });
}
