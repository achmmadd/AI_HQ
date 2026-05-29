import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import type { CompanyId } from "@/lib/types";

export async function requirePhotoStudioKlant(
  req: NextRequest,
  klantHint?: string | null
): Promise<
  | { ok: true; klant: CompanyId }
  | { ok: false; response: NextResponse }
> {
  const url = new URL(req.url);
  const raw =
    klantHint ??
    url.searchParams.get("klant") ??
    (await req
      .clone()
      .json()
      .catch(() => ({})) as { klant?: string }).klant;
  const target: CompanyId = raw === "bokas" ? "bokas" : "fumero";

  const auth = await requireWorkspaceApi(req, target);
  if (!auth.ok) return auth;
  return { ok: true, klant: target };
}
