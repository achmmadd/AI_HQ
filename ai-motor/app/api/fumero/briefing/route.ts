import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { buildFumeroBriefing, getLatestFumeroBriefing } from "@/lib/fumero/briefing";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const staleHours = Number(process.env.FUMERO_BRIEFING_MAX_AGE_HOURS ?? "20");
  const latest = getLatestFumeroBriefing();

  let useCached = Boolean(latest);
  if (latest?.generated_at && !refresh) {
    const ageMs = Date.now() - Date.parse(latest.generated_at);
    if (Number.isFinite(ageMs) && ageMs > staleHours * 3600_000) {
      useCached = false;
    }
  }

  if (useCached && latest) {
    return NextResponse.json({ ...latest, cached: true });
  }

  try {
    const payload = await buildFumeroBriefing({ persist: true });
    return NextResponse.json({ ...payload, cached: false });
  } catch (e) {
    if (latest) {
      return NextResponse.json({
        ...latest,
        cached: true,
        warning: e instanceof Error ? e.message : "Briefing refresh mislukt",
      });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Briefing genereren mislukt" },
      { status: 502 }
    );
  }
}
