-- Solo Compass — initial Supabase schema (Epic E US-026)
--
-- Apply with `supabase db push` after `supabase link --project-ref <ref>`.
-- Tables fall into three groups:
--   1. User-scoped data (profiles, completions, favorites, surveys,
--      subscription events, recent regions) — RLS enforces
--      user_id = auth.uid() per row.
--   2. Shared cache (synthesized_experiences, osm_pois, solo_score_signals
--      aggregates) — read-public, write-service-role only.
--   3. Function call accounting (sc_function_calls) — internal, read by
--      Edge Functions for rate limiting.

begin;

-- ─── 1. User-scoped tables ──────────────────────────────────────────────

create table if not exists public.profiles (
  user_id            uuid          primary key references auth.users(id) on delete cascade,
  is_anonymous       boolean       not null default true,
  entitlement_tier   text          not null default 'free' check (entitlement_tier in ('free', 'pro_trial', 'pro', 'pro_expired')),
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create table if not exists public.user_completions (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  experience_id   text          not null,
  completed_at    timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
create index if not exists user_completions_user_idx on public.user_completions(user_id);
create index if not exists user_completions_exp_idx  on public.user_completions(experience_id);

create table if not exists public.user_favorites (
  user_id         uuid          not null references auth.users(id) on delete cascade,
  experience_id   text          not null,
  favorited_at    timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  primary key (user_id, experience_id)
);

create table if not exists public.micro_surveys (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  experience_id   text          not null,
  comfort         smallint      not null check (comfort between 1 and 5),
  pressure        smallint      not null check (pressure between 1 and 5),
  recommend       text          not null check (recommend in ('yes', 'depends', 'no')),
  submitted_at    timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
create index if not exists micro_surveys_exp_idx on public.micro_surveys(experience_id);

create table if not exists public.subscription_events (
  id                       uuid          primary key default gen_random_uuid(),
  user_id                  uuid          not null references auth.users(id) on delete cascade,
  event_type               text          not null check (event_type in ('subscribed', 'expired', 'in_grace_period', 'revoked', 'upgraded')),
  product_id               text          not null,
  original_purchase_date   timestamptz,
  expires_date             timestamptz,
  is_in_trial_period       boolean       not null default false,
  device_id                text,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz   not null default now()
);
create index if not exists subscription_events_user_idx on public.subscription_events(user_id);

create table if not exists public.recent_explore_regions (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  center_lat      double precision not null,
  center_lon      double precision not null,
  radius_meters   integer       not null,
  explored_at     timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
create index if not exists recent_regions_user_idx on public.recent_explore_regions(user_id);

-- ─── 2. Shared (community) cache ────────────────────────────────────────

create table if not exists public.osm_pois (
  osm_id          bigint        primary key,
  name            text          not null,
  name_en         text,
  lat             double precision not null,
  lon             double precision not null,
  tags            jsonb         not null default '{}'::jsonb,
  fetched_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
create index if not exists osm_pois_geo_idx on public.osm_pois(lat, lon);

create table if not exists public.synthesized_experiences (
  id                          text          primary key, -- "exp_osm_<osmId>"
  city_code                   text          not null,
  payload                     jsonb         not null,    -- full Experience JSON
  model_name                  text          not null,
  source_cache_key            text          not null,    -- SHA256 of canonical input batch
  -- aggregate refreshed nightly; null until enough signals.
  aggregated_solo_score       double precision,
  signal_count                integer       not null default 0,
  synthesized_at              timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now()
);
create index if not exists synth_exp_city_idx     on public.synthesized_experiences(city_code);
create index if not exists synth_exp_cachekey_idx on public.synthesized_experiences(source_cache_key);

create table if not exists public.solo_score_signals (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          references auth.users(id) on delete set null,
  experience_id   text          not null,
  comfort         smallint      not null check (comfort between 1 and 5),
  pressure        smallint      not null check (pressure between 1 and 5),
  recommend       text          not null check (recommend in ('yes', 'depends', 'no')),
  submitted_at    timestamptz   not null default now()
);
create index if not exists solo_signals_exp_idx on public.solo_score_signals(experience_id);

-- ─── 3. Internal accounting ─────────────────────────────────────────────

create table if not exists public.sc_function_calls (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  function_name   text          not null,
  called_at       timestamptz   not null default now()
);
create index if not exists sc_function_calls_user_day_idx
  on public.sc_function_calls(user_id, called_at desc);

-- ─── RLS: per-user data tables ──────────────────────────────────────────

alter table public.profiles                enable row level security;
alter table public.user_completions        enable row level security;
alter table public.user_favorites          enable row level security;
alter table public.micro_surveys           enable row level security;
alter table public.subscription_events     enable row level security;
alter table public.recent_explore_regions  enable row level security;
alter table public.sc_function_calls       enable row level security;

-- profiles: each user reads/writes their own row only.
create policy "profiles self-select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles self-upsert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles self-update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_completions: standard CRUD scoped to auth.uid().
create policy "completions self-select" on public.user_completions
  for select using (auth.uid() = user_id);
create policy "completions self-insert" on public.user_completions
  for insert with check (auth.uid() = user_id);
create policy "completions self-update" on public.user_completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "completions self-delete" on public.user_completions
  for delete using (auth.uid() = user_id);

create policy "favorites self-select" on public.user_favorites
  for select using (auth.uid() = user_id);
create policy "favorites self-insert" on public.user_favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites self-update" on public.user_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites self-delete" on public.user_favorites
  for delete using (auth.uid() = user_id);

create policy "surveys self-select" on public.micro_surveys
  for select using (auth.uid() = user_id);
create policy "surveys self-insert" on public.micro_surveys
  for insert with check (auth.uid() = user_id);
create policy "surveys self-update" on public.micro_surveys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "surveys self-delete" on public.micro_surveys
  for delete using (auth.uid() = user_id);

create policy "sub_events self-select" on public.subscription_events
  for select using (auth.uid() = user_id);
create policy "sub_events self-insert" on public.subscription_events
  for insert with check (auth.uid() = user_id);

create policy "regions self-select" on public.recent_explore_regions
  for select using (auth.uid() = user_id);
create policy "regions self-insert" on public.recent_explore_regions
  for insert with check (auth.uid() = user_id);
create policy "regions self-update" on public.recent_explore_regions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "regions self-delete" on public.recent_explore_regions
  for delete using (auth.uid() = user_id);

-- sc_function_calls: users can read their own (for self-quotas display)
-- but never insert. Service role bypasses RLS to insert.
create policy "func_calls self-select" on public.sc_function_calls
  for select using (auth.uid() = user_id);

-- ─── RLS: shared cache (read-public) ────────────────────────────────────

alter table public.osm_pois                   enable row level security;
alter table public.synthesized_experiences    enable row level security;
alter table public.solo_score_signals         enable row level security;

create policy "osm_pois public-read" on public.osm_pois
  for select using (true);

create policy "synth_exp public-read" on public.synthesized_experiences
  for select using (true);

-- solo_score_signals: only signal-owner can SELECT (privacy);
-- aggregated_solo_score lives on synthesized_experiences (public).
create policy "signals self-select" on public.solo_score_signals
  for select using (auth.uid() = user_id);
create policy "signals self-insert" on public.solo_score_signals
  for insert with check (auth.uid() = user_id);

-- Note: writes to osm_pois and synthesized_experiences happen ONLY via
-- the service-role key inside Edge Functions. Service role bypasses
-- RLS, so no public INSERT/UPDATE/DELETE policies exist here on
-- purpose — that's the security boundary.

-- ─── updated_at touch trigger ──────────────────────────────────────────

create or replace function public.sc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sc_profiles_touch                before update on public.profiles                for each row execute function public.sc_touch_updated_at();
create trigger sc_completions_touch             before update on public.user_completions        for each row execute function public.sc_touch_updated_at();
create trigger sc_favorites_touch               before update on public.user_favorites          for each row execute function public.sc_touch_updated_at();
create trigger sc_surveys_touch                 before update on public.micro_surveys           for each row execute function public.sc_touch_updated_at();
create trigger sc_sub_events_touch              before update on public.subscription_events     for each row execute function public.sc_touch_updated_at();
create trigger sc_regions_touch                 before update on public.recent_explore_regions  for each row execute function public.sc_touch_updated_at();
create trigger sc_osm_pois_touch                before update on public.osm_pois                for each row execute function public.sc_touch_updated_at();
create trigger sc_synth_exp_touch               before update on public.synthesized_experiences for each row execute function public.sc_touch_updated_at();

commit;
