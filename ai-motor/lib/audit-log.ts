import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { getDrizzleDb } from "@/lib/db/drizzle/client";
import { auditEvents } from "@/lib/db/drizzle/schema";
import {
  resolveWorkspaceIdBySlug,
  workspaceSlugForKlant,
} from "@/lib/workspace-context";
import { shouldDualWrite } from "@/lib/db/pg-flags";

export function logAudit(opts: {
  actor?: string | null;
  userId?: string | null;
  action: string;
  resource?: string | null;
  detail?: Record<string, unknown> | null;
  klant?: string | null;
  workspaceSlug?: string | null;
}): void {
  ensurePlatformSchema();
  db.prepare(
    `INSERT INTO audit_logs (actor, action, resource, detail_json, klant)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    opts.actor ?? "system",
    opts.action.slice(0, 128),
    opts.resource?.slice(0, 256) ?? null,
    opts.detail ? JSON.stringify(opts.detail).slice(0, 8000) : null,
    opts.klant ?? null
  );

  if (!shouldDualWrite()) return;

  void writeAuditEventPg(opts).catch((err) => {
    console.error("[audit-log] PG audit_events write failed:", err);
  });
}

async function writeAuditEventPg(opts: {
  actor?: string | null;
  userId?: string | null;
  action: string;
  resource?: string | null;
  detail?: Record<string, unknown> | null;
  klant?: string | null;
  workspaceSlug?: string | null;
}): Promise<void> {
  const db = getDrizzleDb();
  if (!db) return;

  const slug =
    opts.workspaceSlug ??
    (opts.klant ? workspaceSlugForKlant(opts.klant) : "motor");
  const workspaceId = await resolveWorkspaceIdBySlug(slug);
  if (!workspaceId) return;

  const { setPgWorkspaceContext } = await import("@/lib/db/pg-adapter");
  await setPgWorkspaceContext({
    workspaceId,
    userId: opts.userId ?? undefined,
  });

  await db.insert(auditEvents).values({
    workspaceId,
    userId: opts.userId ?? null,
    actor: opts.actor ?? "system",
    action: opts.action.slice(0, 128),
    resource: opts.resource?.slice(0, 256) ?? null,
    detailJson: opts.detail
      ? JSON.stringify(opts.detail).slice(0, 8000)
      : null,
  });
}
