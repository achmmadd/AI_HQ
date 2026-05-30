import { NextRequest } from "next/server";
import { listPhotoGenerations } from "@/lib/photo-studio/library";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import { jsonCatchError, jsonOk } from "@/lib/http-json-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePhotoStudioKlant(req);
    if (!auth.ok) return auth.response;
    const items = listPhotoGenerations(auth.klant);
    return jsonOk({ items });
  } catch (error) {
    return jsonCatchError("photo_studio_library", error);
  }
}
