import { NextRequest, NextResponse } from "next/server";
import { runCarouselWorkflow } from "@/lib/photo-studio/carousel/carousel-workflow";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import type { CarouselSlideInput } from "@/lib/photo-studio/carousel/carousel-types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    base_prompt?: string;
    background_lock?: string;
    slides?: CarouselSlideInput[];
    seed?: number;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const base_prompt =
    typeof body.base_prompt === "string" ? body.base_prompt.trim() : "";
  const background_lock =
    typeof body.background_lock === "string"
      ? body.background_lock.trim()
      : "neutral studio backdrop, soft key light";

  if (!base_prompt) {
    return NextResponse.json({ error: "base_prompt is verplicht." }, { status: 400 });
  }

  ensurePhotoStudioSchema();

  const result = await runCarouselWorkflow({
    klant: auth.klant,
    base_prompt,
    background_lock,
    slides: Array.isArray(body.slides) ? body.slides : [],
    seed:
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(body.seed)
        : undefined,
  });

  return NextResponse.json({ ok: true, ...result });
}
