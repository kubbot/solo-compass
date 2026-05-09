# Privacy Policy

> Last updated 2026-05-09. This is the canonical version. The public-facing
> copy lives at https://solocompass.notion.site/privacy (placeholder URL —
> page must be created by the founder before iOS submission; mirrors this
> file verbatim when published). When this document changes, the Notion
> page is updated within 24 hours.
>
> The iOS app's `Info.plist` `NSPrivacyPolicyURL`, the web footer, the
> bot's `/privacy` command, and the in-app paywall all link to the Notion
> page.

Solo Compass is built for solo travelers. People moving through unfamiliar
places under their own name carry asymmetric privacy risk — so we collect as
little as possible, hash what we have to keep, and surface the opt-out paths
in the same flow that creates the data.

**TL;DR.** No signup. No email collected. Your location only leaves the
device when you tap "Explore here". We don't have any way to identify you
personally — your account is a random UUID. You can delete everything from
inside the app at any time.

## What we collect, datum by datum

| Datum                       | Where collected        | Stored as                                                                                                                               | Retention                                                                   | Purpose                                  | Opt-out path                              |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Telegram `user_id`          | Telegram bot           | **Hashed** with SHA-256 + server salt at the edge. Never persisted raw.                                                                 | Hash retained 30 days then rotated; salt rotation invalidates older hashes. | Distinguish sessions for retention math. | `/optout`                                 |
| Telegram `username`, name   | Telegram bot           | Not stored.                                                                                                                             | n/a                                                                         | n/a                                      | n/a                                       |
| Voice note bytes            | Telegram bot → Whisper | Held in memory only during transcription. Never written to disk, never sent to Sentry, never logged.                                    | Dropped immediately after Whisper returns.                                  | Voice → text intent.                     | Type instead of recording.                |
| Voice transcript            | Telegram bot → Claude  | Passed in-memory to ranking call.                                                                                                       | Not retained after the response is sent.                                    | Match intent to experiences.             | n/a                                       |
| Coordinates (drop pin)      | Telegram bot, web app  | In-memory session only.                                                                                                                 | Cleared on `/reset` or 24h idle.                                            | Walking-distance ranking.                | `/reset`, browser refresh.                |
| Coordinates (live location) | Web app, future iOS    | Same as drop pin. Background GPS is **opt-in**, off by default.                                                                         | n/a                                                                         | n/a                                      | OS-level location toggle.                 |
| Anonymous device id (web)   | Web app                | Random UUID in localStorage. No fingerprinting.                                                                                         | Until user clears site data.                                                | Retention math.                          | Clear site data.                          |
| Anonymous device id (iOS)   | iOS app                | Random UUID generated on first launch, stored in iOS Keychain. Never tied to Apple ID, IDFA, or contact info. Used as Supabase anon `auth.uid()`. | Until user taps "Clear all data" in Settings or uninstalls the app.        | Cross-device sync, retention math.       | Settings → My Data → Clear all data.      |
| Coordinates (iOS Explore)   | iOS app                | Sent to OpenStreetMap (Overpass API) and to our server (Supabase Edge Function → Anthropic) only when user taps "Explore here" and grants the consent sheet. | OSM: not retained by us. Server: retained 30 days for cache, then purged.  | Generate "Explore here" results.         | Don't tap Explore, or revoke consent in Settings. |
| Subscription transactions   | iOS app + StoreKit     | Apple's `Transaction.id`, product id, expiry timestamp, trial flag. **No price**, no Apple ID, no email. Stored in our `subscription_events` table. | Until user requests deletion.                                              | Validate Pro entitlement, run conversion analytics. | Cancel subscription in iOS Settings → Apple ID → Subscriptions. |
| Micro-survey responses      | iOS app                | Comfort 1-5, pressure 1-5, recommend yes/depends/no, experience id, anon device id. **No free text by default.** | Until user requests deletion or clears their data.                         | Improve Solo Score for the next traveler. | Don't submit surveys.                    |
| Completed / favorited list  | iOS app                | Experience ids only. Synced via Supabase under anon `auth.uid()`.                                                                       | Until user clears their data.                                              | Restore on a new device.                 | Settings → Clear all data.                |
| Analytics events            | Bot + web + iOS        | Event name + `channel` ("bot" / "web" / "ios") + hashed user id. **No raw text, no transcripts, no coordinates, no IP.**               | 90 days.                                                                    | Retention dashboard.                     | `/optout` (bot), localStorage flag (web), Settings → Disable analytics (iOS). |
| Error reports (Sentry)      | Bot + web + iOS        | Stack traces, file paths, code context. **PII scrubbed in `beforeSend`** — no transcripts, no message bodies, no Mapbox tokens, no IPs. | 30 days.                                                                    | Catch crashes.                           | n/a (errors are anonymized at source).    |

## What we never collect

- Real names, phone numbers, email addresses (no signup at all on the bot).
- Government ID, passport numbers.
- Emergency contact information.
- Social-graph data — no follower lists, no contact import, no friend invites.
- Photos of the user's face.
- Continuous background location without explicit opt-in.

## Anti-patterns we've ruled out by policy

These appear in `scripts/anti-pattern-lint.ts` and any PR introducing them
will fail CI:

- Social feeds, leaderboards, badges, streaks.
- "Follow another user." Like counts. Public profiles.
- Re-engagement push notifications, daily streak nudges.
- Sharing pressure ("invite a friend to unlock").

## Sentry posture

Both `apps/bot/src/lib/sentry.ts` and `apps/web/src/lib/sentry.ts` install a
`beforeSend` hook that strips:

- `event.user.email`, `event.user.username`, `event.user.ip_address`
- `event.request.cookies`, `event.request.data`, `event.request.headers`,
  `event.request.query_string`
- `event.extra.transcript`, `event.extra.intent`, `event.extra.message_text`,
  `event.extra.mapbox_token`, `event.extra.voice_url`

Stack traces, file paths, and code context are kept — those are necessary for
debugging and contain no user data.

## Analytics: same events, two channels

Bot and web emit the same event names so retention can be compared
side-by-side on one dashboard:

- `session_start`
- `intent_submitted`
- `recommendations_shown`
- `experience_opened`
- `experience_completed`
- `experience_skipped`
- `experience_reported`
- `opted_out`

Each event carries `channel: "bot" | "web"`. We deliberately do **not** emit
engagement events (no `streak_extended`, no `daily_open`, no
`re_engagement_push`).

## Opt-out

- **Bot**: `/optout` — stops all analytics from that chat. The hashed id is
  added to a no-track set; subsequent events from that chat are dropped at
  the edge.
- **Web**: a localStorage flag `solo_compass_optout=1` (set via the privacy
  footer) suppresses all events.
- **Sentry**: errors are already anonymized at source via `beforeSend`; no
  user-level Sentry opt-out is necessary.

## Third-party processors

We use the following services. Each one only receives the minimum data
listed below. We have no other processors.

| Service           | What we send                                                   | Where it runs       | Their privacy policy                              |
| ----------------- | -------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| **Apple**         | Subscription transactions via StoreKit (no email, no Apple ID) | iOS device + Apple  | https://www.apple.com/legal/privacy/              |
| **Anthropic**     | OSM POI tags + your Explore coordinate (rounded to 0.01°)      | Anthropic API       | https://www.anthropic.com/privacy                 |
| **OpenStreetMap** | Your Explore coordinate (rounded to 0.01°)                     | Overpass public API | https://wiki.osmfoundation.org/wiki/Privacy_Policy |
| **Supabase**      | Your anonymous UUID, favorites, completions, micro-surveys     | Singapore region    | https://supabase.com/privacy                      |
| **Mapbox**        | Map tile requests (anonymized, see Mapbox terms)               | Mapbox CDN          | https://www.mapbox.com/legal/privacy              |
| **Sentry**        | Crash stack traces (PII scrubbed)                              | Sentry SaaS         | https://sentry.io/privacy/                        |
| **PostHog**       | Anonymous event names (IP capture disabled)                    | PostHog SaaS        | https://posthog.com/privacy                       |
| **Vercel**        | Web request logs (no IP retained beyond 30 days)               | Vercel Edge         | https://vercel.com/legal/privacy-policy           |

We never share data with third parties for advertising. We do not sell data.
We have no plans to add ad networks.

## Your rights (GDPR, CCPA, PIPL)

Even though we don't know who you are, you have the legal right to:

- **Access:** see what we have. Settings → My Data → Export shows every row
  tied to your anonymous id, downloadable as JSON.
- **Delete:** Settings → My Data → Clear all data wipes the local SwiftData
  store and triggers a cascade delete in Supabase within 30 days. The
  weekly Anthropic cache for your region is purged at the next rotation.
- **Object / restrict processing:** Settings → Disable analytics stops new
  events. You can also revoke "Explore here" consent — Settings → Privacy.
- **Data portability:** the Export above is in standard JSON, no proprietary
  formats.
- **Lodge a complaint:** with your local data protection authority. EU
  users: see https://edpb.europa.eu/about-edpb/about-edpb/members_en. UK
  users: ICO at https://ico.org.uk/. California: California AG.

We do not need your real name to honor any of these — your anonymous
device UUID is the only key we have.

## Children

Solo Compass is rated 4+ on the App Store but is not directed at children.
We do not knowingly collect data from anyone under 13 (or the equivalent
age in your jurisdiction). If we learn we have, we delete it.

## International transfers

Our primary database is in Singapore. Anthropic, Sentry, PostHog, Vercel,
and Mapbox are US-based. We rely on Standard Contractual Clauses (SCCs) for
EU/UK transfers. The data we transfer is anonymous (no name, no email, no
IP), so transfer-impact is minimal.

## Data deletion requests

The fastest path is **inside the iOS app: Settings → My Data → Clear all
data**. This is a one-tap delete; no email needed.

For a manual request (e.g. you uninstalled the app and want server-side
deletion), email `solocompass.support@gmail.com` (placeholder Gmail
address — to be replaced with `support@<domain>` when a custom domain is
registered) with the words "delete my data". Include any anon device ids
you remember from the iOS Settings screen, otherwise we delete by IP-less
heuristic and rotate caches. Maximum 30 days.

We also rotate the analytics salt monthly, which already invalidates older
hashed ids; for an urgent request we rotate immediately.

## Changes to this document

This file is the source of truth. Material changes are committed and dated.
We will notify users via the iOS app's "What's new" screen for material
changes that affect what we collect.
