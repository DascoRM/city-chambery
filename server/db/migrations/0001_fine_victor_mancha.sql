CREATE TABLE "edit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"action" text NOT NULL,
	"data" jsonb,
	"source" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_edits" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
