import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-log";
import {
  getDeployHistory,
  insertDeployHistory,
  listDeployHistory,
} from "@/lib/deploy-history";
import { vercelRollbackDeployment } from "@/lib/deploy-vercel";
import { TOKEN_COOKIE, isValidSessionTokenStrict } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!(await isValidSessionTokenStrict(token))) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 403 });
  }

  const vercelToken = process.env.VERCEL_TOKEN?.trim();
  if (!vercelToken) {
    return NextResponse.json(
      { error: "VERCEL_TOKEN ontbreekt" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const deployId = Number(body?.deploy_history_id ?? body?.id);
  if (!Number.isFinite(deployId) || deployId <= 0) {
    return NextResponse.json(
      { error: "deploy_history_id vereist" },
      { status: 400 }
    );
  }

  const target = getDeployHistory(deployId);
  if (!target) {
    return NextResponse.json({ error: "Deploy niet gevonden" }, { status: 404 });
  }
  if (!target.deployment_id) {
    return NextResponse.json(
      {
        error:
          "Geen deployment_id opgeslagen voor deze deploy — rollback niet mogelijk",
      },
      { status: 400 }
    );
  }

  const teamId = process.env.VERCEL_TEAM_ID?.trim();

  try {
    const rolled = await vercelRollbackDeployment({
      token: vercelToken,
      teamId,
      deploymentId: target.deployment_id,
    });

    const liveUrl = rolled.url || target.live_url;
    const row = insertDeployHistory({
      klant: target.klant,
      source: target.source,
      slug: target.slug,
      repo_url: target.repo_url,
      live_url: liveUrl,
      environment: target.environment,
      status: "rollback",
      deployment_id: target.deployment_id,
    });

    logAudit({
      action: "deploy_rollback",
      resource: target.repo_url,
      klant: target.klant,
      detail: {
        from_deploy_history_id: target.id,
        rollback_deploy_history_id: row.id,
        deployment_id: target.deployment_id,
        live_url: liveUrl,
      },
    });

    return NextResponse.json({
      success: true,
      live_url: liveUrl,
      rolled_back_from: target.id,
      deploy_history_id: row.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAudit({
      action: "deploy_rollback_failed",
      resource: target.repo_url,
      klant: target.klant,
      detail: { deploy_history_id: target.id, error: msg },
    });
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}

/** Lijst eerdere deploys voor een slug (handig vóór rollback). */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!(await isValidSessionTokenStrict(token))) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query vereist" }, { status: 400 });
  }

  const klant = sp.get("klant")?.trim() || undefined;
  const rows = listDeployHistory({ klant, slug, limit: 20 }).filter(
    (r) => r.status === "success" && r.deployment_id
  );
  return NextResponse.json({ rollback_candidates: rows });
}
