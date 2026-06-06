/**
 * GDPR data export/delete helpers (Sprint 2.3.3).
 * Workspace-scoped; SQLite (primary) + Postgres when USE_POSTGRES=1.
 */

import { eq, sql } from "drizzle-orm";
import type { AuthSession } from "@/lib/auth-session";
import db from "@/lib/db/database";
import { getDrizzleDbAdmin } from "@/lib/db/drizzle/client";
import {
  approvals,
  auditEvents,
  chatHistory,
  knowledgeDocuments,
  masterContexts,
  usageEvents,
} from "@/lib/db/drizzle/schema";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { shouldUsePostgres } from "@/lib/db/pg-flags";
import {
  assertWorkspaceSlugAccess,
  resolveWorkspaceIdBySlug,
} from "@/lib/workspace-context";

export type GdprExportBundle = {
  exported_at: string;
  workspace_slug: string;
  workspace_id: string | null;
  sqlite: Record<string, unknown[]>;
  postgres: Record<string, unknown[]> | null;
};

function sqliteKlantForSlug(slug: string): string | null {
  if (slug === "fumero" || slug === "bokas" || slug === "personal") return slug;
  return null;
}

export function canPerformGdprAction(
  session: AuthSession,
  workspaceSlug: string
): boolean {
  if (assertWorkspaceSlugAccess(session, workspaceSlug)) return false;
  if (session.role === "admin" || session.scope === "all") return true;
  return session.membershipRole === "admin";
}

function querySqliteByKlant(table: string, klant: string): unknown[] {
  return db
    .prepare(`SELECT * FROM ${table} WHERE klant = ? ORDER BY id ASC`)
    .all(klant) as unknown[];
}

function querySqliteAuditByKlant(klant: string): unknown[] {
  ensurePlatformSchema();
  return db
    .prepare(
      `SELECT * FROM audit_logs WHERE klant = ? OR klant IS NULL ORDER BY id ASC`
    )
    .all(klant) as unknown[];
}

function exportSqliteWorkspace(slug: string): Record<string, unknown[]> {
  ensurePlatformSchema();
  const klant = sqliteKlantForSlug(slug);
  const out: Record<string, unknown[]> = {};

  if (!klant) {
    out.audit_logs = db
      .prepare(`SELECT * FROM audit_logs ORDER BY id ASC LIMIT 500`)
      .all() as unknown[];
    return out;
  }

  const klantTables = [
    "chat_history",
    "conversations",
    "knowledge_documents",
    "approvals",
    "usage_logs",
    "content_posts",
    "content_templates",
    "uploads",
  ] as const;

  for (const table of klantTables) {
    try {
      out[table] = querySqliteByKlant(table, klant);
    } catch {
      out[table] = [];
    }
  }

  out.audit_logs = querySqliteAuditByKlant(klant);

  if (slug === "bokas") {
    const bokasTables = [
      "bokas_reserveringen",
      "bokas_personeel",
      "bokas_shifts",
      "bokas_menu",
    ] as const;
    for (const table of bokasTables) {
      try {
        out[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all();
      } catch {
        out[table] = [];
      }
    }
  }

  if (slug === "fumero") {
    try {
      out.fumero_reviews = db
        .prepare(`SELECT * FROM fumero_reviews ORDER BY id ASC`)
        .all();
    } catch {
      out.fumero_reviews = [];
    }
  }

  return out;
}

async function exportPostgresWorkspace(
  workspaceId: string
): Promise<Record<string, unknown[]>> {
  const pg = getDrizzleDbAdmin();
  if (!pg) return {};

  await pg.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  const [
    chatRows,
    approvalRows,
    knowledgeRows,
    auditRows,
    masterRows,
    usageRows,
  ] = await Promise.all([
    pg
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.workspaceId, workspaceId)),
    pg
      .select()
      .from(approvals)
      .where(eq(approvals.workspaceId, workspaceId)),
    pg
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.workspaceId, workspaceId)),
    pg
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, workspaceId)),
    pg
      .select()
      .from(masterContexts)
      .where(eq(masterContexts.workspaceId, workspaceId)),
    pg
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.workspaceId, workspaceId)),
  ]);

  return {
    chat_history: chatRows,
    approvals: approvalRows,
    knowledge_documents: knowledgeRows,
    audit_events: auditRows,
    master_contexts: masterRows,
    usage_events: usageRows,
  };
}

export async function exportWorkspaceData(
  workspaceSlug: string
): Promise<GdprExportBundle> {
  const slug = workspaceSlug.trim().toLowerCase();
  const workspaceId = await resolveWorkspaceIdBySlug(slug);

  const bundle: GdprExportBundle = {
    exported_at: new Date().toISOString(),
    workspace_slug: slug,
    workspace_id: workspaceId,
    sqlite: exportSqliteWorkspace(slug),
    postgres: null,
  };

  if (shouldUsePostgres() && workspaceId) {
    bundle.postgres = await exportPostgresWorkspace(workspaceId);
  }

  return bundle;
}

function deleteSqliteByKlant(table: string, klant: string): number {
  const result = db
    .prepare(`DELETE FROM ${table} WHERE klant = ?`)
    .run(klant);
  return result.changes;
}

function deleteSqliteWorkspace(slug: string): Record<string, number> {
  ensurePlatformSchema();
  const klant = sqliteKlantForSlug(slug);
  const counts: Record<string, number> = {};

  if (!klant) {
    return counts;
  }

  const klantTables = [
    "chat_history",
    "conversations",
    "knowledge_documents",
    "approvals",
    "usage_logs",
    "content_posts",
    "content_templates",
    "uploads",
  ] as const;

  for (const table of klantTables) {
    try {
      counts[table] = deleteSqliteByKlant(table, klant);
    } catch {
      counts[table] = 0;
    }
  }

  if (slug === "bokas") {
    const bokasTables = [
      "bokas_reserveringen",
      "bokas_shifts",
      "bokas_menu",
    ] as const;
    for (const table of bokasTables) {
      try {
        const r = db.prepare(`DELETE FROM ${table}`).run();
        counts[table] = r.changes;
      } catch {
        counts[table] = 0;
      }
    }
  }

  if (slug === "fumero") {
    try {
      const r = db.prepare(`DELETE FROM fumero_reviews`).run();
      counts.fumero_reviews = r.changes;
    } catch {
      counts.fumero_reviews = 0;
    }
  }

  return counts;
}

async function deletePostgresWorkspace(
  workspaceId: string
): Promise<Record<string, number>> {
  const pg = getDrizzleDbAdmin();
  if (!pg) return {};

  await pg.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  const counts: Record<string, number> = {};

  const del = async (table: string, run: () => Promise<unknown>) => {
    await run();
    counts[table] = -1;
  };

  await del("usage_events", () =>
    pg.delete(usageEvents).where(eq(usageEvents.workspaceId, workspaceId))
  );
  await del("chat_history", () =>
    pg.delete(chatHistory).where(eq(chatHistory.workspaceId, workspaceId))
  );
  await del("knowledge_documents", () =>
    pg
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.workspaceId, workspaceId))
  );
  await del("approvals", () =>
    pg.delete(approvals).where(eq(approvals.workspaceId, workspaceId))
  );
  await del("master_contexts", () =>
    pg.delete(masterContexts).where(eq(masterContexts.workspaceId, workspaceId))
  );

  return counts;
}

export type GdprDeleteResult = {
  deleted_at: string;
  workspace_slug: string;
  workspace_id: string | null;
  sqlite_deleted: Record<string, number>;
  postgres_deleted: Record<string, number> | null;
};

export async function deleteWorkspaceData(
  workspaceSlug: string
): Promise<GdprDeleteResult> {
  const slug = workspaceSlug.trim().toLowerCase();
  const workspaceId = await resolveWorkspaceIdBySlug(slug);

  const result: GdprDeleteResult = {
    deleted_at: new Date().toISOString(),
    workspace_slug: slug,
    workspace_id: workspaceId,
    sqlite_deleted: deleteSqliteWorkspace(slug),
    postgres_deleted: null,
  };

  if (shouldUsePostgres() && workspaceId) {
    result.postgres_deleted = await deletePostgresWorkspace(workspaceId);
  }

  return result;
}
