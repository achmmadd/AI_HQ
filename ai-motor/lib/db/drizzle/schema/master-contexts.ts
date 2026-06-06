import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

/** Master Context File — markdown workspace preamble (Sprint 1.3). */
export const masterContexts = pgTable("master_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export type MasterContextRow = typeof masterContexts.$inferSelect;
export type NewMasterContextRow = typeof masterContexts.$inferInsert;
