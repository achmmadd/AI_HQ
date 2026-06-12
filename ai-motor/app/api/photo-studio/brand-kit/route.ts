import { NextRequest, NextResponse } from "next/server";
import {
  listBrandKits,
  saveBrandKit,
} from "@/lib/photo-studio/brand-kit/storage";
import {
  validateBrandKitData,
  type BrandKitData,
} from "@/lib/photo-studio/brand-kit/types";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

function requireFumero(
  klant: string
): NextResponse | null {
  if (klant !== "fumero") {
    return NextResponse.json(
      { error: "Brand Kit is alleen beschikbaar voor Fumero." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const auth = await requirePhotoStudioKlant(req, url.searchParams.get("klant"));
  if (!auth.ok) return auth.response;

  const deny = requireFumero(auth.klant);
  if (deny) return deny;

  const items = listBrandKits(auth.klant);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    data?: BrandKitData;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const deny = requireFumero(auth.klant);
  if (deny) return deny;

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "data is verplicht." }, { status: 400 });
  }

  const validation = validateBrandKitData(body.data);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const saved = saveBrandKit(auth.klant, {
    ...body.data,
    status: body.data.status === "confirmed" ? "confirmed" : "draft",
  });

  return NextResponse.json({ ok: true, item: saved });
}
