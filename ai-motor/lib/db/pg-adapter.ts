/**
 * Postgres dual-write adapter (Sprint 1.1).
 * SQLite stays primary until M4 (POSTGRES_PRIMARY=1) — ADR-002.
 */
import { and, eq, sql } from "drizzle-orm";
import type { AuthRole, WorkspaceScope } from "@/lib/auth-session";
import { getDrizzleDb } from "@/lib/db/drizzle/client";
import {
  seedDefaultWorkspaces,
  workspaceSlugForLegacyKlant,
} from "@/lib/db/drizzle/seed-workspaces";
import {
  users,
  workspaceMemberships,
  workspaces,
} from "@/lib/db/drizzle/schema";
import {
  getDatabaseUrl,
  isPostgresPrimary,
  shouldDualWrite,
  shouldUsePostgres,
} from "@/lib/db/pg-flags";

export {
  getDatabaseUrl,
  isPostgresPrimary,
  shouldDualWrite,
  shouldUsePostgres,
} from "@/lib/db/pg-flags";

let initPromise: Promise<void> | null = null;

function mapAuthRoleToMembershipRole(role: AuthRole): string {
  if (role === "admin") return "admin";
  return "editor";
}

function membershipScopeForAuth(scope: WorkspaceScope): string {
  return scope;
}

/** Set RLS session variables for the current request (Sprint 1.2 middleware). */
export async function setPgWorkspaceContext(params: {
  workspaceId: string;
  userId?: string;
  bypassRls?: boolean;
}): Promise<void> {
  const db = getDrizzleDb();
  if (!db) return;

  await db.execute(
    sql`SELECT set_config('app.workspace_id', ${params.workspaceId}, false)`
  );
  if (params.userId) {
    await db.execute(
      sql`SELECT set_config('app.user_id', ${params.userId}, false)`
    );
  }
  if (params.bypassRls) {
    await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);
  }
}

/** Run migrations + workspace seed once when Postgres is enabled. */
export async function ensurePgReady(): Promise<void> {
  if (!shouldUsePostgres()) return;
  if (!getDatabaseUrl()) return;

  if (!initPromise) {
    initPromise = (async () => {
      const db = getDrizzleDb();
      if (!db) return;
      await seedDefaultWorkspaces(db);
    })();
  }

  await initPromise;
}

export type DualWriteAuthUserParams = {
  email: string;
  passwordHash: string;
  role: AuthRole;
  scope: WorkspaceScope;
  sqliteId?: number;
};

/**
 * Mirror auth_users write to Postgres when USE_POSTGRES=1.
 * Fire-and-forget from sync SQLite paths — errors are logged, not thrown.
 */
export async function dualWriteAuthUser(
  params: DualWriteAuthUserParams
): Promise<void> {
  if (!shouldDualWrite()) return;

  const db = getDrizzleDb();
  if (!db) return;

  await ensurePgReady();

  // Admin dual-write until API middleware sets app.workspace_id (Sprint 1.2).
  await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  const email = params.email.trim().toLowerCase();
  const slug = workspaceSlugForLegacyKlant(
    params.scope === "all"
      ? "system"
      : params.scope === "personal"
        ? "personal"
        : params.scope
  );

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  if (!workspace) {
    console.error("[pg-adapter] workspace not found for slug:", slug);
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    await db
      .update(users)
      .set({
        passwordHash: params.passwordHash,
        active: true,
        legacySqliteId: params.sqliteId?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } else {
    const inserted = await db
      .insert(users)
      .values({
        email,
        passwordHash: params.passwordHash,
        active: true,
        legacySqliteId: params.sqliteId?.toString(),
      })
      .returning({ id: users.id });
    userId = inserted[0].id;
  }

  const membershipRole = mapAuthRoleToMembershipRole(params.role);
  const membershipScope = membershipScopeForAuth(params.scope);

  const existingMembership = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspace.id),
        eq(workspaceMemberships.userId, userId)
      )
    )
    .limit(1);

  if (existingMembership.length > 0) {
    await db
      .update(workspaceMemberships)
      .set({
        role: membershipRole,
        scope: membershipScope,
        updatedAt: new Date(),
      })
      .where(eq(workspaceMemberships.id, existingMembership[0].id));
  } else {
    await db.insert(workspaceMemberships).values({
      workspaceId: workspace.id,
      userId,
      role: membershipRole,
      scope: membershipScope,
    });
  }
}

/** Non-blocking dual-write wrapper for sync SQLite code paths. */
export function scheduleDualWriteAuthUser(
  params: DualWriteAuthUserParams
): void {
  void dualWriteAuthUser(params).catch((err) => {
    console.error("[pg-adapter] dualWriteAuthUser failed:", err);
  });
}
