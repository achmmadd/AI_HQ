import { NextRequest, NextResponse } from "next/server";
import { deleteContentStudioTemplate } from "@/lib/photo-studio/content-studio-templates";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const auth = await requirePhotoStudioKlant(req, url.searchParams.get("klant"));
  if (!auth.ok) return auth.response;

  if (!id?.trim()) {
    return NextResponse.json({ error: "ID ontbreekt." }, { status: 400 });
  }

  const deleted = deleteContentStudioTemplate(id, auth.klant);
  if (!deleted) {
    return NextResponse.json({ error: "Recept niet gevonden." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
