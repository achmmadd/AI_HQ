import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

/** Chat messages — migrated from SQLite `chat_history`, scoped by workspace. */
export const chatHistory = pgTable("chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  legacySqliteId: text("legacy_sqlite_id"),
  klant: text("klant").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  afdeling: text("afdeling"),
  model: text("model"),
  tokens: integer("tokens"),
  conversationId: text("conversation_id"),
  experimentId: text("experiment_id"),
  experimentVariant: text("experiment_variant"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export type ChatHistoryRow = typeof chatHistory.$inferSelect;
export type NewChatHistoryRow = typeof chatHistory.$inferInsert;
