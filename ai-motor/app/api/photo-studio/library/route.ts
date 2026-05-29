import { NextRequest, NextResponse } from "next/server";
import { listPhotoGenerations } from "@/lib/photo-studio/library";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePhotoStudioKlant(req);
  if (!auth.ok) return auth.response;
  const items = listPhotoGenerations(auth.klant);
  return NextResponse.json({ items });
}
