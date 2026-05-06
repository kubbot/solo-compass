-- 0003_traffic_pings.sql
-- Passive anonymous GPS traffic. One row per (experience, visitor).
-- Conflict on the composite PK updates pinged_at so each visitor is counted
-- only once per experience in any given 7-day window query.
--
-- anon_id is a SHA-256 hex of (ip:ua:experience_id) — non-reversible,
-- scoped to a single experience so it cannot be used to correlate across rows.

CREATE TABLE IF NOT EXISTS traffic_pings (
  experience_id TEXT NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  anon_id       TEXT NOT NULL,
  pinged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (experience_id, anon_id)
);

CREATE INDEX IF NOT EXISTS traffic_pings_experience_id_pinged_at
  ON traffic_pings(experience_id, pinged_at DESC);
