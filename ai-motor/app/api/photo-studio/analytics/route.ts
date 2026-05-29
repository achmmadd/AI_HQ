import { NextRequest, NextResponse } from "next/server";
import {
  attributionHooksFor,
  getTrackingIdForGeneration,
} from "@/lib/photo-studio/analytics/tracking";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

/** Analytics stub — exposes tracking_id and empty attribution interfaces. */
export async function GET(req: NextRequest) {
  const auth = await requirePhotoStudioKlant(req);
  if (!auth.ok) return auth.response;

  const generationId = Number(new URL(req.url).searchParams.get("generation_id"));
  if (!generationId) {
    return NextResponse.json({ error: "generation_id required" }, { status: 400 });
  }

  const tracking_id = getTrackingIdForGeneration(generationId);
  if (!tracking_id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const hooks = attributionHooksFor(tracking_id);
  return NextResponse.json({
    tracking_id,
    hooks: {
      social: hooks.social,
      conversion: hooks.conversion,
      coach: hooks.coach,
    },
    note: "Coach layer activates when attribution data is collected.",
  });
}
