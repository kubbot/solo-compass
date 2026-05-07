CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."experience_status" AS ENUM('candidate', 'active', 'stale', 'retired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"one_liner" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"category" text NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"confidence_level" integer DEFAULT 0 NOT NULL,
	"status" "experience_status" DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_compiled_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experiences_location_idx" ON "experiences" USING GIST ("location");
