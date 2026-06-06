/**
 * Workspace team members — list, role updates, invite stubs (Sprint 4.3).
 */
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import type { AuthSession, MembershipRole } from "@/lib/auth-session";
import { getDrizzleDb, getDrizzleDbAdmin } from "@/lib/db/drizzle/client";
import { users, workspaceMemberships } from "@/lib/db/drizzle/schema";
import { membershipRoles } from "@/lib/db/drizzle/schema/workspace-memberships";
import { shouldUsePostgres } from "@/lib/db/pg-flags";
import { resolveWorkspaceIdBySlug } from "@/lib/workspace-context";

export type WorkspaceMemberRow = {
  id: string;
  userId: string;
  email: string;
  role: MembershipRole;
  createdAt: string;
};

export type PendingInviteRow = {
  id: string;
  email: string;
  role: MembershipRole;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
};

/** In-memory invite stubs — no email infra yet (Sprint 4.3 skeleton). */
const pendingInvites = new Map<string, PendingInviteRow[]>();

function inviteKey(workspaceId: string): string {
  return workspaceId;
}

function getDb() {
  return getDrizzleDb() ?? getDrizzleDbAdmin();
}

async function withBypassRls(): Promise<void> {
  const db = getDb();
  if (!db || shouldUsePostgres()) return;
  await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);
}

export function isMembershipRole(value: string): value is MembershipRole {
  return (membershipRoles as readonly string[]).includes(value);
}

export function assertWorkspaceAdmin(
  session: AuthSession
): NextResponse | null {
  const role = session.membershipRole ?? (session.role === "admin" ? "admin" : null);
  if (role !== "admin" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Alleen workspace-beheerders mogen dit" },
      { status: 403 }
    );
  }
  return null;
}

/** List active members for a workspace slug. */
export async function listWorkspaceMembers(
  workspaceSlug: string
): Promise<WorkspaceMemberRow[]> {
  const workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug);
  if (!workspaceId) return [];

  const db = getDb();
  if (!db) return [];

  await withBypassRls();

  const rows = await db
    .select({
      id: workspaceMemberships.id,
      userId: workspaceMemberships.userId,
      email: users.email,
      role: workspaceMemberships.role,
      createdAt: workspaceMemberships.createdAt,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(eq(workspaceMemberships.workspaceId, workspaceId));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.email,
    role: isMembershipRole(row.role) ? row.role : "viewer",
    createdAt: row.createdAt.toISOString(),
  }));
}

/** List pending invite stubs for a workspace. */
export function listPendingInvites(workspaceSlug: string): PendingInviteRow[] {
  return pendingInvites.get(inviteKey(workspaceSlug)) ?? [];
}

/** Create invite stub — returns link; no email sent. */
export async function createInviteStub(opts: {
  workspaceSlug: string;
  email: string;
  role: MembershipRole;
  baseUrl: string;
}): Promise<PendingInviteRow> {
  const workspaceId = await resolveWorkspaceIdBySlug(opts.workspaceSlug);
  if (!workspaceId) {
    throw new Error("Workspace niet gevonden");
  }

  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inviteUrl = `${opts.baseUrl.replace(/\/$/, "")}/login?invite=${token}&workspace=${encodeURIComponent(opts.workspaceSlug)}`;

  const invite: PendingInviteRow = {
    id: token.slice(0, 12),
    email: opts.email.trim().toLowerCase(),
    role: opts.role,
    inviteUrl,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const key = inviteKey(opts.workspaceSlug);
  const existing = pendingInvites.get(key) ?? [];
  pendingInvites.set(
    key,
    existing.filter((i) => i.email !== invite.email).concat(invite)
  );

  return invite;
}

/** Update member role (admin only). */
export async function updateMemberRole(opts: {
  workspaceSlug: string;
  memberId: string;
  role: MembershipRole;
}): Promise<WorkspaceMemberRow | null> {
  const workspaceId = await resolveWorkspaceIdBySlug(opts.workspaceSlug);
  if (!workspaceId) return null;

  const db = getDb();
  if (!db) return null;

  await withBypassRls();

  const [member] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      sql`${workspaceMemberships.id} = ${opts.memberId} AND ${workspaceMemberships.workspaceId} = ${workspaceId}`
    )
    .limit(1);

  if (!member) return null;

  await db
    .update(workspaceMemberships)
    .set({ role: opts.role, updatedAt: new Date() })
    .where(eq(workspaceMemberships.id, opts.memberId));

  const members = await listWorkspaceMembers(opts.workspaceSlug);
  return members.find((m) => m.id === opts.memberId) ?? null;
}

/** Remove member from workspace (admin only). */
export async function removeMember(opts: {
  workspaceSlug: string;
  memberId: string;
}): Promise<boolean> {
  const workspaceId = await resolveWorkspaceIdBySlug(opts.workspaceSlug);
  if (!workspaceId) return false;

  const db = getDb();
  if (!db) return false;

  await withBypassRls();

  const [existing] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      sql`${workspaceMemberships.id} = ${opts.memberId} AND ${workspaceMemberships.workspaceId} = ${workspaceId}`
    )
    .limit(1);

  if (!existing) return false;

  await db
    .delete(workspaceMemberships)
    .where(eq(workspaceMemberships.id, opts.memberId));

  return true;
}

/** Revoke pending invite stub. */
export function revokeInviteStub(opts: {
  workspaceSlug: string;
  inviteId: string;
}): boolean {
  const key = inviteKey(opts.workspaceSlug);
  const existing = pendingInvites.get(key) ?? [];
  const filtered = existing.filter((i) => i.id !== opts.inviteId);
  if (filtered.length === existing.length) return false;
  pendingInvites.set(key, filtered);
  return true;
}
