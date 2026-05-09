# PRD: Paid-App Foundation — iOS v1.1 + Web v1.0 (Full Launch)

> **Status:** Draft
> **Owner:** @cubxxw
> **Target release:** v1.1.0 (iOS) + v1.0.0 (web) shipped together as the public launch
> **Calendar:** ~13 weeks one-shot (no phasing). Beta starts week 11, GA week 13.
> **Branch convention:** `feat/<short-slug>` per user-story batch
> **Related:** `tasks/prd-data-engine-v2.md`, `tasks/prd-deepseek-migration.md`, `apps/web/README.md`, `docs/WEB_DESIGN.md`

---

## 1. Introduction / Overview

Solo Compass today is a SwiftUI map app with five Chiang Mai seed Experiences and a working "Explore here" flow that pulls real OpenStreetMap POIs and asks Claude to enrich them into solo-traveler entries. Everything beyond `UserPreferences` lives in memory — close the app and all generated content is gone. There is no caching layer, no cost control on AI calls, no monetization, and no way for the app to get smarter over time. The web app at `apps/web/` is a half-finished shell: Next.js + Mapbox + shadcn scaffolded, API routes exist, but the database is empty, the Lisbon page uses fake SVG coordinates, and the README still says "🚧 Foundation phase. Not yet running."

This PRD turns both surfaces into a **shippable, paid product** by adding seven foundations across iOS and web, all delivered in a single ~13-week sprint:

1. **Local persistence (iOS)** — every Experience (seed, OSM-generated, user-added) survives app restarts via SwiftData.
2. **Smart caching & cost control (iOS)** — Explore-here results cached by region for 14 days; Claude calls deduplicated; cheaper model by default.
3. **Freemium monetization (iOS)** — base map + filter + completed/favorites are free; AI-powered Explore Here, voice intent, and AI explanations require an active subscription via StoreKit 2.
4. **Supabase backend (iOS + web)** — anonymous device identity, cross-device sync of user data and generated Experiences, telemetry on Solo-Score signals to power the "data flywheel," and a single source of truth that **both apps read from**.
5. **Web foundation (web)** — wire `apps/web` to the same Supabase that iOS uses, replace the SVG fake-Lisbon map with real Mapbox, plug in production env, deploy to Vercel.
6. **Web product surfaces (web)** — the four Scenarios from `apps/web/README.md` actually built: desktop research center (A), mobile zero-install try (B), trip recap pages (C), SEO static city/experience pages (D).
7. **Pre-launch operational readiness (process)** — Mapbox tokens, Supabase project, App Store Connect, domains, privacy policy, customer support, beta tester recruitment, AI cost monitoring — all the boring-but-critical things that block a real launch.

The ultimate target: a unified v1.1 (iOS) + v1.0 (web) launch in ~13 weeks where the App Store has a paid iOS app, the web app is live on Vercel (a `*.vercel.app` URL — see US-I3 for the deferred-domain decision) and indexed by Google for city pages, users can share a `/trip/<slug>` URL after a trip, and the same Supabase database serves both — making Solo Compass a real cross-platform product with one cohesive dataset.

---

## 2. Goals

- **G1 — No more data loss.** Generated Experiences and user state persist across app launches and device restarts (target: 100% retention of synthesized content for 90 days).
- **G2 — Cost-controlled AI.** Average cost per active user per day ≤ **$0.02** for free tier (zero AI calls) and ≤ **$0.30** for paid tier (cached, deduped, Sonnet-based).
- **G3 — Working free → paid funnel.** Subscribe screen reachable in ≤ 2 taps from any AI-gated action; 7-day free trial; restore-purchase flow works on fresh install.
- **G4 — Cross-device continuity.** A signed-in user opening the app on a second device sees the same favorites, completed list, generated Experiences, and Solo-Score history within 5 seconds.
- **G5 — Trust-preserving AI.** Generated Experiences visually distinguish themselves from curated content and never invent specific facts the model could not verify (no fake menu items, hours, or interior details).
- **G6 — App Store ready.** Privacy manifest, ATT prompt, refund-of-trial flow, IAP receipts, ITP/Family Sharing all configured. Pass App Store review on first submission.
- **G7 — Local-first (iOS).** Every UI read comes from SwiftData; Supabase is sync + shared cache only. App stays fully usable when offline or when the backend is down.
- **G8 — Cross-platform parity on data.** iOS and web read the same `synthesized_experiences` and `osm_pois` tables; an OSM-generated Experience visible to a paid iOS user is also visible on the public web city page within 5 minutes.
- **G9 — Web SEO foothold.** The Vercel-hosted web (`*.vercel.app` for v1.0; real domain in v1.2) indexed by Google for at least 50 city/experience pages by GA. Lighthouse SEO score ≥ 90 on `/[city]` and `/experience/[id]`. Sitemap + JSON-LD + multi-locale routes (`/zh/...` and `/en/...`) shipped. SEO ranking on a Vercel subdomain is weaker than a custom domain — accepted trade-off for v1.0.
- **G10 — Web does its 4 jobs.** All four scenarios from `apps/web/README.md` working end-to-end: desktop research (A), mobile zero-install try (B), trip recap pages (C), SEO static pages (D).
- **G11 — Operational readiness.** Real Mapbox token, Supabase production project, App Store Connect SKUs, domain + DNS, privacy policy, customer support inbox, beta tester list, AI cost alerts — all in place at least one week before TestFlight beta.1.

---

## 3. User Stories

> Stories are grouped into 9 epics totaling 61 user stories. Each story is sized to ~1–2 focused implementation sessions and references existing files where possible. Order follows recommended build sequence (iOS foundation → web foundation → web scenarios → operational launch readiness).

### Epic A: Local Persistence (SwiftData)

#### US-A1: Define SwiftData schema mirroring current Codable models
**Description:** As a developer, I want a SwiftData store that mirrors `Experience`, `Confidence`, `SoloScore`, `ExperienceLocation`, `TimeWindow`, `HowToStep`, `RealInconvenience`, `InformationSource`, and `Stats` so the app has a single source of truth on disk.

**Acceptance Criteria:**
- [ ] New file `apps/ios/SoloCompass/Persistence/SoloCompassModelContainer.swift` exposes a `ModelContainer` configured with all `@Model` types.
- [ ] New `@Model` classes in `apps/ios/SoloCompass/Persistence/Models/`: `ExperienceRecord`, `ConfidenceRecord`, `SoloScoreRecord`, `LocationRecord`, `TimeWindowRecord`, `HowToStepRecord`, `RealInconvenienceRecord`, `SourceRecord`, `StatsRecord`, `UserCompletionRecord`, `UserFavoriteRecord`, `MicroSurveyRecord`, `ExploreCacheRecord`.
- [ ] Two-way mapping: `ExperienceRecord(from: Experience)` initializer + `var asValue: Experience` computed property. Round-trip is lossless.
- [ ] Model versioning: schema is wrapped in a `VersionedSchema` named `SoloCompassSchemaV1` for future migration.
- [ ] Unit test: round-trip a hardcoded `Experience` through `ExperienceRecord` → fetch → `asValue` and assert equality.
- [ ] `xcodebuild test` passes.

#### US-A2: Replace ExperienceService in-memory store with SwiftData-backed repository
**Description:** As a user, I want every Experience I see on the map to come from local storage, so closing and reopening the app does not lose any of my discovered places.

**Acceptance Criteria:**
- [ ] New `ExperienceRepository` (in `Persistence/`) owns CRUD against the `ModelContainer`. `ExperienceService` becomes a thin facade that delegates to the repo and exposes the existing `@Observable` API for views.
- [ ] On first launch with empty store: bundle seed (`Resources/JSON/seed_experiences.json`) is imported once. A boolean flag `seedImported` is stored in `UserPreferences` so re-imports skip.
- [ ] `appendGenerated([Experience])` writes through to SwiftData and is **idempotent by id**.
- [ ] `markCompleted(id)` writes a `UserCompletionRecord` (separate table; never mutates the Experience) and the existing `Stats.completionCount` derives from a query.
- [ ] Acceptance test: launch app, run "Explore here" in Hanoi, force-quit, relaunch — all generated pins are still on the map.
- [ ] Unit test: write 30 generated Experiences, query nearby with radius 5 km, assert correct subset returned in correct order.
- [ ] `xcodebuild test` passes.

#### US-A3: Migrate UserPreferences mutable state into SwiftData
**Description:** As a user, I want my favorites, completed list, micro-survey responses, and pending check-ins to persist reliably across app reinstalls when I'm signed in.

**Acceptance Criteria:**
- [ ] `UserPreferences` retains `UserDefaults` for **scalar settings only** (style, max distance, disliked categories, last selected city).
- [ ] Lists move to SwiftData: `UserCompletionRecord`, `UserFavoriteRecord`, `MicroSurveyRecord`, `PendingCheckInRecord`.
- [ ] `isCompleted(id)` / `isFavorited(id)` become repository queries; existing call sites in `MapViewModel`, `ExperienceDetailViewModel`, settings/favorites views unchanged.
- [ ] Migration: on first launch of v1.1, read existing `UserDefaults` arrays for completed/favorites and seed the SwiftData tables, then clear the old keys.
- [ ] Unit test: pre-populate `UserDefaults` with legacy completed array → boot the app → assert SwiftData has matching `UserCompletionRecord` rows and old keys are gone.

#### US-A4: Persist offline map regions for last-explored area
**Description:** As a traveler with flaky data, I want the last region I explored to be browsable offline (markers + detail data, not basemap tiles).

**Acceptance Criteria:**
- [ ] Last 3 explored regions (lat/lon center + radius) recorded in a `RecentExploreRegion` SwiftData table.
- [ ] When `Explore here` is offline, the app still shows pins from the last region matching the current map center within 10 km — using only SwiftData reads.
- [ ] A small banner ("Showing offline data from <date>") appears when the data is older than 7 days.
- [ ] Unit test: simulate `URLSession` failure → `exploreNearby` returns cached region's pins, sets banner state.

---

### Epic B: Smart Caching & Cost Control

#### US-B1: Region-keyed cache for Overpass queries
**Description:** As a product owner, I don't want users repeatedly burning Overpass quota by tapping "Explore here" in the same area.

**Acceptance Criteria:**
- [ ] New `ExploreCacheRecord` in SwiftData: `regionKey: String` (e.g. `"21.03_105.85_3000"`), `osmJSON: Data`, `fetchedAt: Date`, `poiCount: Int`.
- [ ] `OverpassService.fetchPOIs` consults cache first; cache hit if `now - fetchedAt < 14 days` and `regionKey` matches at 0.01° rounding (~1.1 km grid).
- [ ] Cache miss → real fetch → write through.
- [ ] Cache hit count surfaced in settings → "Storage" row ("Cached 12 regions, 248 POIs"). User-visible **Clear cache** button purges `ExploreCacheRecord` and `ExperienceRecord` rows where `id LIKE 'exp_osm_%'`.
- [ ] Unit test (`URLProtocol` stub): two consecutive `fetchPOIs` calls in same region trigger only one HTTP request.

#### US-B2: Region-keyed cache for AI synthesis results
**Description:** As a product owner, I want Claude calls deduplicated so the same OSM batch never gets re-synthesized.

**Acceptance Criteria:**
- [ ] Cache key = SHA256 of sorted `osmId` list + cityCode + locale + model name. Stored in `AISynthesisCacheRecord`.
- [ ] `AIService.synthesizeExperiences` checks the cache before calling the network. Hit → decode persisted `[Experience]` JSON. Miss → call → write through.
- [ ] TTL **30 days**.
- [ ] Cache stats exposed alongside Overpass cache in settings.
- [ ] Unit test: same input batch hits the network once, returns identical Experiences twice.

#### US-B3: Switch default synthesis model to Sonnet 4.6 with Haiku fallback
**Description:** As a product owner, I want AI generation cost to drop ~80% without a noticeable quality regression.

**Acceptance Criteria:**
- [ ] `AIService` gains `model` config: `synthesisModel = "claude-sonnet-4-6"`, `explanationModel = "claude-haiku-4-5-20251001"`, `voiceIntentModel = "claude-sonnet-4-6"`.
- [ ] `recommendExperiences` and `synthesizeExperiences` use synthesis model; `explainRecommendation` uses Haiku.
- [ ] All three are read from `Secrets.plist` keys with defaults so QA can override per-build.
- [ ] A debug flag `AI_FORCE_OPUS=1` env var still routes everything to Opus for golden-set comparison.
- [ ] Snapshot test: synthesizing 5 fixed POIs with each model produces parseable JSON of the expected shape.

#### US-B4: Hallucination-resistant synthesis prompt
**Description:** As a user, I need to trust generated content not to invent facts the model can't actually know.

**Acceptance Criteria:**
- [ ] Updated prompt explicitly instructs: "Use ONLY the provided OSM tags. Do NOT invent menu items, interior details, hours, prices, owner backstories, or specific seating positions. If a field is not derivable from tags, write a generic safe value."
- [ ] `howTo` is constrained to navigation steps only (no "order the X").
- [ ] Prompt includes 2 few-shot examples showing **good** (tag-derived, generic) vs **bad** (hallucinated specifics) outputs.
- [ ] New regression test: feed a POI with only `{amenity: cafe, name: "Quán A"}` and assert the model output's `whyItMatters` and `howTo` do **not** contain any of the banned phrase patterns (regex list of 20+ red flags).

#### US-B5: Per-user daily AI quota with graceful degradation
**Description:** As a product owner, I want a hard cap on Claude spend per user per day so a runaway loop never costs more than $1.

**Acceptance Criteria:**
- [ ] `UserPreferences` adds `aiCallsToday: Int` and `aiCallsResetDate: Date` (rolling UTC day).
- [ ] Free tier limit: 0 paid AI calls (Explore-Here disabled, see Epic D).
- [ ] Paid tier: 30 synthesis calls/day, 60 explanation calls/day. Counter increments on every Anthropic POST regardless of cache hits (cache hits don't count).
- [ ] When limit hit: feature falls back to skeleton mode + visible banner "Daily AI limit reached, resets in Xh".
- [ ] Counter persists in SwiftData (`AIUsageRecord`) — survives kills.

---

### Epic C: Trust & UX Polish for Generated Content

#### US-C1: Visual downgrade for `confidence.level == 1` Experiences
**Description:** As a user, I want to immediately tell which pins are AI-guessed vs curated.

**Acceptance Criteria:**
- [ ] `MarkerIconView` renders confidence-1 pins with: dashed stroke border, 70% opacity, no glow, smaller badge.
- [ ] Detail view: existing "AI-generated · OpenStreetMap" badge is upgraded with a tappable info icon that opens an info sheet explaining the source and recommending the user verify on-site.
- [ ] Sources section explicitly shows "© OpenStreetMap contributors" with a link to the OSM node URL.
- [ ] Verify in simulator using `xcrun simctl` and a manual screenshot review.

#### US-C2: Surface explore errors and skeleton-mode state to the user
**Description:** As a user, when AI synthesis silently fails I should know that what I'm looking at is OSM-only, and when Explore fails completely I should see why.

**Acceptance Criteria:**
- [ ] `MapViewModel.lastExploreError` is rendered as a dismissible banner (reuse existing `lastAIError` style in `CompassMapView`).
- [ ] When `synthesizeExperiences` falls back to skeleton mode, set `lastExploreInfo = "Showing real places without AI enrichment — subscribe for richer descriptions."` (free tier) or `"AI is offline."` (paid tier with API failure).
- [ ] Banner has a "Subscribe" CTA in free-tier copy linking to the paywall (Epic D).
- [ ] Unit test: force `synthesizeExperiences` to throw → assert info banner state set correctly per subscription tier.

#### US-C3: Reverse-geocode discovered regions into real city names
**Description:** As a user, I shouldn't see "osm_21.0_105.9" in my city picker — I should see "Hanoi".

**Acceptance Criteria:**
- [ ] New `ReverseGeocodeService` wraps `CLGeocoder.reverseGeocodeLocation`.
- [ ] On successful Explore: resolve coordinate → `city, countryCode`. Persist to `DiscoveredCityRecord` (cityCode = ISO-3166-2-region-or-locality-slug, name = localized).
- [ ] `MapViewModel.cityCode(for:)` consults `DiscoveredCityRecord` first; falls back to current `osm_<lat>_<lon>` only when geocoder fails or offline.
- [ ] Generated Experiences in that region get the resolved cityCode written into `ExperienceRecord.location.cityCode`.
- [ ] City picker shows real names; tapping a discovered city centers the map and loads cached pins.

#### US-C4: Auto-switch selected city after successful Explore
**Description:** As a user who lands in a new city and taps Explore, I should immediately see the new pins without manually changing the city filter.

**Acceptance Criteria:**
- [ ] After `exploreNearby` adds N > 0 generated Experiences, `MapViewModel` calls `selectCity(resolvedCityCode)` so the visible-experiences filter no longer hides them.
- [ ] If reverse-geocoding succeeded, the city name briefly toasts: "Now exploring Hanoi · 12 places added".
- [ ] If geocoding failed, fallback toast: "12 places added near you".
- [ ] Unit test: with `selectedCity = "cmi"`, run `exploreNearby` at Hanoi coords with mocked geocoder → assert `selectedCity` becomes the Hanoi cityCode.

#### US-C5b: Cold-start UX for Solo-Score (zero-signal regions)
**Description:** As a user discovering a new region, I should see a useful Solo Score on every pin — clearly marked as an AI estimate when no community data exists yet, transitioning naturally to community-backed numbers as signals arrive.

**Acceptance Criteria:**
- [ ] `SoloScore` view component takes a new `signalCount: Int` parameter and renders three visual states:
  - `signalCount == 0`: dimmed score color + "AI estimate" pill + tap-to-explain tooltip
  - `signalCount` in `1...2`: normal score + "Based on N early reports" subtext
  - `signalCount >= 3`: normal score + "Based on N solo travelers" subtext (current behavior)
- [ ] Pin marker color saturation scales with `signalCount` (dimmed when 0, full when >=3) so the map at a glance shows community-validated places more prominently than AI estimates.
- [ ] Detail view's solo-score section header reads "Solo Score (AI estimate)" / "Solo Score (early)" / "Solo Score" matching the three states.
- [ ] Unit test: render `SoloScoreView` with each of `0, 1, 2, 3, 12` signals — assert the right state markers appear.
- [ ] Snapshot test for each state in light + dark mode.

#### US-C5: MicroSurvey responses feed back into SoloScore
**Description:** As a user, my honest feedback on a place should improve its Solo Score for the next traveler — making the app smarter every week.

**Acceptance Criteria:**
- [ ] `MicroSurveySheet` writes a `MicroSurveyRecord` (rating fields + experienceId + timestamp + anonymizedDeviceId).
- [ ] `SoloScore.overall` becomes a derived computed property: `0.5 * seedOrAI + 0.5 * meanOfLocalSurveys` (weighted by `basedOnCount`). Cached on read for 60s to avoid recomputing on every render.
- [ ] `basedOnCount` reflects local survey count (cross-device count comes in Epic E).
- [ ] When a user submits a survey their immediate next view of the Experience shows the updated score.
- [ ] Unit test: submit two surveys with comfort=5, pressure=4, recommend=yes → assert resulting `overall` matches the formula.

---

### Epic D: Freemium & StoreKit 2

#### US-D1: Subscription product setup & local entitlement check
**Description:** As a developer, I need StoreKit 2 wired up with two subscription SKUs and an offline-tolerant entitlement source of truth.

**Acceptance Criteria:**
- [ ] New file `apps/ios/SoloCompass/Services/SubscriptionService.swift` (`@MainActor @Observable`). Manages `StoreKit.Product` fetch, purchase, restore, transaction listener.
- [ ] App Store Connect SKUs (created out-of-band, documented in `docs/APP_STORE.md`):
  - `com.solocompass.pro.monthly` — monthly subscription, 7-day free trial, intro offer once per Apple ID
  - `com.solocompass.pro.yearly` — yearly subscription, 7-day free trial, ~55% savings vs monthly
- [ ] `SubscriptionService.entitlement: Entitlement` is one of `.free | .proTrial | .pro | .proExpired`. Computed from `Transaction.currentEntitlements`.
- [ ] Entitlement is **cached in Keychain** so a brief offline launch still respects it.
- [ ] Listener auto-updates entitlement on renewal/cancellation.
- [ ] Unit test with `Testing` framework + `Transaction.testSession` covers: free → trial → paid → expired transitions.

#### US-D2: Paywall view
**Description:** As a free user tapping an AI-gated action, I land on a clear paywall where I can start a free trial.

**Acceptance Criteria:**
- [ ] New `apps/ios/SoloCompass/Views/Paywall/PaywallView.swift`. Shows: hero copy, two product cards (monthly / yearly with "Best value" badge), "Start 7-day free trial" CTA, fine-print, "Restore purchases" link, "Manage subscription" deep link to App Store Settings.
- [ ] Localized en + zh-Hans (`Resources/zh-Hans.lproj/Localizable.strings` created).
- [ ] Paywall reachable via `viewModel.isShowingPaywall = true` from any AI-gated CTA.
- [ ] On successful purchase: dismiss paywall, retry the original action automatically (e.g. resume `exploreNearby`).
- [ ] Verify in simulator using StoreKit testing config (`Configuration.storekit` file in `apps/ios/`).

#### US-D3: Gate AI features behind entitlement
**Description:** As the product owner, I want AI features (Explore Here synthesis, voice intent, AI explanations) to require a Pro subscription.

**Acceptance Criteria:**
- [ ] `MapViewModel.exploreNearby` and `handleVoiceTranscript` and `ExperienceDetailViewModel.requestAIExplanation` consult `SubscriptionService.entitlement`. If `.free` or `.proExpired`: route to paywall instead of network call.
- [ ] Free users still get: full map, filters, seed Experiences, completed/favorites, micro-survey, settings, **OSM-only Explore Here in skeleton mode** (no Claude call) — this is the "show, don't tell" funnel.
- [ ] The Explore button label changes to "Explore (Pro)" with a small lock icon when free.
- [ ] Detail view's "AI insight" section shows a paywall teaser instead of "Loading…" for free users.
- [ ] Unit test: as `.free`, calling `exploreNearby` sets `isShowingPaywall = true` and does not invoke `OverpassService` or `AIService`.

#### US-D4: Trial-to-paid conversion analytics
**Description:** As a founder, I need to know how many trials convert and where users drop off.

**Acceptance Criteria:**
- [ ] On every `Transaction` lifecycle event (`subscribed`, `expired`, `inGracePeriod`, `revoked`, `upgraded`), emit a Supabase `subscription_events` row (Epic E).
- [ ] Column: `device_id`, `event_type`, `product_id`, `original_purchase_date`, `expires_date`, `is_in_trial_period`.
- [ ] No PII (no email, no Apple ID).
- [ ] Local sanity log in Console for debug builds.

#### US-D5: Refund-of-trial & restore-on-fresh-install flow
**Description:** As a user reinstalling on a new phone, I shouldn't have to pay again.

**Acceptance Criteria:**
- [ ] App boot on new device with same Apple ID -> `Transaction.currentEntitlements` populates -> entitlement set to `.pro` automatically without user action.
- [ ] Settings -> "Restore purchases" button explicitly calls `AppStore.sync()` and surfaces success/failure as a toast.
- [ ] If a user cancels mid-trial inside Settings.app, app reflects `.free` within 1 minute via the transaction listener.

---

### Epic E: Supabase Backend & Cross-Device Sync

#### US-E1: Anonymous device identity via Supabase Auth
**Description:** As a user, I want my data synced without creating an account or giving an email.

**Acceptance Criteria:**
- [ ] Existing `DeviceIdentityService` extended to call `supabase.auth.signInAnonymously()` on first launch and store the resulting `userId` in Keychain.
- [ ] On subsequent launches, refresh-token flow keeps the session alive.
- [ ] On entitlement change (`.proTrial` -> `.pro`), update a `profiles` row with `entitlement_tier`.
- [ ] If the user later wants account portability, they can link Apple ID via "Sign in with Apple" — this upgrades the anonymous user to a permanent one (this US covers anon-only; Apple-link is a follow-up).
- [ ] Supabase project bootstrap script in `infra/supabase/` (SQL + RLS policies) checked in.

#### US-E2: Schema and RLS policies on Supabase
**Description:** As a developer, I need a backend schema that mirrors local SwiftData tables and enforces per-user data isolation.

**Acceptance Criteria:**
- [ ] Tables: `profiles`, `user_completions`, `user_favorites`, `micro_surveys`, `subscription_events`, `synthesized_experiences` (canonical AI output, dedupable across users), `osm_pois` (canonical OSM cache), `solo_score_signals`.
- [ ] Row-Level Security: every user-data table allows `select/insert/update/delete WHERE user_id = auth.uid()`. `synthesized_experiences` and `osm_pois` are **read-public, write-server-role**.
- [ ] Migration files in `infra/supabase/migrations/0001_*.sql`.
- [ ] Smoke test script: `infra/supabase/test_rls.ts` runs anon vs user role queries and asserts isolation.

#### US-E3: Outbox sync for user data
**Description:** As a user toggling between phone and iPad, I want my favorites and completed list to converge within seconds.

**Acceptance Criteria:**
- [ ] New `SyncService` (in `Services/`) implements outbox pattern: any local mutation to user-data tables also writes to a `PendingSyncRecord` queue.
- [ ] Background flush every 30s and on app foreground; uses Supabase's REST upsert with `If-Match` on `updated_at` for last-write-wins.
- [ ] Inbound: pull diff (`updated_at > lastPulledAt`) for each user-data table on foreground; merge into SwiftData by id.
- [ ] Conflicts resolved by `updated_at` desc (LWW); ties broken by `device_id` lex order.
- [ ] Unit test: simulate two devices mutating the same favorite — assert eventual consistency after one round-trip each.

#### US-E4: Server-side AI synthesis cache (sharing across users)
**Description:** As a product owner, when User A in Hanoi has paid for AI synthesis of a region, User B's nearby request should reuse it for free.

**Acceptance Criteria:**
- [ ] `AIService.synthesizeExperiences` consults Supabase `synthesized_experiences` table by region+POI hash before calling Claude.
- [ ] On cache miss + paid call: write the result back to `synthesized_experiences` (server-role via a Supabase Edge Function with service-role key — client never has it).
- [ ] Free users **read** the shared cache (so a paid user's exploration "lights up" the area for everyone) — this is the core flywheel and a marketing hook.
- [ ] Edge Function `synthesize-experiences` (Deno/TS) does the Anthropic call server-side, validates the response, dedup-writes to `synthesized_experiences`. Client just calls the function.
- [ ] **API key never ships in the iOS app after this milestone.** `Secrets.plist` `ANTHROPIC_API_KEY` is removed.
- [ ] Edge Function rate-limits per `auth.uid()`: 30 calls/day for Pro, 0 for free.

#### US-E6: Optional Sign-in-with-Apple to upgrade anonymous account
**Description:** As a user who wants Family Sharing eligibility or extra account-recovery safety, I want to link my anonymous Solo Compass account to my Apple ID without losing my data.

**Acceptance Criteria:**
- [ ] Settings has a new row under "My Data": **"Save with Apple"** (when anonymous) / **"Linked to Apple ID"** (when linked).
- [ ] Tapping "Save with Apple" presents the system Sign-in-with-Apple sheet. On success, calls `supabase.auth.linkIdentity(provider: .apple)` to merge the anonymous user into a permanent one.
- [ ] All existing local SwiftData rows keep their `anonUserId` linkage; the Supabase `profiles` table updates `is_anonymous = false` and stores the Apple email relay (private relay, not real email).
- [ ] No Apple ID data leaves the device beyond what Supabase Auth needs (sub claim + email relay). Documented in `docs/PRIVACY.md`.
- [ ] If link fails (network, user cancels): toast "Couldn't link account. Your data is still saved on this device." No data is lost or corrupted.
- [ ] Family Sharing: linked accounts that share a Family receive Pro entitlement automatically via StoreKit Family Sharing (already supported by `Transaction.currentEntitlements`); document the limit (one paying organizer + 5 family members).
- [ ] Unit test (`Transaction.testSession` + Supabase mocked): anonymous user with 3 favorites and 1 micro-survey links to Apple → assert all rows now belong to permanent userId, anon session is deleted server-side.

#### US-E5: Solo-Score signal aggregation
**Description:** As a user, I should see Solo Scores that reflect actual community use, not just AI guesses.

**Acceptance Criteria:**
- [ ] On every micro-survey submit, `SyncService` writes a `solo_score_signals` row (anon user_id, experienceId, comfort, pressure, recommend, timestamp).
- [ ] Nightly Supabase scheduled function recomputes `synthesized_experiences.aggregated_solo_score` (mean/median + sample size) for each experienceId.
- [ ] Client pulls the aggregate on app foreground and merges into `ExperienceRecord.soloScore` if `signal_count >= 3`.
- [ ] Detail view displays "Based on N solo travelers" using the real count.

---

### Epic F: App Store Readiness & Privacy

#### US-F1: Privacy manifest and ATT prompt
**Description:** As an App Store applicant, I need a privacy manifest declaring data use and ATT prompts where appropriate.

**Acceptance Criteria:**
- [ ] `apps/ios/SoloCompass/Resources/PrivacyInfo.xcprivacy` lists: precise location, coarse location, device ID (Supabase anon), purchases (StoreKit), diagnostics (Supabase events).
- [ ] No data is marked as used for tracking. ATT prompt skipped (not needed without tracking).
- [ ] Privacy policy hosted on a public Notion page (e.g. `https://solocompass.notion.site/privacy`); URL configured in `Info.plist`. Will migrate to `https://<domain>/privacy` in v1.2 once a real domain is registered.
- [ ] First-run onboarding screen explains: location stays on device + sent to OSM/Anthropic during Explore Here; entitlement events sent to Supabase for sync; nothing else.

#### US-F2: First-run Explore-Here consent screen
**Description:** As a privacy-conscious user, I want a clear opt-in moment before my coordinates leave the device.

**Acceptance Criteria:**
- [ ] New view `Onboarding/ExploreConsentSheet.swift` shown the first time the user taps Explore Here.
- [ ] Explains: "Tapping Explore here sends your map center coordinate to OpenStreetMap (free, anonymous) and to our AI server. We never store who asked, only what was asked, for 30 days."
- [ ] Two buttons: "Continue" (proceeds + sets `userPreferences.exploreConsentGivenAt`) and "Not now".
- [ ] Subsequent taps skip the sheet.
- [ ] Settings has a "Revoke consent" row that clears the flag and disables Explore Here.

#### US-F3: Schema parity check across iOS and TypeScript
**Description:** As a developer, I need `pnpm parity:check` to cover the new fields so future changes don't drift.

**Acceptance Criteria:**
- [ ] `packages/core/src/experience.ts` adds the same prefixes (`exp_osm_`), confidence-level-1 semantics, and `discoveredCity` types as iOS.
- [ ] `scripts/check-swift-parity.ts` extended to check the new model classes vs TS types.
- [ ] CI job `.github/workflows/ci.yml` runs `pnpm parity:check` and fails on drift.
- [ ] PR template adds checkbox: "Updated TS schema if Swift schema changed."

#### US-F4: Localization for zh-Hans
**Description:** As a Chinese-language user, I want the app and paywall in Simplified Chinese.

**Acceptance Criteria:**
- [ ] `Resources/zh-Hans.lproj/Localizable.strings` covers every key in `en.lproj`. Translations done by hand for app-store-visible strings (paywall, onboarding, Explore button, errors).
- [ ] App Store description, keywords, screenshots have zh-Hans variants.
- [ ] Default fallback to English remains for missing keys.

#### US-F5: TestFlight beta and App Store metadata
**Description:** As a founder, I want a TestFlight build with 20 beta testers feeding usage data before public launch.

**Acceptance Criteria:**
- [ ] `.github/workflows/testflight.yml` already exists; verify it works on this branch and uploads on tag `v1.1.0-beta.N`.
- [ ] App Store Connect entry filled: name, subtitle, keywords (en + zh), 6 screenshots per locale (iPhone 17 Pro), category Travel, age 4+.
- [ ] In-app review prompt (`SKStoreReviewController.requestReview()`) triggered after the user marks 3rd Experience completed (not before).
- [ ] Beta tester invite list documented in `docs/BETA.md`.

---

### Epic G: Web Foundation (replace fake data, share Supabase with iOS)

#### US-G1: Migrate web from SVG fake-Lisbon to real Supabase + Mapbox
**Description:** As a developer, I need `apps/web/src/components/lisbon/WebLisbonMap.tsx` and `lisbon-data.ts` replaced with real Mapbox GL JS reading from Supabase, so web and iOS share one dataset.

**Acceptance Criteria:**
- [ ] Delete or quarantine `apps/web/src/lib/lisbon-data.ts` (move to `apps/web/src/lib/__legacy__/` for reference).
- [ ] `WebLisbonMap.tsx` becomes a real Mapbox GL JS map using `NEXT_PUBLIC_MAPBOX_TOKEN` and the canonical `Experience` type from `@solo-compass/core`.
- [ ] Markers come from `getExperiencesRepo().nearby({ lng, lat, radiusMeters })` against Supabase, not hardcoded SVG x/y.
- [ ] `WebExperience` type is removed; all callers use `@solo-compass/core` `Experience`.
- [ ] `apps/web/README.md` status header updated from "🚧 Foundation phase. Not yet running" to "Production target: v1.0".
- [ ] Lighthouse Performance score on the map page ≥ 75 on a 4G profile (no regression from baseline).
- [ ] Typecheck passes (run: `pnpm --filter @solo-compass/web typecheck`).
- [ ] Verify in browser via the dev-browser skill: open the page, confirm real markers appear at real coordinates.

#### US-G2: Web environment validation and Vercel preview deploy
**Description:** As a developer, I need every web env var validated at boot and a Vercel preview URL on every PR so reviewers see real builds.

**Acceptance Criteria:**
- [ ] `apps/web/src/lib/env.ts` extended with: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY` (already exists), `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (server) — all parsed via Zod with descriptive error messages.
- [ ] `vercel.json` already exists; verify it points to the Singapore (`sin1` or `hnd1`) region for low APAC latency.
- [ ] Add `vercel.com` GitHub integration: every PR gets a preview URL commented automatically.
- [ ] Production env vars set in Vercel dashboard (Mapbox token domain-locked to `*.vercel.app` for v1.0; tighten to a real domain in v1.2).
- [ ] Add `apps/web/.env.local.example` documenting every required var with example values.
- [ ] Typecheck passes.

#### US-G3: Tailwind warm design system + shared component primitives
**Description:** As a designer, I need `apps/web` to share the warm "paper-cream / kraft" design language with iOS and Mapbox style.

**Acceptance Criteria:**
- [ ] `apps/web/tailwind.config.ts` extended with the warm palette already used in iOS (cream, kraft, coffee, terracotta accents).
- [ ] Mapbox custom style published in Mapbox Studio (warm muted basemap), `mapbox://styles/<account>/<style-id>` recorded in `apps/web/src/lib/map-style.ts`.
- [ ] Shared components in `apps/web/src/components/ui/`: `Card`, `Badge`, `Button`, `Sheet` — using shadcn/ui defaults restyled with the warm palette. No new dependencies beyond shadcn primitives.
- [ ] `DesignNav` (currently a placeholder) replaced with a minimal top-nav: logo, city dropdown, language toggle (en/zh), download-iOS CTA.
- [ ] Visual regression: Storybook or simple Playwright screenshot test for each shared component in light + dark.
- [ ] Verify in browser using dev-browser skill: home page renders with the new palette.

#### US-G4: TanStack Query + URL state pattern across pages
**Description:** As a user, I want every filter, selected experience, and city to be reflected in the URL so I can share/bookmark any view.

**Acceptance Criteria:**
- [ ] `apps/web/src/lib/query-client.tsx` already exists; ensure all data fetching goes through it (no raw `fetch` in components).
- [ ] All filter state (`category`, `intent`, `radius`, `selectedId`) lives in URL search params via `useSearchParams`/`useRouter`. No `useState` for filterable state.
- [ ] `useNearby` hook (already exists) extended to read from URL params.
- [ ] Back/forward browser buttons restore filter + selection state correctly.
- [ ] Unit test: navigate via Playwright with `?category=food&selectedId=exp_lis_xxx`, assert sheet opens with that experience.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: change filters, copy URL, paste in new tab, confirm same view.

#### US-G5: Multi-locale routing (`/zh/...` + `/en/...`)
**Description:** As an SEO-driven product, I need locale-prefixed URLs that Google indexes separately so Chinese and English searches both find us.

**Acceptance Criteria:**
- [ ] Migrate App Router structure: top-level `[locale]` segment with `en` and `zh` as the only allowed values; default redirects based on `Accept-Language`.
- [ ] All routes refactored: `/[locale]/[city]`, `/[locale]/experience/[id]`, `/[locale]/trip/[slug]`.
- [ ] `next.config.ts` configured with `i18n` removed in favor of App Router-native pattern; `hreflang` `<link>` tags emitted on every page via root `layout.tsx`.
- [ ] Translation files in `apps/web/src/lib/i18n/` (en.json, zh.json) consumed via a lightweight `useT()` hook (no `next-intl` dep needed for v1.0).
- [ ] Typecheck passes.
- [ ] Verify in browser: visit `/zh/lisbon` and `/en/lisbon`, confirm content language matches and `<link rel="alternate" hreflang="..."/>` is present in HTML.

---

### Epic H: Web Product Surfaces (the 4 Scenarios)

#### US-H1 (Scenario D): SSG city pages with ISR
**Description:** As a Google-discovered user, I land on a static-generated city page that loads instantly and contains the city's top experiences.

**Acceptance Criteria:**
- [ ] `apps/web/src/app/[locale]/[city]/page.tsx` becomes RSC + `generateStaticParams`-driven; lists all cities present in Supabase `synthesized_experiences` with ≥ 5 entries.
- [ ] ISR `revalidate = 3600` (regenerate hourly); falls back to on-demand revalidation via `/api/revalidate?path=...`.
- [ ] Page contains: city hero image (one selected from sources), 3 sentence intro (from a `cities` Supabase table populated nightly by an Edge Function), top-12 experiences as cards, Mapbox static-image map embed (no JS map on SSG page; the interactive map is `/map?city=...`).
- [ ] JSON-LD `Place` + `BreadcrumbList` structured data emitted server-side.
- [ ] Lighthouse SEO ≥ 90, Performance ≥ 80 on a 4G profile.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: open `/en/lisbon`, view page source, confirm content is rendered server-side (not blank shell).

#### US-H2 (Scenario D): SSG experience detail pages with OG image
**Description:** As a user receiving a shared link, I land on a static experience page with rich preview, photo, and a "view on iOS" CTA.

**Acceptance Criteria:**
- [ ] `apps/web/src/app/[locale]/experience/[id]/page.tsx` becomes RSC + ISR; pre-renders top-500 experiences (by `solo_score_signals.count` desc) and falls back to dynamic for the long tail.
- [ ] OG image route at `apps/web/src/app/[locale]/experience/[id]/opengraph-image.tsx` (already exists) generates a card with title, city, Solo Score, category icon — using the warm palette.
- [ ] Schema.org `TouristAttraction` JSON-LD emitted with `geo`, `address` (cityCode), `aggregateRating` (basedOnCount, soloScore.overall).
- [ ] `<link rel="canonical">` points to the locale-stripped URL.
- [ ] Page includes: hero image, title (en + zh), oneLiner, whyItMatters, bestTimes, howTo, real inconveniences, "AI-generated · OpenStreetMap" badge if `confidence.level == 1`, "Open in iOS" smart banner.
- [ ] Lighthouse SEO ≥ 90.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: visit a real experience URL, confirm OG image renders by inspecting `og:image` meta and opening it directly.

#### US-H3 (Scenario D): sitemap.xml + robots.txt + canonical/hreflang
**Description:** As an SEO-conscious operator, I need every public URL discoverable by Google with correct localization signals.

**Acceptance Criteria:**
- [ ] `apps/web/src/app/sitemap.ts` generates `sitemap.xml` listing every city + experience page in both locales (uses Supabase to enumerate published rows).
- [ ] `apps/web/src/app/robots.ts` emits `robots.txt` with `Sitemap:` directive and explicit `Disallow: /api/`.
- [ ] Every page emits `<link rel="canonical">` and per-locale `<link rel="alternate" hreflang="...">` tags.
- [ ] Submit sitemap to Google Search Console (manual, document in `docs/WEB_OPS.md`).
- [ ] Lighthouse SEO score ≥ 95 on home + city + experience routes.
- [ ] Verify in browser using dev-browser skill: hit `/sitemap.xml` and `/robots.txt`, confirm valid XML / text response.

#### US-H4 (Scenario A): Desktop research center — multi-pane layout
**Description:** As a desktop user planning a trip, I need a wide layout with map + list + filters + selected-experiences drawer.

**Acceptance Criteria:**
- [ ] New route `apps/web/src/app/[locale]/research/page.tsx` (Scenario A entry).
- [ ] Layout breakpoints: `lg` (≥ 1024px) shows three columns — left sidebar (filters + city picker), center (map), right (selected-experiences pinboard, max 5 simultaneously).
- [ ] Below `lg`: collapses to mobile layout (Scenario B path).
- [ ] Pinboard persists in URL (`?pinned=id1,id2,id3`); sharing the URL recreates the same selection.
- [ ] "Compare" mode: tap two pinned experiences to see side-by-side bestTimes / soloScore / category in a modal.
- [ ] "Save as Trip" button: takes the pinned IDs and creates a `trips` Supabase row; redirects to `/[locale]/trip/[slug]` (Scenario C).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill at 1440px viewport: pin 3 experiences, click Save as Trip, confirm trip page loads with same 3 entries.

#### US-H5 (Scenario A): Filters with category + best-time + intent
**Description:** As a planner, I need to combine category, best-time-of-day, and free-text intent filters to narrow the list.

**Acceptance Criteria:**
- [ ] Sidebar filter component: category multi-select (the 8 ExperienceCategory values), time-of-day buttons (morning / afternoon / evening / night), intent text input.
- [ ] Filters compose as URL query params; `useNearby` reads them and forwards to `/api/experiences/nearby`.
- [ ] `/api/experiences/nearby` extended to accept `categories=food,coffee&hour=14`.
- [ ] Empty state: "No experiences match. Clear filters or pick a different city."
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: combine 2 filters, confirm marker count drops; clear filters, confirm full set returns.

#### US-H6 (Scenario B): Mobile zero-install funnel — landing + smart banner
**Description:** As a mobile-web user (no iOS app installed), I need a frictionless preview with a clear path to install.

**Acceptance Criteria:**
- [ ] Mobile breakpoint of `/[locale]/[city]` renders a tap-to-explore map + bottom sheet with experience cards (like a stripped iOS).
- [ ] At top of mobile pages: a dismissible smart banner "Try Solo Compass — free trial on iOS" with App Store link (use Apple's official Smart App Banner via `<meta name="apple-itunes-app">`).
- [ ] No voice intent on mobile web (iOS-only feature) — voice icon hidden or disabled with tooltip.
- [ ] No checkin button on mobile web (Pro feature) — replaced with "Save with iOS" CTA.
- [ ] Bottom-of-page CTA card: "Want this on the go? Get the iOS app" with button to App Store.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill at 390x844 viewport: confirm no voice/checkin, smart banner visible, CTAs work.

#### US-H7 (Scenario B): Browser geolocation with graceful fallback
**Description:** As a mobile user, I want the map to center on my location with permission, or fall back to the city's centroid.

**Acceptance Criteria:**
- [ ] On first map load: request browser geolocation via `navigator.geolocation.getCurrentPosition` with `{ maximumAge: 60000, timeout: 5000 }`.
- [ ] On grant: center map on user, fetch nearby.
- [ ] On deny / timeout: fall back to the city centroid from `cities` table or to a default Lisbon center.
- [ ] No nagging permission prompts; if user denies once, store in `localStorage` and don't ask again for 30 days.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: deny permission, confirm map still loads with fallback center.

#### US-H8 (Scenario C): Trip recap pages — generation flow
**Description:** As a paid iOS user finishing a trip, I want a public URL recap of every experience I completed.

**Acceptance Criteria:**
- [ ] iOS gains a Settings → "My Trips" section showing completed trips.
- [ ] On iOS: when user has 3+ completed Experiences in the same `cityCode` within a 14-day window, prompt "Save these N visits as a Trip?" — on accept, calls Supabase Edge Function `create-trip` which inserts into `trips` table with auto-generated slug (city-randomstring) and returns the public URL.
- [ ] Web `/[locale]/trip/[slug]/page.tsx` (RSC + ISR) renders: trip title (editable on iOS), city, date range, experience cards in completion order, total duration, "Made with Solo Compass" footer.
- [ ] OG image generated via `opengraph-image.tsx`: trip title + 3 experience thumbnails + Solo Compass logo.
- [ ] Privacy: trips are public-by-default but only have a slug, no userId in URL; user can delete a trip from iOS Settings (cascades to Supabase).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: visit a real trip URL, confirm content + OG.

#### US-H9 (Scenario C): Share buttons + WeChat-friendly cards
**Description:** As a user finishing a trip, I want to share the recap to WeChat / Twitter / 小红书 with one tap.

**Acceptance Criteria:**
- [ ] Trip page has a "Share" button that opens a sheet with: Copy link, WeChat (uses WeChat JSSDK if available, else QR code), Twitter (web intent), Weibo (web intent).
- [ ] WeChat-friendly OG: `<meta property="og:image">` is at least 600x320 PNG; tested by pasting URL into WeChat dev tool's link debugger.
- [ ] No sharing libraries beyond a small `apps/web/src/lib/share.ts` (no external deps).
- [ ] Add `Web Share API` fallback for mobile browsers that support it.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill: click Share, confirm Twitter intent opens a window with the right URL prefilled.

#### US-H10 (Scenario A + analytics): Web analytics — PostHog events
**Description:** As a founder, I need 8 core web events tracked so I can run a conversion funnel.

**Acceptance Criteria:**
- [ ] `apps/web/src/lib/analytics.tsx` already exists; ensure these events fire: `page_view` (auto), `city_view`, `experience_view`, `trip_view`, `marker_click`, `pin_to_compare`, `save_trip`, `download_ios_click`.
- [ ] Each event includes `locale`, `referrer_domain`, and `device_class` (mobile/tablet/desktop).
- [ ] PostHog dashboard configured with these 4 funnels: SEO → city page → experience → iOS install; SEO → trip view → iOS install; mobile preview → smart banner click; desktop research → save trip.
- [ ] Document the funnel in `docs/WEB_ANALYTICS.md` with PostHog query links.
- [ ] No PII tracked (no email, no IP — PostHog's `disable_ip_capture` set).
- [ ] Typecheck passes.

#### US-H11 (Scenario A): "Open in iOS" deep link via custom URL scheme
**Description:** As a web user reading an experience or trip page, tapping "Open in iOS" should jump straight to that detail in the iOS app if installed.

**Acceptance Criteria:**
- [ ] iOS gains URL scheme registration: `solocompass://experience/<id>` and `solocompass://trip/<slug>` (via project.yml `info.URLTypes`).
- [ ] iOS handles the URL by routing to the matching detail view; missing data triggers a fetch from Supabase first.
- [ ] Web "Open in iOS" button on experience and trip pages: tries the custom scheme via a hidden iframe + 1.5s App Store fallback if scheme doesn't fire.
- [ ] Verify on simulator + device: tapping the button on the web page opens the iOS app at the correct screen.
- [ ] Typecheck passes.

**Universal Links (`https://...` URLs auto-opening in iOS) are DEFERRED to v1.2** because they require a custom domain (US-I3 deferred). Once a real domain is registered in v1.2, the follow-up work is: ship `apple-app-site-association` at `apps/web/public/.well-known/apple-app-site-association`, add iOS `Associated Domains` entitlement in `project.yml`, and remove the iframe + App Store fallback hack from web.

#### US-H12: Vercel Edge caching + CDN strategy
**Description:** As a high-traffic page operator, I need cache headers and edge-runtime configured so static pages don't hit Supabase repeatedly.

**Acceptance Criteria:**
- [ ] All RSC pages opt into Edge runtime where possible (`export const runtime = 'edge'` for read-only pages; keep Node for `/api/experiences/*` because Supabase SDK uses Node APIs).
- [ ] Static pages have `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.
- [ ] On-demand revalidation endpoint `/api/revalidate?secret=...&path=...` that's hit by a Supabase webhook when an Experience updates.
- [ ] Vercel Analytics enabled to monitor cache hit ratio (target ≥ 80%).
- [ ] Document cache strategy in `docs/WEB_DESIGN.md` updates.
- [ ] Typecheck passes.

#### US-H13: Web E2E Playwright suite for the 4 critical paths
**Description:** As a quality gate, every PR runs a smoke test of the 4 Scenarios so we don't break them.

**Acceptance Criteria:**
- [ ] New `apps/web/tests/e2e/` directory with Playwright config.
- [ ] Tests: (1) home → research view → pin 2 experiences → save trip; (2) `/zh/lisbon` renders Chinese content + correct hreflang; (3) `/experience/<id>` shows OG image meta; (4) mobile viewport shows smart banner + no voice button.
- [ ] CI workflow `.github/workflows/web-ci.yml` runs `pnpm --filter @solo-compass/web test:e2e` on every PR; failure blocks merge.
- [ ] Tests run against a Vercel preview URL (the workflow waits for the preview to be ready).
- [ ] Typecheck passes.

---

### Epic I: Pre-Launch Operational Readiness

> **Note:** Epic I is process work, not code. Each story produces a checked-in artifact (config file, doc, or external account in a documented state) so any team member can verify completion.

#### US-I1: Mapbox account, production token, custom warm style
**Description:** As an operator, I need a real Mapbox token (not the placeholder default) and a custom map style published.

**Acceptance Criteria:**
- [ ] Mapbox account created (free Studio tier; 50k map loads/month sufficient for beta).
- [ ] Two access tokens generated: `production` (URL-restricted to `*.vercel.app` for v1.0 — tighten to a real domain in v1.2), `development` (no restriction). Both stored in 1Password and Vercel env vars.
- [ ] Custom style created in Mapbox Studio: warm cream basemap, muted street labels, terracotta highlights for selected POI. Style URL recorded in `apps/web/src/lib/map-style.ts`.
- [ ] Document in `docs/WEB_OPS.md` how to rotate the token.

#### US-I2: Supabase production project provisioned
**Description:** As an operator, I need a Supabase production project ready before Epic E starts so iOS team can deploy migrations.

**Acceptance Criteria:**
- [ ] Supabase project `solo-compass-prod` created in Singapore region.
- [ ] URL, anon key, service-role key recorded in 1Password and added to Vercel + iOS Secrets.plist (dev) and CI secrets (prod).
- [ ] PITR (point-in-time recovery) enabled — minimum on Pro plan ($25/mo); spend justified in `docs/WEB_OPS.md`.
- [ ] Database backups verified: trigger one manual backup and document the restore procedure.

#### US-I3: Domain registration — DEFERRED to v1.2
**Description:** Per founder decision (2026-05-09), no custom domain in v1.0. Web ships on Vercel's default `*.vercel.app` URL.

**Acceptance Criteria (this cycle):**
- [ ] Vercel project created; production deploy URL recorded (e.g. `solo-compass.vercel.app` if available, else auto-assigned).
- [ ] Customer support email: a free Gmail with descriptive alias (e.g. `solocompass.support@gmail.com`); document in `docs/WEB_OPS.md`.
- [ ] Privacy policy + terms hosted on a public Notion page (e.g. `solocompass.notion.site/privacy`); URL referenced from `Info.plist` and web footer.
- [ ] Mapbox production token domain-locked to `*.vercel.app` (less secure than a real domain but acceptable for v1.0).
- [ ] Document in `docs/WEB_OPS.md` the exact URLs in use and the migration plan to switch to a real domain in v1.2 (only env vars + AASA file would change).

**Acceptance Criteria (v1.2 follow-up, not blocking this PRD):**
- [ ] Register a real domain (Cloudflare Registrar, ~$15/yr).
- [ ] Configure DNS, SSL, email forwarder, AASA endpoint.
- [ ] Switch Mapbox token domain lock and Vercel production alias.

#### US-I4: App Store Connect — full account and IAP SKUs
**Description:** As an operator, I need the App Store side fully configured weeks before TestFlight, because Apple reviews take time.

**Acceptance Criteria:**
- [ ] Apple Developer Program enrollment confirmed (existing — verify still active).
- [ ] App Store Connect entry for `com.solocompass.app` created with name, subtitle, category Travel, age 4+.
- [ ] In-App Purchase SKUs created and submitted for review:
  - `com.solocompass.pro.monthly` — Apple price tier 2, P1M, 7-day intro free trial
  - `com.solocompass.pro.yearly` — Apple price tier 11, P1Y, 7-day intro free trial
- [ ] Subscription group "Solo Compass Pro" created; both SKUs in the same group.
- [ ] Promotional artwork uploaded for each SKU.
- [ ] App privacy questionnaire pre-filled (data types matching `PrivacyInfo.xcprivacy` from US-F1).

#### US-I5: Privacy policy + terms of service drafted and hosted
**Description:** As an App Store applicant + GDPR-aware founder, I need the legal docs live before any user-facing launch.

**Acceptance Criteria:**
- [ ] `apps/web/src/app/[locale]/privacy/page.tsx` and `terms/page.tsx` rendered as RSC pages, content in en + zh.
- [ ] Privacy policy covers: location data (precise + coarse), device ID (Supabase anon UUID), purchases (StoreKit Transaction.id), diagnostics (Supabase events), AI processing (OpenStreetMap query, Anthropic processing), retention (30 days for AI cache; indefinite for user data until deletion request), third-party (Mapbox, Sentry, PostHog, Anthropic, OpenStreetMap, Apple).
- [ ] Terms cover: subscription auto-renewal, refund policy (no manual refunds for quota usage; standard Apple refund channel), AI content disclaimer (AI-generated info may be wrong, verify on-site).
- [ ] Both pages linked from iOS Settings, web footer, and paywall.
- [ ] First version drafted by hand using a template (Termly free tier or Iubenda). Document review: at least one trusted reader signs off.

#### US-I6: Anthropic production API key + cost monitoring
**Description:** As an operator, I need a separate production Anthropic key with spend alerts so a runaway loop doesn't bankrupt me.

**Acceptance Criteria:**
- [ ] Anthropic Console: production workspace separate from dev. New key issued with `prod-` prefix in name.
- [ ] Spend limits set: $50/month soft alert (email), $200/month hard cap.
- [ ] Prompt caching enabled (cache the system prompt and few-shot examples — saves 50–80% on repeated calls).
- [ ] Key stored in Supabase Edge Function secrets (US-E4) and Vercel env vars (for any web-side AI calls); never committed.
- [ ] Document key rotation procedure in `docs/WEB_OPS.md`.

#### US-I7: Sentry + PostHog production projects
**Description:** As an operator, I need observability dashboards live before beta so I see what breaks.

**Acceptance Criteria:**
- [ ] Sentry project `solo-compass-web` (Next.js platform) and `solo-compass-ios` (Apple platform) created. DSNs in 1Password + Vercel + iOS.
- [ ] PostHog project `solo-compass` created (free tier sufficient for first 1M events).
- [ ] Error budget alerts: Sentry alerts on > 10 unique errors/hour to email.
- [ ] PostHog dashboards: 4 funnels documented in US-H10.
- [ ] `disable_ip_capture: true` set on PostHog client to comply with GDPR posture.

#### US-I8: Customer support inbox + response templates
**Description:** As a paying-customer-supporter, I need a working inbox and ready-made replies for the 5 most likely questions.

**Acceptance Criteria:**
- [ ] Customer support email live: a Gmail alias (e.g. `solocompass.support@gmail.com`) — switch to `support@<domain>` when domain is registered in v1.2.
- [ ] Helpdesk: HelpScout free trial OR a single Notion shared inbox; documented in `docs/SUPPORT.md`.
- [ ] Response templates drafted in `docs/SUPPORT.md`: subscription cancellation (must not retain — Apple rule), refund requested for AI quota use (politely decline, link to Apple's refund flow), AI gave wrong info (apologize, ask for the experience id, file an internal ticket), can't restore purchase, account deletion request (GDPR — within 30 days).

#### US-I9: Beta tester recruitment list + TestFlight invitations
**Description:** As a beta organizer, I need 20 named testers with diverse profiles so feedback covers our real audience.

**Acceptance Criteria:**
- [ ] `docs/BETA.md` lists 20+ testers with: name, locale (en or zh), iOS device class, expected use case (commuter / solo traveler abroad / casual user), recruitment source.
- [ ] At least 5 testers physically located outside Chiang Mai (the curated city) so we test the cold-start experience.
- [ ] At least 5 zh-Hans-primary testers.
- [ ] TestFlight external testing group created; first 20 invitations sent on `v1.1.0-beta.1` upload.
- [ ] Feedback collection: a Notion form (or Supabase table-backed Tally form) linked from in-app Settings → "Send feedback".

#### US-I10: AI cost dashboard + weekly review cadence
**Description:** As a founder watching unit economics, I need a weekly automated cost report so I catch surprises early.

**Acceptance Criteria:**
- [ ] Supabase scheduled Edge Function `weekly-cost-report` runs every Monday 09:00 SGT: queries `subscription_events`, `solo_score_signals`, and Anthropic usage (via API), emits a Markdown report.
- [ ] Report posted to Slack or sent by email.
- [ ] Tracked metrics: total Claude spend ($), spend per Pro user ($/user/day), cache hit rate (% of synthesis requests served from cache), trial conversion rate (%).
- [ ] First baseline report generated manually before beta.1; subsequent reports automated.
- [ ] Document the report template in `docs/WEB_OPS.md`.

#### US-I11: Launch announcement materials
**Description:** As a launching founder, I need the press / social / community materials ready 1 week before GA.

**Acceptance Criteria:**
- [ ] Product Hunt launch description (en) drafted in `docs/LAUNCH.md` — includes tagline, 4 bullets, top features, founder story (3 sentences).
- [ ] Twitter/X launch thread (5 tweets) drafted en.
- [ ] 小红书 post drafted zh — 1 cover image + 4 paragraphs of body.
- [ ] V2EX post drafted zh.
- [ ] One 30-second screen-recording demo (no music, no narration) saved to `docs/launch-assets/`.
- [ ] All materials reviewed by at least one trusted reader before GA.

#### US-I12: GA cutover runbook
**Description:** As an operator on launch day, I need a runbook so I don't forget a step under pressure.

**Acceptance Criteria:**
- [ ] `docs/RUNBOOK.md` containing: pre-flight checklist (24h before GA), launch-day steps in order, rollback procedure if a P0 surfaces, contact tree.
- [ ] Pre-flight checklist verifies: Supabase backups working, App Store Connect status "Ready for sale", Vercel deployment green, sitemap submitted to Google, all docs URLs resolve, customer support inbox monitored, AI quota not depleted.
- [ ] Post-launch monitoring: 6 hours of active watch over Sentry + PostHog + Anthropic spend dashboards.
- [ ] First 24h customer-support SLA: respond to every email within 4 hours.

---

## 4. Functional Requirements

### Persistence
- **FR-1:** All Experiences (seed, OSM-generated, user-added) stored in SwiftData; bundle seed imported once on first launch.
- **FR-2:** User completion, favorites, and micro-surveys stored in SwiftData; legacy `UserDefaults` arrays migrated automatically.
- **FR-3:** SwiftData schema is versioned; v1 schema declared explicitly to allow future migrations.

### Caching & Cost
- **FR-4:** Overpass results cached for 14 days, keyed by 0.01 degree rounded coordinate + radius.
- **FR-5:** Claude synthesis results cached for 30 days locally and indefinitely server-side via Supabase.
- **FR-6:** Default synthesis model is Sonnet 4.6; explanation model is Haiku 4.5; Opus is gated behind a debug flag only.
- **FR-7:** Per-user daily AI quota: free=0, Pro=30 syntheses + 60 explanations.

### Trust & UX
- **FR-8:** Pins with `confidence.level == 1` render with dashed border, 70% opacity, and an info disclosure in detail view.
- **FR-9:** OSM-derived Experiences must include `(c) OpenStreetMap contributors` in `sources` and link to the node URL.
- **FR-10:** Synthesis prompt forbids invented specifics (menu items, hours, prices, interior details, owner backstories).
- **FR-11:** Reverse geocoding resolves city names; falls back to `osm_<lat>_<lon>` only when geocoder fails.

### Freemium & Monetization
- **FR-12:** Two subscription products with **globally uniform Apple price tiers** (auto-converted per region by App Store):
  - Monthly: Apple price tier 2 (~$1.99 USD; ¥12 CNY; €1.99; ¥300 JPY).
  - Yearly: Apple price tier 11 (~$14.99 USD; ¥98 CNY; €14.99; ¥2200 JPY).
  - Both with 7-day intro free trial.
- **FR-13:** AI features (Explore Here synthesis, voice intent, AI explanations) require `entitlement` in `{.proTrial, .pro}`. Free users see paywall instead.
- **FR-14:** Free users still receive OSM skeleton mode for Explore Here so they see value before subscribing.
- **FR-15:** Restore purchases works without sign-in via Apple ID.
- **FR-16:** Entitlement cached in Keychain for offline boot.
- **FR-16b:** Sign-in-with-Apple linking is supported in v1.1 (US-E6) and unlocks Family Sharing eligibility; remains optional.

### Backend & Sync
- **FR-17:** Supabase anonymous auth on first launch; `userId` persisted in Keychain.
- **FR-18:** Outbox sync flushes every 30 s and on foreground; LWW conflict resolution.
- **FR-19:** All Anthropic calls go through a Supabase Edge Function after Epic E ships; the iOS app no longer holds the API key.
- **FR-20:** Solo-Score aggregates recomputed nightly server-side; clients pull on foreground.
- **FR-24 (Local-first invariant):** SwiftData is the source of truth for every UI read. The app must be fully usable with Supabase unreachable: full map, all generated Experiences, completed/favorites, micro-survey submission (queued for later), entitlement check (Keychain cache). Backend writes are best-effort; failure must never block a UI action or surface a blocking error.
- **FR-25:** Supabase region: Singapore (`ap-southeast-1`) for v1.1; Tokyo failover documented but not provisioned.

### Privacy & Compliance
- **FR-21:** `PrivacyInfo.xcprivacy` declares all collected data types accurately; nothing is used for tracking.
- **FR-22:** First-run consent sheet required before Explore Here ever sends coordinates off-device; revocable in Settings.
- **FR-23:** Privacy policy URL configured in `Info.plist` and reachable.

### Web foundation
- **FR-26:** `apps/web` reads from the same Supabase project as iOS (`synthesized_experiences`, `osm_pois`, `cities`, `trips`); no SVG / hardcoded fake data in production routes.
- **FR-27:** Multi-locale routing: every public route is prefixed with `/en/` or `/zh/`; `/` redirects based on `Accept-Language`. Locale switching preserves the rest of the path.
- **FR-28:** Every public page is server-rendered (RSC) and indexable; client-side-only views are limited to interactive map/research routes that are not SEO targets.
- **FR-29:** Mapbox token is environment-validated, domain-locked in production, and stored only in Vercel + 1Password — never committed.
- **FR-30:** Every web mutation goes through an authenticated `/api/...` route; client components never call Supabase directly with the service-role key.

### Web product surfaces
- **FR-31:** Scenario A (research) requires viewport ≥ 1024px to show the 3-column layout; below that, falls back to Scenario B mobile layout.
- **FR-32:** Scenario B (mobile preview) hides voice and Pro-gated features and surfaces a smart App Store banner.
- **FR-33:** Scenario C (trip recap) URLs are public-by-default with slug-only paths; user can delete a trip from iOS Settings; deletion cascades server-side and triggers ISR revalidation within 60 s.
- **FR-34:** Scenario D (SEO) generates static city + experience + trip pages via ISR; Lighthouse SEO ≥ 90 on every public route; sitemap covers all locales; canonical + hreflang tags present.

### Cross-platform integration
- **FR-35:** `solocompass://experience/<id>` and `solocompass://trip/<slug>` URL schemes registered in iOS; web "Open in iOS" buttons attempt scheme + 1.5 s App Store fallback.
- **FR-36 (deferred to v1.2):** Universal Links require a real custom domain; deferred along with US-I3. Until then, the custom URL scheme above is the only deep-link path.
- **FR-37:** A single `cities` table powers both iOS city picker and web `/[locale]/[city]` static pages — populated by a nightly Supabase function.

### Operational
- **FR-38:** Anthropic spend has a hard cap of $200/month enforced by Anthropic Console; alerts at $50/month go to founder email.
- **FR-39:** Vercel deploy region is Singapore (`sin1` or `hnd1`).
- **FR-40:** Every public-facing legal/help URL (privacy, terms, support) resolves before GA and is linked from at least three places (iOS Settings, web footer, paywall).
- **FR-41:** Weekly automated cost report runs every Monday 09:00 SGT and is delivered to founder.

---

## 5. Non-Goals (Out of Scope)

- **No social graph.** No friends, no public profiles, no following, no likes from other users.
- **No bot in this PRD.** `apps/bot` (Telegram) is parked; Supabase schema is shared so it can land later.
- **No mandatory sign-in.** Sign-in-with-Apple is optional (US-E6) and only used to upgrade an anonymous account. The default flow stays anonymous.
- **No web payments in v1.0.** All paid features stay iOS-only via StoreKit. The web app's role is discovery, SEO, and recap — not monetization. (Web payments via Stripe is v1.2+.)
- **No native Android in this cycle.** Web Scenario B already covers "non-iOS users" with a frictionless mobile preview + App Store banner.
- **No CMS for editorial city content.** City intros come from a small `cities` Supabase table edited via SQL by the founder; full editorial CMS is post-launch.
- **No user-generated content on web.** Comments, ratings, photos uploaded by users on web are out of scope. All user input continues through the iOS app via micro-survey + check-ins.
- **No offline basemap tiles.** Offline mode shows pins and detail data on Apple's blank basemap; downloading MapKit tiles is post-v1.1.
- **No third-party POI sources** beyond OpenStreetMap (no Foursquare, Google Places, Yelp, TripAdvisor).
- **No human moderation queue** for AI content in v1.1; rely on prompt constraints + visual downgrade. Moderation is v1.2.
- **No analytics SDKs** (no Mixpanel/Amplitude/Sentry). All events go to our own Supabase tables.
- **No push notifications beyond the existing geofence check-in nudge.**
- **No iPad-optimized layout.** App runs on iPad but UI is the iPhone layout scaled.
- **No referral / promo-code system in v1.1.** Standard Apple promo codes via App Store Connect only.

---

## 6. Design Considerations

- **Reuse existing components:** `MarkerIconView`, `ConfidenceBadge`, `ExperienceCardView`, `BottomInfoBar`, `FilterBarView`. No design system overhaul.
- **Paywall visual style:** Match existing `.regularMaterial` / SF Symbols aesthetic; no animated gradients or stock illustration. One product hero + two cards.
- **Skeleton-mode pin:** dashed stroke outline + 70% opacity (already prototyped for the long-press candidate marker — reuse that path).
- **City picker:** discovered cities show a small sparkle icon next to the name to indicate AI-explored; curated cities (Chiang Mai today) show a star icon.
- **Toasts:** lightweight `Capsule()` over `BottomInfoBar`, auto-dismiss in 3 s. Reuse the AI-error banner pattern.
- **Free vs Pro affordance:** Lock icon on the Explore button when free; subscribe CTA in info banners. No nag screens or interstitials.

---

## 7. Technical Considerations

### Stack additions
- **SwiftData** — iOS 17+ (already deployment target).
- **StoreKit 2** — new dependency, no third-party.
- **Supabase Swift SDK** — `supabase-swift` via SPM (one of the few cases the project breaks its "zero deps" rule; documented in `CLAUDE.md`).
- **Supabase project** — single project, two schemas (`public`, `private`). Hosted on Supabase Cloud (free tier covers the first 50k MAU; budget upgrade documented).
- **Supabase Edge Functions** — Deno runtime; one function (`synthesize-experiences`) holds the Anthropic key.

### Migration path
1. Land Epic A (persistence) on `feat/persistence-swiftdata` — no behavior change for users.
2. Land Epic B (caching + Sonnet) on `feat/ai-cost-control`.
3. Land Epic C (UX polish) on `feat/explore-trust`.
4. Land Epic D (StoreKit) on `feat/freemium-paywall` — first user-visible paid moment.
5. Land Epic E (Supabase) on `feat/backend-sync` — removes API key from client; this is the highest-risk merge and gets staged behind a feature flag.
6. Land Epic F (privacy/store) on `feat/app-store-prep` — final polish.
7. Tag `v1.1.0-beta.1`, push to TestFlight, gather 2 weeks of feedback, then `v1.1.0`.

### Feature flags
- `FF_BACKEND_SYNC` — gates Supabase calls; off by default in beta.1, on by beta.3.
- `FF_PAYWALL_ENABLED` — lets us TestFlight without showing the paywall to early testers.
- Stored in `Resources/FeatureFlags.plist` and overridable via launch args.

### Performance budgets
- App cold-start time: <= 1.0 s on iPhone 14 (currently ~0.7 s; SwiftData container init must not regress).
- Map first-pin-render: <= 300 ms after location lock.
- Explore Here end-to-end (cache miss): <= 6 s on a good network; (cache hit): <= 200 ms.
- Sync round-trip: <= 1 s on 4G.
- SwiftData query for "experiences within 5 km, filtered by category": <= 50 ms with 1000 records.

### Risks
- **R1 — SwiftData migrations are fragile.** Mitigate by versioning the schema from day 1 and never modifying v1 in place.
- **R2 — Apple may reject "anonymous account auto-creation".** Mitigate by making the anonymous account explicit in onboarding ("Solo Compass uses an anonymous device ID to sync across your devices. No email needed.").
- **R3 — Supabase Edge Function cold start.** First call may take 2–3 s; warm pings every 5 min via cron. Document fallback (skeleton mode if Edge Function times out).
- **R4 — Sonnet output quality regression vs Opus.** Mitigate via golden-set snapshot tests in US-B3 and ability to toggle back.
- **R5 — Server-side cache "lights up regions for free users" creates a vector for Pro users to feel cheated.** Counter by making the value of Pro about *speed of fresh exploration* + *daily quota* + *future AI features*, not exclusivity of past cache hits. Document this in the paywall copy.

---

## 8. Success Metrics

### North-Star
- **Daily Active Paid Users (DAPU)** — target 200 by week 4 post-launch.

### Activation
- >= 60% of users who tap "Explore Here" on free tier reach the paywall.
- >= 15% of paywall views start the free trial.
- >= 40% of trials convert to paid (industry benchmark: 30-50% for utility apps).

### Retention
- Day-7 retention free: >= 25%.
- Day-7 retention paid: >= 60%.
- Day-30 retention paid: >= 40%.

### Cost
- Average AI cost per paid user per day <= $0.30.
- >= 50% of synthesis requests served from cache after week 4 (the flywheel).

### Trust / Quality
- < 5% of generated Experiences flagged via Report Issue ("factually incorrect").
- >= 60% of generated Experiences in a region get at least 1 micro-survey within 60 days.

### Engineering
- All 6 epics ship within a 6-week calendar window.
- `xcodebuild test` passes on every PR; coverage on new code >= 75%.
- Zero P0 crashes in production for 14 days post-launch (measured via Apple's Crashes & Energy logs).

---

## 9. Resolved Decisions & Remaining Open Questions

### Resolved (decided 2026-05-09 with @cubxxw)

1. **Pricing — globally uniform USD-anchored tiers (Apple auto-converts).**
   - Monthly: **Apple price tier 2** (~$1.99 USD; ¥12 CNY; ¥300 JPY; €1.99 EUR). Anchor product, lowers friction.
   - Yearly: **Apple price tier 11** (~$14.99 USD; ¥98 CNY; ¥2200 JPY; €14.99 EUR). ~37% savings, nudges to annual.
   - Both with **7-day free trial**. No per-region discounts; same Apple tier ID applied everywhere — App Store auto-converts to local currency at Apple's official tiers, removing the need to maintain a price matrix.
   - Documented in `docs/APP_STORE.md` for ASO localization.

2. **Sign-in-with-Apple linking — included in v1.1.**
   - Promoted from Epic E follow-up to **US-E6** (new). Anonymous users can optionally tap "Save my data with Apple" in Settings to link their session, enabling Family Sharing eligibility from day 1 and protecting against accidental anon-token loss.
   - Still optional — anonymous-only flow remains the default.

3. **Backend posture — local-first, cloud as cache & sync only.**
   - SwiftData remains the **source of truth** for every read in the UI. Supabase serves three purposes: (a) outbox sync target; (b) shared AI synthesis cache; (c) Edge Function host for the Anthropic key.
   - The app must be **fully usable with Supabase unreachable**. All sync writes are best-effort; all reads can be served entirely from local SwiftData.
   - Supabase region: **Singapore** (`ap-southeast-1`) — closest to expected APAC user base; Tokyo as failover region documented but not provisioned in v1.1.
   - This is a stronger constraint than the original draft; it adds explicit **FR-24** below and is reflected in updated US-E3 acceptance criteria.

4. **Solo-Score cold-start — show a clearly-marked AI estimate, not a hidden field.**
   - When `signal_count == 0`: render the score with a small "AI estimate" pill and dimmed color; tooltip on the score reads "Estimated by AI from venue tags. Solo travelers haven't reported in yet."
   - When `signal_count` between 1–2: render normally but show "Based on N early reports" instead of the usual basedOn copy.
   - When `signal_count >= 3`: full-strength score, "Based on N solo travelers".
   - This is the best UX trade-off — hiding the score makes the map feel empty for new regions, but unmarked AI estimates would erode trust over time. Documented as **US-C5b** below.

### Remaining open (defer)

- **OSM attribution placement.** Sources section is fine for ODbL legal minimum; consider a one-line credit at the bottom of the detail view in v1.2 if any contributor flags it. *Owner: @cubxxw, beta-stage decision.*
- **Skeleton-mode richness.** OSM name + tag-derived category is the v1.1 minimum. If beta users say "this looks empty," add one heuristic-driven sentence (template per category) in a hot-fix. *Owner: product, validate in beta.*
- **Refund policy for hitting daily AI quota.** Standard Apple refund process applies; we'll publish a one-line "no manual refunds for quota usage" policy in the paywall fine print. *Owner: @cubxxw, before App Store submission.*
- **Edge Function language.** Deno/TS confirmed by default to keep the team in one language. *Owner: @cubxxw.*

---

## 10. Sequencing Summary

> **Note:** Epic I (operational readiness) runs **in parallel** with engineering weeks 1–10, not sequentially. Account creation, domain registration, App Store SKU review all have lead times that block GA if started late.

| Week | Engineering focus | Ops parallel work | Deliverable |
|---|---|---|---|
| 0 (now) | Branch off `main` | I1, I2, I4 started: Mapbox account, Supabase project, App Store dev account verified. I3 (domain) deferred to v1.2. | Accounts created |
| 1 | Epic A: Persistence (`feat/persistence-swiftdata`) | I5 drafting: privacy policy + terms | All iOS data on disk; no UX change |
| 2 | Epic B: Cost control (`feat/ai-cost-control`) | I6: Anthropic prod key + spend caps | Sonnet default + caching live |
| 3 | Epic C: Trust UX (`feat/explore-trust`) | I7: Sentry/PostHog prod projects | Visual downgrade + reverse geocode + survey feedback |
| 4 | Epic D: StoreKit (`feat/freemium-paywall`) | I4: App Store IAP SKUs submitted | Paywall live behind FF |
| 5 | Epic E: Supabase (`feat/backend-sync`) | I2 verified: prod Supabase ready | Server cache + sync + key removed from client + optional Apple ID link |
| 6 | Epic F: iOS store prep (`feat/app-store-prep`) | I5 published: privacy + terms hosted on Notion | iOS feature-complete |
| 7 | Epic G: Web foundation (`feat/web-foundation`) | Vercel deploy URL confirmed; Mapbox token domain-locked to `*.vercel.app` | Real Supabase + Mapbox on web |
| 8 | Epic H1–H3 (`feat/web-seo`) | I8: customer support inbox | SEO city + experience pages live |
| 9 | Epic H4–H7 (`feat/web-research-mobile`) | I9: beta tester list finalized | Scenarios A + B done |
| 10 | Epic H8–H13 (`feat/web-trips-deeplink`) | I10: cost dashboard automated | Scenarios C + cross-platform deep links |
| 11 | Tag `v1.1.0-beta.1` (iOS) + web preview push | I11: launch announcements drafted | TestFlight beta.1 + staging web |
| 12 | Beta feedback hot-fixes (iOS + web) | I12: GA runbook drafted + reviewed | Beta.2 + iteration |
| 13 | Tag `v1.1.0` GA (iOS) + web prod deploy | I12 executed: launch day | Public launch |

**Critical-path dependencies** (block downstream work if late):
- I4 (App Store SKUs) blocks Epic D US-D1.
- I2 (Supabase prod) blocks Epic E and Epic G.
- I1 (Mapbox token) blocks Epic G US-G1 and Epic H1–H4.
- ~~I3 (domain)~~ deferred to v1.2 — privacy URL hosted on Notion in the meantime.

**Parallelization rules:**
- iOS engineering and web engineering do NOT share a developer day-to-day; weeks 7–10 are dedicated web-only sprints once iOS is feature-complete (week 6).
- Operational work (Epic I) is 1–2 hours per day from week 0, mostly waiting on external reviews, not blocking engineering throughput.

---

## 11. Appendix — Files Touched (estimated)

### iOS new (~25)
- `apps/ios/SoloCompass/Persistence/SoloCompassModelContainer.swift`
- `apps/ios/SoloCompass/Persistence/Models/*.swift` (~13 `@Model` classes)
- `apps/ios/SoloCompass/Persistence/ExperienceRepository.swift`
- `apps/ios/SoloCompass/Services/SyncService.swift`
- `apps/ios/SoloCompass/Services/SubscriptionService.swift`
- `apps/ios/SoloCompass/Services/ReverseGeocodeService.swift`
- `apps/ios/SoloCompass/Services/SupabaseClient.swift`
- `apps/ios/SoloCompass/Views/Paywall/PaywallView.swift`
- `apps/ios/SoloCompass/Views/Onboarding/ExploreConsentSheet.swift`
- `apps/ios/SoloCompass/Resources/zh-Hans.lproj/Localizable.strings`
- `apps/ios/SoloCompass/Resources/Configuration.storekit`
- `apps/ios/SoloCompass/Resources/PrivacyInfo.xcprivacy`

### iOS modified (~12)
- `Services/AIService.swift` — model config + cache + Edge Function call
- `Services/OverpassService.swift` — cache integration
- `Services/ExperienceService.swift` — repo facade
- `ViewModels/MapViewModel.swift` — entitlement gates + auto city switch + deep-link routing
- `ViewModels/ExperienceDetailViewModel.swift` — survey writeback
- `Views/Map/CompassMapView.swift` — paywall sheet, banner upgrades
- `Views/Map/MarkerIconView.swift` — confidence-1 visual downgrade
- `Views/Experience/ExperienceDetailView.swift` — paywall teaser, source link
- `Models/UserPreferences.swift` — quota fields, consent flags, trip prompts
- `App/SoloCompassApp.swift` — ModelContainer, SubscriptionService, URL handler
- `project.yml` — capabilities (in-app purchase, Supabase, Sign-in-with-Apple, Associated Domains, URL types)
- `packages/core/src/experience.ts` — schema parity

### Web new (~22)
- `apps/web/src/app/[locale]/[city]/page.tsx` — Scenario D
- `apps/web/src/app/[locale]/experience/[id]/page.tsx` — Scenario D
- `apps/web/src/app/[locale]/experience/[id]/opengraph-image.tsx` — relocated under locale
- `apps/web/src/app/[locale]/trip/[slug]/page.tsx` — Scenario C
- `apps/web/src/app/[locale]/trip/[slug]/opengraph-image.tsx` — relocated under locale
- `apps/web/src/app/[locale]/research/page.tsx` — Scenario A
- `apps/web/src/app/[locale]/privacy/page.tsx`
- `apps/web/src/app/[locale]/terms/page.tsx`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/api/revalidate/route.ts`
- `apps/web/src/components/ui/*.tsx` — shared shadcn primitives
- `apps/web/src/components/research/*.tsx` — pinboard, compare modal
- `apps/web/src/components/trip/*.tsx` — recap card, share sheet
- `apps/web/src/lib/i18n/{en,zh}.json`
- `apps/web/src/lib/i18n/use-translation.ts`
- `apps/web/src/lib/share.ts`
- `apps/web/public/.well-known/apple-app-site-association`
- `apps/web/tests/e2e/*.spec.ts` — Playwright suite
- `apps/web/.env.local.example`

### Web modified (~10)
- `apps/web/README.md` — status header from Foundation to Production target
- `apps/web/src/app/page.tsx` — redirect to locale-aware route
- `apps/web/src/app/layout.tsx` — i18n + canonical/hreflang
- `apps/web/src/app/api/experiences/nearby/route.ts` — accept categories + hour params
- `apps/web/src/components/MapView.tsx` — real Mapbox style + warm palette
- `apps/web/src/components/lisbon/WebLisbonMap.tsx` — replaced with real Mapbox
- `apps/web/src/lib/env.ts` — extended schema
- `apps/web/src/lib/repos.ts` — trips repo added
- `apps/web/tailwind.config.ts` — warm palette tokens
- `apps/web/next.config.ts` — i18n + image domains

### Infra new (~6)
- `infra/supabase/migrations/0001_init.sql` — full schema
- `infra/supabase/migrations/0002_trips_cities.sql` — trips + cities tables
- `infra/supabase/functions/synthesize-experiences/index.ts`
- `infra/supabase/functions/aggregate-solo-scores/index.ts`
- `infra/supabase/functions/create-trip/index.ts`
- `infra/supabase/functions/weekly-cost-report/index.ts`

### Docs new (~10)
- `docs/APP_STORE.md`, `docs/BETA.md`, `docs/PRIVACY.md`, `docs/SUPPORT.md`
- `docs/WEB_OPS.md` — Mapbox / Vercel / domain operations
- `docs/WEB_ANALYTICS.md` — PostHog funnel queries
- `docs/RUNBOOK.md` — GA cutover
- `docs/LAUNCH.md` — announcement copy
- `docs/launch-assets/` — demo video + screenshots
- `docs/CHANGELOG.md` updated for v1.1.0

### CI new
- `.github/workflows/web-ci.yml`

---

---

## 12. Pre-Launch Operational Readiness — What @cubxxw Needs to Prepare

> **Why this section exists:** Engineering can't ship without external accounts, domains, and reviews that have their own clocks. This is your week-by-week prep list. It is also encoded as Epic I user-stories above, but here we list the practical steps in chronological order so you don't lose them.

### Week 0 (this week — start NOW)

**Time-sensitive (have multi-day external review):**

1. **Mapbox account + production token** *(US-I1)*
   - Sign up at https://account.mapbox.com (free tier covers 50k loads/month).
   - Create two access tokens: `production` (URL-restrict to `*.vercel.app`), `development` (no restriction). Tighten to a real domain in v1.2.
   - Save both in 1Password under "Solo Compass / Mapbox".
   - **Why now:** any web work after week 7 needs this; if you start in week 7 you'll waste a day waiting on email verification + studio onboarding.

2. **Supabase production project** *(US-I2)*
   - Create project `solo-compass-prod` in Singapore (`ap-southeast-1`).
   - Save URL, anon key, service-role key in 1Password.
   - Enable PITR (Pro plan, $25/month — pay it; restoring without PITR is impossible).
   - **Why now:** Epic E (week 5) blocks on this. Setup is 30 minutes but provisioning the DB takes ~10 minutes and Pro plan upgrade requires a card.

3. **Domain registration — DEFERRED to v1.2** *(US-I3)*
   - Decision (2026-05-09): no custom domain in v1.0. Web ships on Vercel's default `*.vercel.app` URL.
   - Action this week instead: pick a Vercel project name → confirm the resulting `solo-compass.vercel.app`-style URL is available; set up Gmail alias `solocompass.support@gmail.com` for App Store + customer support; create a Notion-hosted privacy policy URL placeholder.
   - **Trade-offs accepted:** Universal Links (US-H11) drop to v1.2; SEO ranking is weaker on a Vercel subdomain; Mapbox token uses broader `*.vercel.app` lock; emails come from a generic Gmail.
   - **Migration path:** when a real domain is registered later, only env vars + AASA file + Mapbox token lock + email forwarder change. No code refactor required.

4. **Apple Developer Program + App Store Connect** *(US-I4)*
   - Confirm enrollment is active ($99/year).
   - Create App Store Connect app entry for `com.solocompass.app`.
   - Create In-App Purchase SKUs: `com.solocompass.pro.monthly` (price tier 2), `com.solocompass.pro.yearly` (price tier 11). Submit them — they need ~24h review.
   - **Why now:** SKU review is a hard 24–48h external dependency. If you skip this in week 0, Epic D (week 4) is blocked.

**Estimated week 0 time investment:** 4–6 hours total, mostly waiting on emails.

---

### Weeks 1–6: Background ops while iOS engineering happens

5. **Privacy policy + terms of service** *(US-I5)*
   - Use Termly or Iubenda free tier ($0–$30/year).
   - Cover: location data, device ID, purchases, Anthropic processing, Mapbox/Sentry/PostHog, retention windows, deletion process, third-party links.
   - Host them on `apps/web` once Epic G lands; until then, link to a placeholder Notion page from `Info.plist`.
   - **Deadline:** must be live before TestFlight beta.1 (week 11).

6. **Anthropic production key + spend caps** *(US-I6)*
   - Anthropic Console → create production workspace → new key.
   - Set monthly spend cap: $200 hard, $50 soft alert (email).
   - Enable prompt caching on the synthesis prompt (saves 50–80% on repeated calls).
   - **Deadline:** before Epic E US-E4 lands (week 5).

7. **Sentry + PostHog production projects** *(US-I7)*
   - Sentry: separate projects for web (Next.js) and iOS (Apple).
   - PostHog: one project, both surfaces report into it.
   - Set Sentry alert: > 10 unique errors/hour → email.
   - **Deadline:** before web work begins (week 7).

8. **Customer support inbox + reply templates** *(US-I8)*
   - HelpScout free trial OR Notion shared inbox.
   - Draft replies for: subscription cancellation, refund decline (AI quota), AI-was-wrong reports, restore-purchase failure, account deletion (GDPR).
   - **Deadline:** before beta tester invitations (week 11).

---

### Weeks 7–10: Web engineering + final ops

9. **Beta tester recruitment** *(US-I9)*
   - List 20+ named testers in `docs/BETA.md`. Mix: en/zh primary, abroad/local, casual/power users.
   - Send TestFlight invitations on `v1.1.0-beta.1` upload (week 11).

10. **Cost dashboard automation** *(US-I10)*
    - Supabase scheduled function emits weekly Markdown report.
    - First report manually generated before beta.1 to set baseline.

---

### Weeks 11–13: Launch sequence

11. **Launch announcement materials** *(US-I11)*
    - Product Hunt description, Twitter thread, 小红书 post, V2EX post, 30-second demo video.
    - All drafted by week 11 end; reviewed by trusted reader.
    - Schedule Product Hunt launch for a Tuesday (best traffic).

12. **GA cutover runbook** *(US-I12)*
    - `docs/RUNBOOK.md`: pre-flight check, launch-day steps, rollback procedure, contact tree.
    - Walk through it manually once before launch day.

---

### Money you should expect to spend in 13 weeks

| Item | Cost | When |
|---|---|---|
| Domain | $0 (deferred to v1.2) | — |
| Apple Developer Program (already paid?) | $99/yr | Verify week 0 |
| Supabase Pro (PITR) | $25/mo × 4 = $100 | Week 0–13 |
| Mapbox | $0 (free tier) | — |
| Vercel | $0 (Hobby tier sufficient until > 100GB bandwidth) | — |
| Cloudflare DNS + Email | $0 | — |
| Anthropic during beta | ~$50 | Week 5–11 (mostly internal testing) |
| Anthropic post-launch | $50–200/mo | Week 11+ |
| Sentry free tier | $0 (until 10k errors/mo) | — |
| PostHog free tier | $0 (until 1M events/mo) | — |
| Privacy policy generator | $30 | Week 1 |
| **Total committed before GA** | **~$200** | — |
| **Recurring after GA** | **~$75–225/month** | — |

You should expect to **lose money for 6+ months** — pre-launch burn ~$200, ongoing ~$150/month, against ~$1.70 monthly subscription revenue per user. Break-even depends on getting yearly subscriptions ($14.99) plus achieving > 50% AI cache hit rate. Plan for ¥10,000–20,000 of float.

---

### Decision points where I'll bug you

These are the things I genuinely can't decide for you:

- **Week 0:** ~~Domain registration~~ DECIDED 2026-05-09: no custom domain in v1.0; ship on `*.vercel.app`. Universal Links + custom email + AASA all deferred to v1.2.
- **Week 1:** Use Termly free + manual edits, or pay Iubenda $9/month for a hosted policy that auto-updates?
- **Week 4:** Want to manually approve the App Store metadata copy, or trust me to draft + submit?
- **Week 11:** Beta tester list — do you have 20 names, or should I draft a recruitment Tweet/post for you to send?
- **Week 13:** Launch day — Product Hunt + 小红书 + V2EX simultaneously, or stagger over 3 days?

I'll surface these as decisions when we hit each week.

---

*End of PRD. Implementation starts on `feat/persistence-swiftdata` after PRD approval. Operational work in Epic I starts THIS WEEK in parallel — see Section 12 above.*
