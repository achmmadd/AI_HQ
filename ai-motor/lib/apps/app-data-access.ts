import { NextRequest, NextResponse } from "next/server";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";
import {
  getPublishedApp,
  getAppBySlug,
  type AppRow,
} from "@/lib/apps/apps-db";
import {
  readAppSessionFromCookie,
  appSessionCookieName,
} from "@/lib/apps/app-auth";

export type DataAccessContext = {
  klant: string;
  app: AppRow;
  mode: "operator" | "public";
  canMutate: boolean;
};

function safeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
}

async function readOperatorSession(req: NextRequest) {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    req.headers.get("x-motorsai-token")?.trim() ||
    req.headers.get("authorization")?.trim().replace(/^bearer\s+/i, "");
  return readAuthSession(token || undefined);
}

/**
 * Resolve data API access: Motor operator (admin modal) or published app (end-user).
 * When auth_required=1, end-users need a valid app session cookie.
 */
export async function resolveDataApiAccess(
  req: NextRequest,
  slug: string,
  explicitKlant?: string | null
): Promise<{ ok: true; ctx: DataAccessContext } | { ok: false; response: NextResponse }> {
  const safe = safeSlug(slug);
  const operator = await readOperatorSession(req);

  if (operator) {
    const allowed =
      operator.scope === "all" ||
      operator.scope === explicitKlant ||
      (explicitKlant == null && (operator.scope === "fumero" || operator.scope === "bokas"));
    if (allowed) {
      const klant =
        operator.scope === "all"
          ? (explicitKlant && explicitKlant.trim()) || "fumero"
          : operator.scope;
      const app = getAppBySlug(safe, klant);
      if (app) {
        const canMutate =
          operator.role === "admin" ||
          operator.scope === "all" ||
          operator.membershipRole === "admin" ||
          operator.membershipRole === "editor" ||
          !operator.membershipRole;
        return { ok: true, ctx: { klant, app, mode: "operator", canMutate } };
      }
    }
  }

  const published = getPublishedApp(safe);
  if (!published) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "App niet gevonden of niet gepubliceerd" },
        { status: 404 }
      ),
    };
  }

  if (published.auth_required) {
    const cookie = req.cookies.get(appSessionCookieName(safe))?.value;
    const appSession = readAppSessionFromCookie(cookie, safe, published.klant);
    if (!appSession) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Inloggen vereist voor deze app" },
          { status: 401 }
        ),
      };
    }
  }

  return {
    ok: true,
    ctx: { klant: published.klant, app: published, mode: "public", canMutate: true },
  };
}

export function assertDataMutationAllowed(
  ctx: DataAccessContext
): NextResponse | null {
  if (ctx.canMutate) return null;
  return NextResponse.json(
    { error: "Je hebt alleen leesrechten voor deze workspace" },
    { status: 403 }
  );
}
