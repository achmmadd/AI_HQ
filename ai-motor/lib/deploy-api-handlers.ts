import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-log";
import { insertDeployHistory, listDeployHistory } from "@/lib/deploy-history";
import {
  deployArtifactHtml,
  deployCodeWorkspace,
} from "@/lib/deploy-project";
import type { VercelDeployTarget } from "@/lib/deploy-vercel";
import { TOKEN_COOKIE, isValidSessionToken } from "@/lib/auth-session";
import { parseCodeKlant, validateProjectSlug } from "@/lib/code-workspace";

async function requireAuth(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(TOKEN_COOKIE)?.value;
  if (await isValidSessionToken(cookie)) return true;
  const header = req.headers.get("x-motorsai-token")?.trim();
  if (header && (await isValidSessionToken(header))) return true;
  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return isValidSessionToken(auth.slice(7).trim());
  }
  return false;
}

function deployEnvCheck(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN?.trim()) missing.push("GITHUB_TOKEN");
  if (!process.env.VERCEL_TOKEN?.trim()) missing.push("VERCEL_TOKEN");
  return { ok: missing.length === 0, missing };
}

function parseEnvironment(raw: unknown): VercelDeployTarget {
  return raw === "preview" ? "preview" : "production";
}

function formatDeployError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes("401") ||
    lower.includes("bad credentials") ||
    lower.includes("unauthorized")
  ) {
    return "Authenticatie upstream mislukt (401). Controleer GITHUB_TOKEN en VERCEL_TOKEN en of Vercel ↔ GitHub gekoppeld is.";
  }
  if (lower.includes("rate limit") || lower.includes("403")) {
    return `${msg} — mogelijk rate limit of ontbrekende rechten op de token.`;
  }
  return msg;
}

/** Preflight voor de UI / Dev panel — geen deploy, alleen configuratiechecks. */
export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 403 });
  }

  const { ok, missing } = deployEnvCheck();

  return NextResponse.json({
    ready: ok,
    missing,
    hint:
      missing.length === 0
        ? null
        : "Zet ontbrekende keys op de server (.env.local), voer npm run env:merge uit en herstart PM2. Koppel Vercel aan GitHub in het Vercel-dashboard.",
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 403 });
  }

  const { ok, missing } = deployEnvCheck();
  if (!ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Deploy niet geconfigureerd op de server: ${missing.join(", ")} ontbreken. Zet ze in .env.local (of via env:merge) en herstart de app.`,
        missing,
      },
      { status: 503 }
    );
  }

  const ghToken = process.env.GITHUB_TOKEN!.trim();
  const vercelToken = process.env.VERCEL_TOKEN!.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const configOwner = process.env.GITHUB_OWNER?.trim();

  const body = await req.json().catch(() => ({}));

  const source =
    body?.source === "code" || body?.source === "artifact"
      ? body.source
      : body?.code
        ? "artifact"
        : null;

  const environment = parseEnvironment(body?.environment);
  const klant = parseCodeKlant(typeof body?.klant === "string" ? body.klant : null);

  if (!source) {
    return NextResponse.json(
      { error: "source vereist (artifact|code) of legacy code veld" },
      { status: 400 }
    );
  }

  const slugRaw =
    typeof body?.slug === "string"
      ? body.slug.trim()
      : typeof body?.app_name === "string"
        ? body.app_name.trim()
        : "motor-app";
  const slug = slugRaw || "motor-app";

  try {
    let result;

    if (source === "code") {
      const workspace =
        typeof body?.workspace === "string" ? body.workspace.trim() : "";
      if (!workspace || !validateProjectSlug(workspace)) {
        return NextResponse.json(
          { error: "workspace vereist voor source=code" },
          { status: 400 }
        );
      }
      result = await deployCodeWorkspace({
        klant,
        workspace,
        slug,
        environment,
        ghToken,
        vercelToken,
        teamId,
        configOwner,
      });
    } else {
      const html =
        typeof body?.html === "string"
          ? body.html
          : typeof body?.code === "string"
            ? body.code
            : "";
      if (!html.trim()) {
        return NextResponse.json({ error: "html required" }, { status: 400 });
      }
      result = await deployArtifactHtml({
        slug,
        html,
        environment,
        ghToken,
        vercelToken,
        teamId,
        configOwner,
      });
    }

    const row = insertDeployHistory({
      klant,
      source,
      slug,
      repo_url: result.repo_url,
      live_url: result.live_url,
      environment: result.environment,
      status: "success",
      deployment_id: result.deployment_id,
    });

    logAudit({
      action: "deploy",
      resource: result.repo_url,
      klant,
      detail: {
        source,
        slug,
        environment,
        live_url: result.live_url,
        files_pushed: result.files_pushed,
        deploy_history_id: row.id,
      },
    });

    return NextResponse.json({
      success: true,
      live_url: result.live_url,
      repo_url: result.repo_url,
      deployment_id: result.deployment_id,
      files_pushed: result.files_pushed,
      environment: result.environment,
      deploy_history_id: row.id,
    });
  } catch (e) {
    logAudit({
      action: "deploy_failed",
      klant,
      detail: {
        source,
        slug,
        environment,
        error: e instanceof Error ? e.message : String(e),
      },
    });
    return NextResponse.json(
      { success: false, error: formatDeployError(e) },
      { status: 502 }
    );
  }
}
