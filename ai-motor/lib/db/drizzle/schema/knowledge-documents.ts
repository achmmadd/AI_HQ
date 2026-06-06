import { integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

/** File-ingest catalog — migrated from SQLite `knowledge_documents`. */
export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    legacySqliteId: text("legacy_sqlite_id"),
    klant: text("klant").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime"),
    contentSha256: text("content_sha256").notNull(),
    chunkCount: integer("chunk_count").notNull().default(0),
    qdrantCollection: text("qdrant_collection"),
    category: text("category"),
    tagsJson: text("tags_json"),
    warningsJson: text("warnings_json"),
    strategy: text("strategy"),
    maxChunkChars: integer("max_chunk_chars"),
    canonicalSource: text("canonical_source"),
    createdAt: timestamp("created_at", { withTimezone: true }),
  },
  (table) => [
    unique("knowledge_documents_workspace_sha256").on(
      table.workspaceId,
      table.contentSha256
    ),
  ]
);

export type KnowledgeDocumentRow = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocumentRow = typeof knowledgeDocuments.$inferInsert;
