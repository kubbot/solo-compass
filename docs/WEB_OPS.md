# Web Operations Runbook

> Last updated 2026-05-09. Companion to Epic I in `tasks/prd-paid-app-foundation.md`.
> This file is the single source of truth for "where does this account
> live, what name is it under, who has access, how do you rotate the
> credential."

## Account inventory

| Account                  | Owner email                                 | Plan / cost              | Where credentials live   | Status                           |
| ------------------------ | ------------------------------------------- | ------------------------ | ------------------------ | -------------------------------- |
| Apple Developer Program  | (founder personal Apple ID)                 | $99/yr                   | iCloud Keychain          | Verify active before week 4      |
| App Store Connect        | (same Apple ID)                             | included                 | iCloud Keychain          | App entry created in Week 0      |
| Mapbox                   | (founder Gmail)                             | Free (50k loads/mo)      | 1Password                | Account created in Week 0        |
| Supabase                 | (founder Gmail)                             | Pro $25/mo (PITR)        | 1Password                | Project created in Week 0        |
| Anthropic                | (founder Gmail)                             | Pay-as-you-go ~$50–200/mo| 1Password + Edge Function| Prod workspace by week 5         |
| Vercel                   | (founder GitHub login)                      | Hobby (free, < 100GB)    | Vercel UI                | Project linked in Week 0         |
| Sentry                   | (founder Gmail)                             | Free (10k errors/mo)     | 1Password                | Two projects by week 7           |
| PostHog                  | (founder Gmail)                             | Free (1M events/mo)      | 1Password                | One project by week 7            |
| Cloudflare (DNS + email) | DEFERRED to v1.2                            | Free                     | n/a                      | Skipped — see PRD US-I3          |
| Domain registrar         | DEFERRED to v1.2                            | $0 in v1.0               | n/a                      | Skipped                          |
| Notion                   | (founder existing account)                  | Free                     | n/a                      | Public page for privacy by week 1|
| Gmail support alias      | `solocompass.support@gmail.com`             | Free                     | Gmail                    | Set up in Week 0                 |

## URLs in production (v1.0)

- **iOS bundle id:** `com.solocompass.app`
- **iOS App Store URL:** assigned by Apple after first approval
- **Web (Vercel default):** `https://solo-compass.vercel.app` (or auto-assigned alias)
- **Privacy policy:** `https://solocompass.notion.site/privacy` (Notion public page; mirrors `docs/PRIVACY.md`)
- **Terms of service:** `https://solocompass.notion.site/terms` (Notion public page; to draft)
- **Customer support:** `solocompass.support@gmail.com`
- **Supabase region:** Singapore (`ap-southeast-1`)
- **Vercel region:** Singapore (`sin1` or `hnd1`)
- **Mapbox token domain lock:** `*.vercel.app`

When v1.2 lands a real domain, update this section and `apps/web/.env.production`.

## Mapbox

### Tokens

Two tokens, both scoped read-only (`styles:read`, `fonts:read`, `tiles:read`):

- **production** — domain-restricted to `*.vercel.app` until a custom domain replaces it. Used in Vercel production env (`NEXT_PUBLIC_MAPBOX_TOKEN`).
- **development** — unrestricted, used in `apps/web/.env.local` for local dev.

### Custom map style

- Studio account: `solocompass`
- Style id: `mapbox://styles/solocompass/<style-id>` (record exact id here once created)
- Theme: warm cream basemap, muted street labels, terracotta highlights for selected POIs
- Recorded in `apps/web/src/lib/map-style.ts`

### Rotation procedure

1. Create new token in Mapbox Studio.
2. Update `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel project → Settings → Environment Variables → Production.
3. Trigger a redeploy.
4. Wait 1 hour for CDN propagation.
5. Delete the old token.

## Supabase

### Project

- Name: `solo-compass-prod`
- Region: Singapore (`ap-southeast-1`)
- Plan: Pro ($25/mo, includes PITR — never run on Free for production)
- Database password stored in 1Password under "Solo Compass / Supabase / Postgres password"

### Keys

- `SUPABASE_URL` — public, ok to ship
- `SUPABASE_ANON_KEY` — public, ok to ship (RLS protects everything)
- `SUPABASE_SERVICE_ROLE_KEY` — secret, **never ships to client**, used only by Vercel server-side and Supabase Edge Functions

### Backups

- PITR enabled (Pro plan default)
- Manual snapshot procedure: Supabase dashboard → Database → Backups → "Take backup now". Document each release tag's pre-deploy snapshot in `docs/RUNBOOK.md`.
- Restore procedure: documented and tested at least once before GA.

## Anthropic

### Workspaces

- **dev** — for local development, uses founder's personal email. Generous spend cap of $20/mo (catches local-test runaways).
- **prod** — separate workspace for production traffic. Hard cap $200/mo. Soft alert at $50/mo emails the founder.

### Keys

- `ANTHROPIC_API_KEY_DEV` — in `apps/ios/SoloCompass/Resources/Secrets.plist` for iOS dev builds and `apps/web/.env.local` for web dev
- `ANTHROPIC_API_KEY_PROD` — only in Supabase Edge Function secrets (`synthesize-experiences`); after Epic E ships, **iOS bundle no longer contains an Anthropic key at all**

### Models in use

- **Synthesis** (Explore Here, voice intent): `claude-sonnet-4-6`
- **Explanation** (per-experience AI insight): `claude-haiku-4-5-20251001`
- **Debug override**: env var `AI_FORCE_OPUS=1` routes everything to `claude-opus-4-7` for golden-set comparison

### Cost monitoring

- Anthropic Console → Usage tab — monitor weekly
- Supabase scheduled Edge Function `weekly-cost-report` (US-I10) emits a Markdown summary every Monday 09:00 SGT
- Prompt caching enabled on the synthesis system prompt; expected savings 50–80% on repeat calls

### Rotation procedure

1. Create new key in Anthropic Console → API Keys → "Create Key" with same workspace.
2. Update Supabase Edge Function secret: `supabase secrets set ANTHROPIC_API_KEY_PROD=<new>`.
3. Wait for next Edge Function cold start (or trigger a redeploy).
4. Verify a synthesis call works.
5. Revoke the old key.

## Vercel

### Project

- Linked to `getyak/solo-compass` GitHub repo
- Root directory: `apps/web`
- Framework preset: Next.js
- Region: Singapore (`sin1` or `hnd1`)
- Auto-deploy on push to `main` (production) and PR branches (preview)

### Environment variables

| Variable                         | Where                | Used by         | Notes                                  |
| -------------------------------- | -------------------- | --------------- | -------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN`       | Production + Preview | client + server | Production token (domain-locked)       |
| `NEXT_PUBLIC_POSTHOG_KEY`        | Production           | client          | PostHog project key                    |
| `NEXT_PUBLIC_POSTHOG_HOST`       | all                  | client          | `https://us.i.posthog.com`             |
| `NEXT_PUBLIC_SENTRY_DSN`         | Production           | client + server | Sentry web project DSN                 |
| `NEXT_PUBLIC_SITE_URL`           | Production           | server (RSC)    | `https://solo-compass.vercel.app` (v1.0) |
| `SUPABASE_URL`                   | all                  | server          | public anyway                          |
| `SUPABASE_KEY`                   | all                  | server          | anon key, public                       |
| `SUPABASE_SERVICE_ROLE_KEY`      | Production           | server          | secret                                 |
| `ANTHROPIC_API_KEY`              | Production           | server          | optional in v1.0 (used only by web-side AI fallback before Epic E completes) |
| `REVALIDATE_SECRET`              | Production           | server          | shared secret for `/api/revalidate`    |

### Custom domain (deferred to v1.2)

Document the migration steps when the time comes; for v1.0, no-op.

## Sentry

### Projects

- `solo-compass-web` — Next.js platform
- `solo-compass-ios` — Apple platform

### Alerting

- Email alert when > 10 unique errors/hour
- Weekly digest enabled (Sunday)
- `beforeSend` PII scrubber enabled (see `apps/web/src/lib/sentry.ts` and the iOS counterpart)

### Retention

- Default 30 days; do not extend without privacy review

## PostHog

### Project

- Single project named `solo-compass`
- IP capture **disabled** (GDPR posture)
- Session recordings **disabled** (we don't need them and they're a privacy risk)

### Events tracked

See `docs/WEB_ANALYTICS.md` (to be created in Epic H). 8 core events for v1.0:
`page_view`, `city_view`, `experience_view`, `trip_view`, `marker_click`,
`pin_to_compare`, `save_trip`, `download_ios_click`.

### Funnels

To be configured manually in PostHog UI by the founder before beta.1.

## Common operational tasks

### "I need to roll back a bad deploy"

1. Vercel UI → Deployments → find the last-known-good deploy → "Promote to Production".
2. If the issue was data-related: Supabase dashboard → Database → Backups → Restore PITR to a timestamp before the bad change.
3. Open a hotfix branch, fix, ship.

### "My Anthropic spend is spiking"

1. Anthropic Console → Usage tab → identify which day/hour started the spike.
2. Check Supabase `synthesized_experiences` table for unusual insert volume — spike-cause is likely a bug in cache key generation.
3. If runaway: temporarily disable the Edge Function (`supabase functions delete synthesize-experiences`) and ship a hotfix.
4. Lower the soft alert threshold for the rest of the month.

### "A user reports their data leaked / they're being stalked"

1. STOP. Do not reply with a template.
2. Forward the message to the founder immediately.
3. Do not delete any logs from Sentry / PostHog / Supabase until the founder reviews.
4. If law enforcement is involved, follow their instructions and consult `docs/PRIVACY.md` for what data we have/don't have.

### "An AI Explore result is dangerously wrong"

1. Find the experience id from the user report.
2. SQL: `delete from synthesized_experiences where id = '<id>';` (cascades to caches).
3. Reply to the user using Template D in `docs/SUPPORT.md`.
4. If multiple users report the same id, file a bug; consider tightening the synthesis prompt.

## What this file is NOT

- Not a credentials store. Real credentials live in 1Password / Keychain / Vercel secrets.
- Not the privacy policy. That's `docs/PRIVACY.md` (and its Notion mirror).
- Not the customer-facing terms. Those will live at `<URL>/terms`.
- Not the launch runbook. That's `docs/RUNBOOK.md` (to be created in week 12).
