/**
 * Master Context File per workspace — loaded in chat preamble before klant persona.
 */
import { eq, sql } from "drizzle-orm";
import { getDrizzleDb, getDrizzleDbAdmin } from "@/lib/db/drizzle/client";
import { masterContexts } from "@/lib/db/drizzle/schema";
import { shouldUsePostgres } from "@/lib/db/pg-flags";
import { formatMasterContextBlock } from "@/lib/master-context-format";
import {
  resolveWorkspaceIdBySlug,
  workspaceSlugForKlant,
} from "@/lib/workspace-context";

export { formatMasterContextBlock };

export type MasterContextRecord = {
  workspaceSlug: string;
  workspaceId: string;
  content: string;
  updatedAt: string;
};

const contentCache = new Map<string, { content: string; expires: number }>();
const CACHE_TTL_MS = 60_000;

function cacheKey(slug: string): string {
  return slug.trim().toLowerCase();
}

function readCache(slug: string): string | null {
  const hit = contentCache.get(cacheKey(slug));
  if (!hit || hit.expires < Date.now()) {
    contentCache.delete(cacheKey(slug));
    return null;
  }
  return hit.content;
}

function writeCache(slug: string, content: string): void {
  contentCache.set(cacheKey(slug), {
    content,
    expires: Date.now() + CACHE_TTL_MS,
  });
}

function invalidateCache(slug: string): void {
  contentCache.delete(cacheKey(slug));
}

/** Load master context markdown for a klant query param. */
export async function getMasterContextForKlant(
  klant: string
): Promise<string | null> {
  const slug = workspaceSlugForKlant(klant);
  const cached = readCache(slug);
  if (cached !== null) return cached || null;

  const record = await getMasterContextByWorkspaceSlug(slug);
  const content = record?.content.trim() ?? "";
  writeCache(slug, content);
  return content || null;
}

/** GET master context by workspace slug. */
export async function getMasterContextByWorkspaceSlug(
  slug: string
): Promise<MasterContextRecord | null> {
  const workspaceId = await resolveWorkspaceIdBySlug(slug);
  if (!workspaceId) return null;

  const db = getDrizzleDb() ?? getDrizzleDbAdmin();
  if (!db) return null;

  if (!shouldUsePostgres()) {
    await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);
  }

  const [row] = await db
    .select({
      content: masterContexts.content,
      updatedAt: masterContexts.updatedAt,
    })
    .from(masterContexts)
    .where(eq(masterContexts.workspaceId, workspaceId))
    .limit(1);

  if (!row) {
    return {
      workspaceSlug: slug,
      workspaceId,
      content: "",
      updatedAt: new Date(0).toISOString(),
    };
  }

  return {
    workspaceSlug: slug,
    workspaceId,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** PATCH master context content for a workspace. */
export async function upsertMasterContext(opts: {
  workspaceSlug: string;
  workspaceId: string;
  content: string;
  updatedByUserId?: string | null;
}): Promise<MasterContextRecord> {
  const db = getDrizzleDb() ?? getDrizzleDbAdmin();
  if (!db) {
    throw new Error("Postgres niet beschikbaar (DATABASE_URL?)");
  }

  const now = new Date();
  const content = opts.content ?? "";

  const [existing] = await db
    .select({ id: masterContexts.id })
    .from(masterContexts)
    .where(eq(masterContexts.workspaceId, opts.workspaceId))
    .limit(1);

  if (existing) {
    await db
      .update(masterContexts)
      .set({
        content,
        updatedAt: now,
        updatedBy: opts.updatedByUserId ?? null,
      })
      .where(eq(masterContexts.workspaceId, opts.workspaceId));
  } else {
    await db.insert(masterContexts).values({
      workspaceId: opts.workspaceId,
      content,
      updatedAt: now,
      updatedBy: opts.updatedByUserId ?? null,
    });
  }

  invalidateCache(opts.workspaceSlug);

  return {
    workspaceSlug: opts.workspaceSlug,
    workspaceId: opts.workspaceId,
    content,
    updatedAt: now.toISOString(),
  };
}
