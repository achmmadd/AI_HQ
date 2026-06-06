CREATE TABLE IF NOT EXISTS "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"subject" text NOT NULL,
	"meter" text,
	"klant" text,
	"conversation_id" text,
	"model" text,
	"routing" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"cost_eur" real,
	"duration_ms" integer,
	"agent_label" text,
	"success" boolean DEFAULT true,
	"payload_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
