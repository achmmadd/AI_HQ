CREATE TABLE IF NOT EXISTS "chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"legacy_sqlite_id" text,
	"klant" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"afdeling" text,
	"model" text,
	"tokens" integer,
	"conversation_id" text,
	"experiment_id" text,
	"experiment_variant" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"legacy_sqlite_id" text,
	"title" text NOT NULL,
	"description" text,
	"action" text NOT NULL,
	"payload" text,
	"status" text DEFAULT 'pending',
	"requested_by" text,
	"klant" text,
	"resolved_by" text,
	"reject_reason" text,
	"created_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"legacy_sqlite_id" text,
	"klant" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text,
	"content_sha256" text NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"qdrant_collection" text,
	"category" text,
	"tags_json" text,
	"warnings_json" text,
	"strategy" text,
	"max_chunk_chars" integer,
	"canonical_source" text,
	"created_at" timestamp with time zone,
	CONSTRAINT "knowledge_documents_workspace_sha256" UNIQUE("workspace_id","content_sha256")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"actor" text DEFAULT 'system' NOT NULL,
	"action" text NOT NULL,
	"resource" text,
	"detail_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_history_workspace" ON "chat_history" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approvals_workspace" ON "approvals" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_workspace" ON "knowledge_documents" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_workspace_created" ON "audit_events" ("workspace_id", "created_at");
