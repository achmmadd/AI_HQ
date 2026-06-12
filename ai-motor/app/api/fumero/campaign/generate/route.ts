import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getBrandKit } from "@/lib/photo-studio/brand-kit/storage";
import { buildCampaignPack } from "@/lib/photo-studio/campaign/pack-builder";
import {
  shouldUseAsyncCampaignJob,
  startCampaignPackJob,
} from "@/lib/photo-studio/campaign/campaign-generation-runner";
import {
  getCampaignStudioConfig,
  resolveCampaignSkipMedia,
} from "@/lib/photo-studio/campaign/studio-config";
import type { AdAngleId, AdStrategyResult, CampaignGoal } from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";

export const runtime = "nodejs";
/** Sync fast-path only — async jobs run in background without HTTP deadline. */
export const maxDuration = 60;

function packResponse(
  pack: Awaited<ReturnType<typeof buildCampaignPack>>,
  skipMedia: boolean,
  autoSkipped: boolean,
  config: ReturnType<typeof getCampaignStudioConfig>
) {
  return {
    ok: true,
    pack_id: pack.id,
    status: pack.status,
    download_url: pack.zip_path ? `/api/fumero/campaign/${pack.id}/download` : null,
    pack,
    config,
    media_skipped: skipMedia,
    media_skip_reason: autoSkipped
      ? config.template_only
        ? "Template-modus — media standaard overgeslagen."
        : "FAL_KEY of FAL_API_KEY ontbreekt — media automatisch overgeslagen."
      : skipMedia
        ? "Media overgeslagen op verzoek (skip_media=true)."
        : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, config: getCampaignStudioConfig() });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      brand_kit_id?: string;
      goal?: CampaignGoal;
      skip_media?: boolean;
      angles?: AdAngleId[];
      strategy?: AdStrategyResult;
    };

    const brandKitId =
      typeof body.brand_kit_id === "string" ? body.brand_kit_id.trim() : "";
    const goal = body.goal ?? "verkoop";

    if (!brandKitId) {
      return NextResponse.json({ error: "brand_kit_id is verplicht." }, { status: 400 });
    }
    if (!CAMPAIGN_GOALS.some((g) => g.id === goal)) {
      return NextResponse.json({ error: "Ongeldig campagnedoel." }, { status: 400 });
    }

    const kit = getBrandKit(brandKitId, "fumero");
    if (!kit) {
      return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
    }
    if (kit.status !== "confirmed") {
      return NextResponse.json(
        {
          error:
            "Alleen bevestigde Brand Kits kunnen een campaign pack genereren. Bevestig je kit eerst in stap 1.",
          kit_status: kit.status,
        },
        { status: 400 }
      );
    }

    const config = getCampaignStudioConfig();
    const { skipMedia, autoSkipped } = resolveCampaignSkipMedia(body.skip_media);

    const presetStrategy =
      body.strategy?.concepts?.length ? body.strategy : undefined;

    if (shouldUseAsyncCampaignJob(skipMedia)) {
      const packId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { jobId } = startCampaignPackJob({
        klant: "fumero",
        packId,
        request: {
          brand_kit_id: brandKitId,
          goal,
          skip_media: skipMedia,
          angles: body.angles,
          strategy: presetStrategy,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          job_id: jobId,
          jobId,
          pack_id: packId,
          status: "processing",
          config,
        },
        { status: 202 }
      );
    }

    const packId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pack = await buildCampaignPack(packId, {
      brandKit: kit,
      goal,
      skip_media: skipMedia,
      angles: body.angles,
      strategy: presetStrategy,
    });

    return NextResponse.json(packResponse(pack, skipMedia, autoSkipped, config));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[api/fumero/campaign/generate]", e);
    return NextResponse.json(
      {
        error: "Campaign pack genereren mislukt.",
        detail,
        config: getCampaignStudioConfig(),
      },
      { status: 500 }
    );
  }
}
