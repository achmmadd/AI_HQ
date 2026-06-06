import {
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const membershipRoles = ["admin", "editor", "viewer"] as const;
export type MembershipRole = (typeof membershipRoles)[number];

/** Legacy auth role preserved for migration — maps auth_users.role / scope. */
export const legacyAuthRoles = ["admin", "fumero", "bokas"] as const;
export type LegacyAuthRole = (typeof legacyAuthRoles)[number];

export const workspaceScopes = ["all", "fumero", "bokas", "personal"] as const;
export type WorkspaceScope = (typeof workspaceScopes)[number];

/** Users ↔ workspaces many-to-many with role + scope. */
export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"),
    /** Mirrors SQLite auth_users.scope until session carries workspace_id (Sprint 1.2). */
    scope: text("scope").notNull().default("fumero"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("workspace_memberships_workspace_user_unique").on(table.workspaceId, table.userId)]
);

export type WorkspaceMembership = typeof workspaceMemberships.$inferSelect;
export type NewWorkspaceMembership = typeof workspaceMemberships.$inferInsert;
