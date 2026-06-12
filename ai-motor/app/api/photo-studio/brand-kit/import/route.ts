import { NextRequest, NextResponse } from "next/server";
import { importBrandKitFromUrl } from "@/lib/photo-studio/brand-kit/import-from-url";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    url?: string;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  if (auth.klant !== "fumero") {
    return NextResponse.json(
      { error: "Brand Kit import is alleen beschikbaar voor Fumero." },
      { status: 403 }
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json(
      { error: "url is verplicht (volledige https-link naar fumero.nl product)." },
      { status: 400 }
    );
  }

  const result = await importBrandKitFromUrl(url);

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      fallback: result.fallback,
    });
  }

  return NextResponse.json({
    ok: true,
    draft: result.draft,
    elapsed_ms: result.elapsed_ms,
  });
}
