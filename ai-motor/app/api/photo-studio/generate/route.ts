import { NextRequest, NextResponse } from "next/server";
import { generateWithFal } from "@/lib/photo-studio/fal-generation";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { persistPhotoGeneration } from "@/lib/photo-studio/library";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import type { PhotoStudioMode } from "@/lib/photo-studio/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    mode?: string;
    prompt?: string;
    image_url?: string;
    style_hint?: string;
    seed?: number;
    workspace_preset?: string;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const mode: PhotoStudioMode =
    body.mode === "image_to_image" ? "image_to_image" : "text_to_image";
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";
  const image_url =
    typeof body.image_url === "string" ? body.image_url.trim() : "";

  if (!prompt && mode === "text_to_image") {
    return NextResponse.json({ error: "prompt is verplicht." }, { status: 400 });
  }
  if (mode === "image_to_image" && !image_url) {
    return NextResponse.json(
      { error: "image_url is verplicht voor image-to-image." },
      { status: 400 }
    );
  }

  ensurePhotoStudioSchema();

  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? Math.floor(body.seed)
      : undefined;

  const result = await generateWithFal({
    mode,
    klant: auth.klant,
    prompt: prompt || "Verbeter deze productfoto.",
    image_url: image_url || undefined,
    style_hint:
      typeof body.style_hint === "string" ? body.style_hint : undefined,
    seed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const persisted = await persistPhotoGeneration({
    klant: auth.klant,
    mode,
    prompt: result.prompt,
    master_url: result.url,
    source_image_url: mode === "image_to_image" ? image_url : null,
    seed: seed ?? null,
    workspace_preset:
      typeof body.workspace_preset === "string" ? body.workspace_preset : null,
  });

  return NextResponse.json({
    ok: true,
    klant: auth.klant,
    mode,
    model: result.model,
    prompt: result.prompt,
    master_url: persisted.master_public_url,
    tracking_id: persisted.tracking_id,
    generation_id: persisted.id,
    variants: persisted.variants,
    content_id: persisted.content_id,
    analytics: persisted.analytics,
  });
}
