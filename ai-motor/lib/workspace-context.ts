/**
 * Workspace slug ↔ UUID resolution for session and RLS context (Sprint 1.2).
 */
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { AuthRole, AuthSession, WorkspaceScope } from "@/lib/auth-session";
import { canAccessKlant } from "@/lib/auth-session";
import { getDrizzleDbAdmin } from "@/lib/db/drizzle/client";
import { users, workspaceMemberships, workspaces } from "@/lib/db/drizzle/schema";
import { workspaceSlugForLegacyKlant } from "@/lib/db/drizzle/seed-workspaces";
import { setPgWorkspaceContext } from "@/lib/db/pg-adapter";

export type MembershipRole = "admin" | "editor" | "viewer";

export type WorkspaceContext = {
  workspaceSlug: string;
  workspaceId: string | null;
  membershipRole: MembershipRole;
  pgUserId: string | null;
};

const workspaceIdCache = new Map<string, string>();

function mapAuthRoleToMembershipRole(role: AuthRole): MembershipRole {
  if (role === "admin") return "admin";
  return "editor";
}

/** Derive default workspace slug from legacy auth scope/role. */
export function workspaceSlugFromAuth(params: {
  role: AuthRole;
  scope: WorkspaceScope;
  legacy?: boolean;
}): string {
  if (params.legacy || params.scope === "all") return "motor";
  return workspaceSlugForLegacyKlant(params.scope);
}

/** Resolve workspace UUID by slug (cached; requires DATABASE_URL). */
export async function resolveWorkspaceIdBySlug(
  slug: string
): Promise<string | null> {
  const cached = workspaceIdCache.get(slug);
  if (cached) return cached;

  const db = getDrizzleDbAdmin();
  if (!db) return null;

  await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  if (!row) return null;
  workspaceIdCache.set(slug, row.id);
  return row.id;
}

/** Workspace slug for a klant query param (fumero/bokas → slug; unknown → motor). */
export function workspaceSlugForKlant(klant: string): string {
  return workspaceSlugForLegacyKlant(klant);
}

const KNOWN_WORKSPACE_SLUGS = new Set(["fumero", "bokas", "motor", "personal"]);

/** Check session access to a workspace slug (API CRUD guard). */
export function canAccessWorkspaceSlug(
  session: AuthSession,
  slug: string
): boolean {
  const s = slug.trim().toLowerCase();
  if (!KNOWN_WORKSPACE_SLUGS.has(s)) return false;

  if (s === "fumero" || s === "bokas") {
    return canAccessKlant(session, s);
  }
  if (s === "motor") {
    return session.role === "admin" || session.scope === "all";
  }
  if (s === "personal") {
    return (
      session.scope === "personal" ||
      session.role === "admin" ||
      session.scope === "all"
    );
  }
  return false;
}

/** 403 when session lacks access to workspace slug. */
export function assertWorkspaceSlugAccess(
  session: AuthSession,
  slug: string
): NextResponse | null {
  if (canAccessWorkspaceSlug(session, slug)) return null;
  return NextResponse.json(
    { error: "Forbidden: geen toegang tot deze workspace" },
    { status: 403 }
  );
}

/** Load PG user + membership for session enrichment at login. */
export async function resolveWorkspaceContextForUser(params: {
  email: string;
  sqliteUserId: number | null;
  role: AuthRole;
  scope: WorkspaceScope;
  legacy?: boolean;
}): Promise<WorkspaceContext> {
  const workspaceSlug = workspaceSlugFromAuth({
    role: params.role,
    scope: params.scope,
    legacy: params.legacy,
  });
  const membershipRole = mapAuthRoleToMembershipRole(params.role);

  const db = getDrizzleDbAdmin();
  if (!db) {
    return {
      workspaceSlug,
      workspaceId: null,
      membershipRole,
      pgUserId: null,
    };
  }

  await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  const email = params.email.trim().toLowerCase();
  let pgUserId: string | null = null;

  const byEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (byEmail.length > 0) {
    pgUserId = byEmail[0].id;
  } else if (params.sqliteUserId != null) {
    const byLegacy = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.legacySqliteId, String(params.sqliteUserId)))
      .limit(1);
    if (byLegacy.length > 0) pgUserId = byLegacy[0].id;
  }

  const workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug);

  if (pgUserId && workspaceId) {
    const membership = await db
      .select({ role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(
        sql`${workspaceMemberships.userId} = ${pgUserId} AND ${workspaceMemberships.workspaceId} = ${workspaceId}`
      )
      .limit(1);
    if (membership.length > 0) {
      const r = membership[0].role;
      if (r === "admin" || r === "editor" || r === "viewer") {
        return {
          workspaceSlug,
          workspaceId,
          membershipRole: r,
          pgUserId,
        };
      }
    }
  }

  return {
    workspaceSlug,
    workspaceId,
    membershipRole,
    pgUserId,
  };
}

/** Merge workspace fields into AuthSession at login. */
export async function enrichAuthSession(
  session: AuthSession
): Promise<AuthSession> {
  const ctx = await resolveWorkspaceContextForUser({
    email: session.email,
    sqliteUserId: session.userId,
    role: session.role,
    scope: session.scope,
    legacy: session.legacy,
  });
  return {
    ...session,
    workspaceSlug: ctx.workspaceSlug,
    workspaceId: ctx.workspaceId,
    membershipRole: ctx.membershipRole,
    pgUserId: ctx.pgUserId,
  };
}

/**
 * Set Postgres RLS session vars for an API request.
 * Uses klant param when provided; otherwise session default workspace.
 */
export async function applyPgWorkspaceContext(
  session: AuthSession,
  klant?: string
): Promise<void> {
  const slug = klant
    ? workspaceSlugForKlant(klant)
    : session.workspaceSlug ?? workspaceSlugFromAuth(session);

  const workspaceId =
    session.workspaceId && !klant
      ? session.workspaceId
      : await resolveWorkspaceIdBySlug(slug);

  if (!workspaceId) return;

  await setPgWorkspaceContext({
    workspaceId,
    userId: session.pgUserId ?? undefined,
  });
}
