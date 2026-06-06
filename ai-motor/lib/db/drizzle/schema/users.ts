import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Platform user — maps SQLite `auth_users` (password hash format unchanged). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  /** SQLite auth_users.id for dual-write correlation until M4. */
  legacySqliteId: text("legacy_sqlite_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
