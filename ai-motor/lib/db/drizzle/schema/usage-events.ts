import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

/** OpenMeter-shaped LLM usage events — PG store for billing/analytics (Sprint 2.3.2). */
export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
  source: text("source").notNull(),
  subject: text("subject").notNull(),
  meter: text("meter"),
  klant: text("klant"),
  conversationId: text("conversation_id"),
  model: text("model"),
  routing: text("routing"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  costEur: real("cost_eur"),
  durationMs: integer("duration_ms"),
  agentLabel: text("agent_label"),
  success: boolean("success").default(true),
  payloadJson: text("payload_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UsageEventRow = typeof usageEvents.$inferSelect;
export type NewUsageEventRow = typeof usageEvents.$inferInsert;
