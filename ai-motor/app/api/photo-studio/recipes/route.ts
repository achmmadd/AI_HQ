import { NextRequest, NextResponse } from "next/server";
import {
  listContentStudioTemplates,
  saveContentStudioTemplate,
} from "@/lib/photo-studio/content-studio-templates";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import type {
  ContentStudioAspectRatio,
  ContentStudioPlatform,
  ContentStudioQuality,
  ContentStudioTemplateCategory,
  PromptBlocks,
} from "@/lib/photo-studio/types";

export const runtime = "nodejs";

const PLATFORMS = new Set<ContentStudioPlatform>([
  "Website",
  "Instagram",
  "TikTok",
  "Print",
]);

const ASPECTS = new Set<ContentStudioAspectRatio>([
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const auth = await requirePhotoStudioKlant(req, url.searchParams.get("klant"));
  if (!auth.ok) return auth.response;

  const recipesOnly = url.searchParams.get("recipes") === "1";
  const items = listContentStudioTemplates({
    klant: auth.klant,
    recipesOnly,
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    title?: string;
    category?: string;
    platform?: string;
    blocks?: Partial<PromptBlocks>;
    aspect_ratio?: string;
    quality?: string;
    tags?: string[];
    thumbnail_url?: string;
    is_recipe?: boolean;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Titel is verplicht." }, { status: 400 });
  }

  const blocks = body.blocks;
  if (
    !blocks ||
    typeof blocks.subject !== "string" ||
    typeof blocks.lighting !== "string" ||
    typeof blocks.style !== "string" ||
    typeof blocks.composition !== "string" ||
    typeof blocks.mood !== "string"
  ) {
    return NextResponse.json(
      { error: "Alle 5 blokken zijn verplicht." },
      { status: 400 }
    );
  }

  const platform =
    typeof body.platform === "string" &&
    PLATFORMS.has(body.platform as ContentStudioPlatform)
      ? (body.platform as ContentStudioPlatform)
      : "Website";

  const aspect_ratio =
    typeof body.aspect_ratio === "string" &&
    ASPECTS.has(body.aspect_ratio as ContentStudioAspectRatio)
      ? (body.aspect_ratio as ContentStudioAspectRatio)
      : "1:1";

  const quality =
    body.quality === "4K" || body.quality === "3K" || body.quality === "2K"
      ? (body.quality as ContentStudioQuality)
      : "2K";

  const category =
    typeof body.category === "string"
      ? (body.category as ContentStudioTemplateCategory)
      : "Product";

  const saved = saveContentStudioTemplate({
    klant: auth.klant,
    title,
    category,
    platform,
    blocks: blocks as PromptBlocks,
    aspect_ratio,
    quality,
    tags: Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string") : [],
    thumbnail_url:
      typeof body.thumbnail_url === "string" ? body.thumbnail_url : null,
    is_recipe: body.is_recipe !== false,
  });

  return NextResponse.json({ ok: true, item: saved });
}
