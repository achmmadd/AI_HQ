import { eq } from "drizzle-orm";
import type { DrizzleDb } from "./client";
import { workspaces } from "./schema";

const DEFAULT_WORKSPACES = [
  { slug: "fumero", displayName: "Fumero", legacyKlant: "fumero" },
  { slug: "bokas", displayName: "Bokas", legacyKlant: "bokas" },
  { slug: "motor", displayName: "Motor AI Factory", legacyKlant: "system" },
  { slug: "personal", displayName: "Personal", legacyKlant: "personal" },
] as const;

/** Idempotent seed — maps existing fumero/bokas tenants to workspace rows. */
export async function seedDefaultWorkspaces(db: DrizzleDb): Promise<void> {
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`SELECT set_config('app.bypass_rls', '1', false)`);

  for (const ws of DEFAULT_WORKSPACES) {
    const existing = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, ws.slug))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(workspaces).values({
      slug: ws.slug,
      displayName: ws.displayName,
      legacyKlant: ws.legacyKlant,
    });
  }
}

export function workspaceSlugForLegacyKlant(klant: string): string {
  const k = klant.trim().toLowerCase();
  if (k === "fumero" || k === "bokas" || k === "personal") return k;
  if (k === "system" || k === "algemeen") return "motor";
  return "motor";
}
