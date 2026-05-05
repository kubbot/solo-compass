-- 0001_initial.sql
-- Initial schema for Solo Compass.
--
-- Requires PostGIS extension (enable in Supabase dashboard:
--   Database → Extensions → postgis)

-- ─── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists postgis;

-- ─── Users ─────────────────────────────────────────────────────────────────────
-- Minimal — no real names, no email required at Phase 2.
-- Telegram/anonymous flows use a generated handle only.
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  handle      text not null unique,          -- e.g. "wanderer_42" — never a real name
  created_at  timestamptz not null default now()
);

-- ─── Experiences ───────────────────────────────────────────────────────────────
-- Mirrors Experience interface in packages/core/src/experience.ts.
-- Scalar fields are flat columns; nested/array fields are JSONB.
create table if not exists experiences (
  id                  text primary key,      -- "exp_cmi_suan_dok_sunset"
  title               text not null,
  one_liner           text not null,
  why_it_matters      text not null,
  category            text not null check (category in (
                        'culture','nature','food','coffee',
                        'work','wellness','nightlife','hidden'
                      )),

  -- Location — PostGIS geography for accurate distance queries
  location            geography(Point, 4326) not null,
  city_code           text not null,
  address_hint        text,
  place_name_local    text,
  place_name_romanized text,

  -- Time windows: [{startHour, endHour, dayOfWeek?, season?, note?}]
  best_times          jsonb not null default '[]',

  -- Duration range in minutes
  duration_min        integer not null,
  duration_max        integer not null,

  -- How-to steps: [{order, text}]
  how_to              jsonb not null default '[]',

  -- Real inconveniences: [{category, text}]
  real_inconveniences jsonb not null default '[]',

  -- Solo score: {overall, breakdown:{...}, hint?, basedOnCount}
  solo_score          jsonb not null,

  -- Sources: [{type, url?, attribution?, verifiedAt}]
  sources             jsonb not null default '[]',

  -- Confidence: {level, lastVerifiedAt, reason, signals:{...}}
  confidence          jsonb not null,

  -- Nearby experience IDs (expanded by recommendation engine on demand)
  nearby_experience_ids text[] not null default '{}',

  -- Aggregate stats — denormalised, updated by background job
  completion_count    integer not null default 0,
  average_rating      numeric(3,1) not null default 0,
  last_completed_at   timestamptz,

  status              text not null default 'candidate' check (status in (
                        'candidate','active','stale','retired'
                      )),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- GiST index on geography column — required for ST_DWithin to be fast
create index if not exists experiences_location_gist
  on experiences using gist (location);

-- Btree indexes for common filter queries
create index if not exists experiences_city_code_idx   on experiences (city_code);
create index if not exists experiences_category_idx    on experiences (category);
create index if not exists experiences_status_idx      on experiences (status);

-- ─── Completions ───────────────────────────────────────────────────────────────
-- A user marking an experience as done.
create table if not exists completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  experience_id   text not null references experiences (id) on delete cascade,
  completed_at    timestamptz not null default now(),
  rating          integer check (rating between 1 and 5),
  note            text,                    -- optional short voice-to-text note
  unique (user_id, experience_id)          -- one completion record per pair
);

create index if not exists completions_user_id_idx        on completions (user_id);
create index if not exists completions_experience_id_idx  on completions (experience_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────────
alter table users       enable row level security;
alter table experiences enable row level security;
alter table completions enable row level security;

-- Experiences: everyone can read active ones; only service role can write
create policy "experiences_public_read" on experiences
  for select using (status = 'active');

-- Completions: users see only their own
create policy "completions_own_read" on completions
  for select using (user_id = auth.uid()::uuid);

create policy "completions_own_insert" on completions
  for insert with check (user_id = auth.uid()::uuid);

create policy "completions_own_delete" on completions
  for delete using (user_id = auth.uid()::uuid);

-- Users: each user can read their own row; insert handled by auth trigger
create policy "users_own_read" on users
  for select using (id = auth.uid()::uuid);

-- ─── Helper: auto-update updated_at ───────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger experiences_updated_at
  before update on experiences
  for each row execute function update_updated_at();
