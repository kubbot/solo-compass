-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- experience_status enum
DO $$ BEGIN
  CREATE TYPE "experience_status" AS ENUM (
    'candidate',
    'active',
    'stale',
    'retired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- experiences table
CREATE TABLE IF NOT EXISTS "experiences" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title"            text NOT NULL,
  "one_liner"        text NOT NULL,
  "why_it_matters"   text NOT NULL,
  "category"         text NOT NULL,
  "location"         geography(Point,4326) NOT NULL,
  "confidence_level" integer NOT NULL DEFAULT 0,
  "status"           "experience_status" NOT NULL DEFAULT 'candidate',
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  "last_compiled_at" timestamptz
);

-- GIST spatial index on location
CREATE INDEX IF NOT EXISTS "experiences_location_idx"
  ON "experiences" USING GIST ("location");
