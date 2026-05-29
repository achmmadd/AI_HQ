import { NextRequest, NextResponse } from "next/server";
import { runMenuBatchWorkflow } from "@/lib/photo-studio/menu-batch/menu-batch-workflow";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    image_urls?: string[];
    styling_params?: string;
    extra_prompt?: string;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const image_urls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u) => typeof u === "string" && u.trim())
    : [];

  if (!image_urls.length) {
    return NextResponse.json(
      { error: "Minimaal één image_url vereist." },
      { status: 400 }
    );
  }

  const styling_params =
    typeof body.styling_params === "string"
      ? body.styling_params.trim()
      : "warm restaurant ambient light, appetizing presentation";

  ensurePhotoStudioSchema();

  const result = await runMenuBatchWorkflow({
    klant: auth.klant,
    image_urls,
    styling_params,
    extra_prompt:
      typeof body.extra_prompt === "string" ? body.extra_prompt : undefined,
  });

  return NextResponse.json({ ok: true, ...result });
}
