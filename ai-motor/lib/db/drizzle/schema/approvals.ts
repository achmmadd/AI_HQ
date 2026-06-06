import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

/** HITL approvals — migrated from SQLite `approvals`. */
export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  legacySqliteId: text("legacy_sqlite_id"),
  title: text("title").notNull(),
  description: text("description"),
  action: text("action").notNull(),
  payload: text("payload"),
  status: text("status").default("pending"),
  requestedBy: text("requested_by"),
  klant: text("klant"),
  resolvedBy: text("resolved_by"),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type ApprovalRow = typeof approvals.$inferSelect;
export type NewApprovalRow = typeof approvals.$inferInsert;
