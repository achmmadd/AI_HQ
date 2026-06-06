import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** White-label tenant workspace — maps legacy `klant` slug (fumero, bokas, …). */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** Legacy SQLite `klant` column for migration (fumero, bokas, system, algemeen). */
  legacyKlant: text("legacy_klant"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
