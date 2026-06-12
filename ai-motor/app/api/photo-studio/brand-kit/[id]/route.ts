import { NextRequest, NextResponse } from "next/server";
import {
  deleteBrandKit,
  getBrandKit,
  saveBrandKit,
} from "@/lib/photo-studio/brand-kit/storage";
import {
  validateBrandKitData,
  type BrandKitData,
} from "@/lib/photo-studio/brand-kit/types";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function requireFumero(klant: string): NextResponse | null {
  if (klant !== "fumero") {
    return NextResponse.json(
      { error: "Brand Kit is alleen beschikbaar voor Fumero." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const auth = await requirePhotoStudioKlant(req, url.searchParams.get("klant"));
  if (!auth.ok) return auth.response;

  const deny = requireFumero(auth.klant);
  if (deny) return deny;

  const item = getBrandKit(id, auth.klant);
  if (!item) {
    return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    data?: BrandKitData;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  const deny = requireFumero(auth.klant);
  if (deny) return deny;

  if (!id?.trim()) {
    return NextResponse.json({ error: "ID ontbreekt." }, { status: 400 });
  }

  const existing = getBrandKit(id, auth.klant);
  if (!existing) {
    return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "data is verplicht." }, { status: 400 });
  }

  const validation = validateBrandKitData(body.data);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const saved = saveBrandKit(auth.klant, body.data, id);
  return NextResponse.json({ ok: true, item: saved });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const auth = await requirePhotoStudioKlant(req, url.searchParams.get("klant"));
  if (!auth.ok) return auth.response;

  const deny = requireFumero(auth.klant);
  if (deny) return deny;

  if (!id?.trim()) {
    return NextResponse.json({ error: "ID ontbreekt." }, { status: 400 });
  }

  const deleted = deleteBrandKit(id, auth.klant);
  if (!deleted) {
    return NextResponse.json({ error: "Brand Kit niet gevonden." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
