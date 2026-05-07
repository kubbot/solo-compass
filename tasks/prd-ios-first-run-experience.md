# PRD: iOS First-Run Experience & Phase-3 Native Capabilities

**Status:** Draft
**Owner:** TBD
**Linked Umbrella Issue:** [#56](https://github.com/getyak/solo-compass/issues/56)
**Linked Sub-Issues:** #57, #58, #59, #60, #61, #62, #63
**Last Updated:** 2026-05-07

---

## 1. Introduction / Overview

The current iOS app (`apps/ios/SoloCompass/`) is functionally broken for any user not physically standing in Chiang Mai:

- The map camera initializes to a hardcoded Chiang Mai coordinate and never auto-recenters when GPS resolves
- The bundled seed contains 5 Chiang Mai experiences and the radius filter is 5km, so non-Chiang-Mai users see zero markers
- Permission for location is requested but the app never reacts when the user grants it
- `UserPreferences` exposes `dislikedCategories`, `soloTravelStyle`, `maxDistanceKm`, `pendingCheckIns`, `favoritedExperiences` — none of which have any UI
- The original strategic reason iOS exists (background location wake-up + push notifications) is not implemented; the app is currently a "web app inside a native shell"

This PRD defines the work to make iOS the **real product** — a solo-traveler companion that works on first launch, anywhere on earth, with content fetched from a real backend, and with the OS-level background awareness that justifies its existence as a native app.

This is a large body of work spanning iOS, backend, and database. It is split into 7 phases that can be merged independently.

---

## 2. Goals

- A new user installing the app anywhere on earth sees relevant content within 5 seconds of granting location permission
- The map camera follows the user's actual location on first GPS fix; never silently lands on a hardcoded city the user did not choose
- All persisted preferences (`distance`, `categories`, `style`, `favorites`, `check-ins`) are reachable and editable through the UI
- Experience data is served from a remote backend with PostGIS-backed geo queries; the app no longer depends on a bundled JSON seed
- A killed/backgrounded app wakes via geofence enter events and surfaces a local push notification within 30 seconds of the user entering a 200m radius around an experience
- App Store privacy nutrition label accurately reflects background location use, with a transparent in-app explanation
- The app survives the "30-second comprehension test" (PHASES.md gate Phase 1 → Phase 2): 8/10 testers can articulate what the product does after 30 seconds

---

## 3. User Stories

### US-001: Camera follows user on first GPS fix

**Description:** As a user opening the app for the first time, I want the map to center on my actual location after I grant permission, so I'm not staring at a city I'm not in.

**Acceptance Criteria:**
- [ ] `MapViewModel` exposes `bindToLocation()` that recenters the camera once on the first non-nil `currentLocation`
- [ ] `bindToLocation()` is idempotent (subsequent calls no-op via `hasAutoCentered` flag)
- [ ] `CompassMapView` invokes `bindToLocation()` via `.onChange(of: locationService.currentLocation)`
- [ ] `loadNearbyExperiences()` re-runs after recenter
- [ ] Unit test in `SoloCompassTests` covers idempotency and recenter behavior
- [ ] Manual: launch on simulator with custom location set to Lisbon → grant permission → camera flies to Lisbon within 2s
- [ ] Verify in iPhone 16 Pro simulator (default per CLAUDE.md)

### US-002: Mandatory onboarding gates the map

**Description:** As a first-time user, I'm walked through a 3-step setup (welcome → permission → city/style) before I see the map, so I never land on a confusing default state.

**Acceptance Criteria:**
- [ ] New view: `Views/Onboarding/OnboardingView.swift`
- [ ] `UserPreferences.Snapshot` adds `hasCompletedOnboarding: Bool` (default `false`, migrates safely)
- [ ] Presented as `.fullScreenCover` from `CompassMapView` while `!preferences.hasCompletedOnboarding`
- [ ] Step 1: Welcome screen with one-line value prop + "Continue"
- [ ] Step 2: Location permission request — user **must** either grant or explicitly choose "Skip and pick a city manually" (no implicit dismiss)
- [ ] Step 3: City confirmation (auto-detected from GPS) or manual city picker, then optional `SoloTravelStyle` chip selection
- [ ] On completion, `hasCompletedOnboarding = true` is persisted
- [ ] Onboarding never shows again after completion (verified by wiping and re-running)
- [ ] Verify in iPhone 16 Pro simulator

### US-003: City switcher and persistent city context

**Description:** As a traveler, I want to browse a city before I'm physically there, and switch between cities I'm interested in.

**Acceptance Criteria:**
- [ ] Top-left of map shows pill button "{currentCity} ▾"
- [ ] Tap → bottom sheet listing all cities available from backend (see US-008)
- [ ] Selecting a city: recenters camera to city center + filters `experienceService` by `cityCode`
- [ ] Selection persists in `preferences.lastSelectedCityCode`
- [ ] On app launch, restores last selected city (overrides GPS auto-locate if user manually picked)
- [ ] City list shows: name (localized), country flag emoji, experience count
- [ ] Unit test: switching city updates camera + filtered experiences
- [ ] Verify in iPhone 16 Pro simulator

### US-004: Settings page

**Description:** As a user, I want to control my discovery preferences (distance, categories, travel style) and reset my data, without needing to reinstall the app.

**Acceptance Criteria:**
- [ ] New view: `Views/Settings/SettingsView.swift`, presented as a sheet
- [ ] Reachable from a gear icon in the top-right of the map (≤2 taps)
- [ ] Section "Discovery": distance slider (1/3/5/10/25/50 km snap), travel style picker
- [ ] Section "Categories": multi-select chips for `preferredCategories` and `dislikedCategories`
- [ ] Section "My data": favorites count (tap → US-006), completed count, "Clear all data" with confirm dialog
- [ ] Section "About": app version, build number, links to Privacy/Terms (placeholder)
- [ ] All changes immediately re-trigger `loadNearbyExperiences()`
- [ ] Unit test: setting changes persist + trigger reload
- [ ] Verify in iPhone 16 Pro simulator

### US-005: Empty-state with actions

**Description:** As a user in a city with no nearby experiences, I want clear next-step actions instead of a dead-end "no results" message.

**Acceptance Criteria:**
- [ ] Empty-state overlay in `CompassMapView` replaces text-only with action buttons
- [ ] Button "Expand to 25km" → updates `preferences.maxDistanceKm = 25` and reloads
- [ ] Button "Browse {nearestSeededCity}" → recenters to nearest city with content
- [ ] Button "Switch city" → opens picker from US-003
- [ ] Empty-state copy localized via `NSLocalizedString`
- [ ] Verify in iPhone 16 Pro simulator with simulated location in Antarctica

### US-006: Favorites list

**Description:** As a user, I want to see everything I've favorited in one list, sorted newest first.

**Acceptance Criteria:**
- [ ] New view: `Views/Favorites/FavoritesListView.swift`
- [ ] Reachable from Settings (US-004) and from a heart icon on the map
- [ ] `UserPreferences.Snapshot` adds `favoritedAt: [String: Date]` for sort order
- [ ] Migration: existing `favoritedExperiences` entries default to `Date.distantPast`
- [ ] Tap row → opens existing `ExperienceDetailView`
- [ ] Empty state: "No favorites yet — tap the heart on any experience to save it"
- [ ] Unit test: toggling favorite updates both `favoritedExperiences` and `favoritedAt`
- [ ] Verify in iPhone 16 Pro simulator

### US-007: Check-in inbox

**Description:** As a user who walked into an experience's geofence, I want a non-intrusive way to confirm "I did this" later.

**Acceptance Criteria:**
- [ ] Badge on map (top-right, near compass) shows `pendingCheckIns.count` when > 0
- [ ] Tap → bottom sheet listing pending visits with timestamp ("Wat Suan Dok — 2h ago")
- [ ] Each row: "Mark as done" (calls `markCompleted` + `clearPendingCheckIn`) or "Dismiss" (clears only)
- [ ] On app launch, auto-clear entries older than 7 days
- [ ] Unit test: 8-day-old entry is cleared on init
- [ ] Verify in iPhone 16 Pro simulator (use developer menu → simulate region entry)

### US-008: Backend API for experiences

**Description:** As the iOS app, I need a remote API to fetch experiences by city + bounding box, so I'm not bound to a 5-experience JSON seed.

**Acceptance Criteria:**
- [ ] New service deployed (Vercel or Fly.io, decision in Open Questions)
- [ ] `GET /v1/cities` → list of `{ code, name, country, center: [lon,lat], experienceCount }`
- [ ] `GET /v1/experiences?cityCode={code}` → all experiences for a city
- [ ] `GET /v1/experiences?bbox={minLon,minLat,maxLon,maxLat}&limit=50` → bounding-box query
- [ ] `GET /v1/experiences/{id}` → single experience full detail
- [ ] All responses match `packages/core/src/experience.ts` schema (TS↔Swift parity guard already exists in CI)
- [ ] OpenAPI spec checked into `packages/api/openapi.yaml`
- [ ] Versioned at `/v1/`; breaking changes go to `/v2/`
- [ ] Cache headers: 60s on lists, 5min on individual experiences
- [ ] CORS allows app's bundle id only (not `*`)

### US-009: PostgreSQL + PostGIS schema

**Description:** As a backend engineer, I need a real database with geo indexes to serve experiences efficiently.

**Acceptance Criteria:**
- [ ] New package `packages/db` with Drizzle ORM + Postgres
- [ ] PostGIS extension enabled
- [ ] Schema includes tables: `experiences`, `cities`, `experience_sources`, `experience_inconveniences`, `experience_best_times`
- [ ] `experiences.location` is a PostGIS `geography(POINT, 4326)` column with GIST index
- [ ] Migration scripts versioned in `packages/db/migrations/`
- [ ] Seed loader (`scripts/seed-load.ts`) updated to insert into the database, not generate JSON
- [ ] Local dev: `docker-compose.yml` brings up Postgres + PostGIS
- [ ] Production: managed Postgres (Neon / Supabase / Fly.io Postgres — decision in Open Questions)
- [ ] Backup policy documented
- [ ] Schema parity test extended: TS types ↔ Swift types ↔ DB schema all aligned

### US-010: iOS RemoteExperienceService

**Description:** As the iOS app, I want to fetch from the backend with offline fallback to bundled seed.

**Acceptance Criteria:**
- [ ] New file: `Services/RemoteExperienceService.swift` (replaces or wraps `ExperienceService`)
- [ ] Async methods: `fetchCities()`, `fetchExperiences(cityCode:)`, `fetchExperiences(bbox:)`, `fetchExperience(id:)`
- [ ] Uses `URLSession` with 10s timeout
- [ ] Caches responses in `URLCache` (default in-memory + on-disk)
- [ ] On network failure: fall back to bundled `seed_experiences.json` for graceful degradation
- [ ] Error surfaced to UI via `lastError` (existing `AIService.lastError` pattern)
- [ ] Unit test: mock `URLSession` covers success, 404, network error, fallback
- [ ] Integration test: real call against staging backend in CI (gated by env var)

### US-011: Background location authorization (always)

**Description:** As a user opting in, I want the app to wake when I walk near a saved experience, even if I haven't opened it.

**Acceptance Criteria:**
- [ ] `apps/ios/project.yml` adds `NSLocationAlwaysAndWhenInUseUsageDescription` info property
- [ ] `apps/ios/project.yml` adds `UIBackgroundModes: ["location"]`
- [ ] `LocationService.requestAlwaysPermission()` follows Apple's two-step pattern (WhenInUse first, then Always)
- [ ] `manager.allowsBackgroundLocationUpdates = true` set after Always granted
- [ ] `manager.pausesLocationUpdatesAutomatically = true`
- [ ] Settings page (US-004) shows current state: "Background location: ON/OFF" with toggle linking to system Settings
- [ ] App functions identically when user denies Always (graceful WhenInUse degradation — no broken features, just no background wake-up)
- [ ] App Store privacy nutrition label updated

### US-012: Local push notification on geofence enter

**Description:** As a user with background location enabled, I want a gentle notification when I'm near an experience, with quiet-hours respect.

**Acceptance Criteria:**
- [ ] `apps/ios/project.yml` enables Push Notifications capability
- [ ] `UNUserNotificationCenter.requestAuthorization` flow integrated into onboarding (US-002) as optional step
- [ ] On `didEnterRegion`, schedule a local notification: "{Experience title} is right here. Want to check it out?"
- [ ] Tapping notification deep-links to `ExperienceDetailView` for that experience
- [ ] `UserPreferences.Snapshot` adds `quietHours: { start: Int, end: Int }?` (defaults nil = no quiet hours)
- [ ] During quiet hours, write to `pendingCheckIns` but skip notification
- [ ] No remote push (APNs server) needed for MVP — local only
- [ ] Manual test: kill app → walk into geofenced region (simulator GPX trace) → notification fires → tap → app opens to detail

### US-013: Privacy & App Store readiness

**Description:** As a release manager, I need the app to satisfy App Store privacy and review requirements before background location ships.

**Acceptance Criteria:**
- [ ] Privacy nutrition label updated in App Store Connect: declares precise location collection, both foreground and background, no third-party sharing
- [ ] In-app privacy explainer screen (linked from Settings → About → Privacy)
- [ ] Background location is **opt-in only**, asked **after** user has used the app in foreground at least once
- [ ] Settings shows clear off-switch
- [ ] Never log raw GPS coordinates to disk or analytics
- [ ] Geofence enter/exit only persists experience IDs, not coordinates
- [ ] Battery-impact test: 24h on a real device with 20 monitored regions, document drain percentage

---

## 4. Functional Requirements

### iOS App

- **FR-1:** `MapViewModel.bindToLocation()` runs on first non-nil `currentLocation` and recenters camera + reloads experiences (idempotent)
- **FR-2:** Default `cameraPosition` no longer hardcodes Chiang Mai; falls back to `preferences.lastSelectedCityCode → city.center` or to a global "world" view if no preference exists
- **FR-3:** `OnboardingView` is presented as `.fullScreenCover` until `preferences.hasCompletedOnboarding == true`
- **FR-4:** City switcher pill is present in the top bar of `CompassMapView`; tapping it opens a `CityPickerSheet`
- **FR-5:** `SettingsView` is reachable from a gear icon in ≤2 taps and exposes all `UserPreferences` fields
- **FR-6:** `FavoritesListView` and `CheckInInboxView` are reachable from Settings
- **FR-7:** Empty-state overlay shows "Expand radius / Browse featured / Switch city" actions when `visibleExperiences.isEmpty`
- **FR-8:** When `LocationService` enters a geofenced region, it (a) records to `pendingCheckIns`, (b) fires a local notification (if Always permission granted and not in quiet hours)
- **FR-9:** Tapping a notification deep-links to the corresponding `ExperienceDetailView`
- **FR-10:** `RemoteExperienceService` fetches from backend with bundled-seed fallback on network failure

### Backend

- **FR-11:** `GET /v1/cities` returns array of `City` records sourced from `cities` table
- **FR-12:** `GET /v1/experiences?cityCode={code}` returns all experiences for a city
- **FR-13:** `GET /v1/experiences?bbox={...}` returns experiences whose location intersects the bbox, limited to 50 results, ordered by `confidence.level DESC, soloScore.overall DESC`
- **FR-14:** `GET /v1/experiences/{id}` returns a single experience with all nested relations
- **FR-15:** Responses validate against shared `Experience` schema (`packages/core/src/experience.ts`)
- **FR-16:** Cache headers per spec: 60s for lists, 5min for individual records
- **FR-17:** CORS restricted to iOS bundle ID and the `apps/web` domain

### Database

- **FR-18:** `experiences.location` uses `geography(POINT, 4326)` with GIST index
- **FR-19:** All migrations are forward-only, versioned, and reproducible from scratch
- **FR-20:** Seed loader inserts into DB, not JSON

---

## 5. Non-Goals (Out of Scope)

- **No social features** (no friend lists, no shared favorites, no leaderboards, no public activity feed)
- **No user-generated experience approval flow** for this PRD — candidates added via long-press stay local-only until a separate moderation pipeline exists
- **No remote push (APNs server)** — only local notifications triggered by geofence
- **No multi-language UI translation** beyond the existing `en.lproj` — Localizable.strings keys must exist, but additional language files are deferred
- **No Android port** — explicitly out of scope; this is iOS + backend only
- **No real-time "other solo travelers nearby"** beyond the existing aggregated `nearbySoloCount` heuristic
- **No AI-powered city recommendations** — city list is static from DB
- **No payment / subscription / premium tier**

---

## 6. Design Considerations

### UI/UX

- Onboarding follows iOS HIG: full-screen, paginated, never modal-on-modal
- City switcher uses native iOS bottom-sheet detent (`.medium` then `.large`)
- Settings page uses `Form` with grouped sections (matches iOS Settings.app aesthetic)
- Empty-state overlay uses `.ultraThinMaterial` background (consistent with existing `map.empty` overlay)
- Local notifications use system default sound; no custom assets
- Background location explainer uses the privacy posture from `docs/PRODUCT_BRIEF.md` verbatim

### Reuse

- `MarkerIconView` and `BottomInfoBar` unchanged
- `ExperienceDetailView` reused as the destination for favorites tap, check-in inbox, and notification deep-link
- `VoiceButton` and AI flow unchanged in this PRD
- Existing `Localizable.strings` extended with new keys, never replaced

### Visual hierarchy on the map

- Top-left: city switcher pill
- Top-right: gear icon (Settings) + check-in badge (when count > 0)
- Bottom: filter bar → bottom info bar → voice button (existing layout preserved)

---

## 7. Technical Considerations

### Backend platform decision (deferred to Open Questions)

Candidates: Vercel (serverless), Fly.io (containers), Supabase (BaaS with built-in PostGIS).
Recommendation pending: **Supabase** for fastest path (managed Postgres + PostGIS + auth-ready + edge functions).

### Database choice

- Postgres + PostGIS is non-negotiable (geo queries need GIST index on geography columns)
- Local dev via `docker-compose`
- Schema managed by Drizzle (TypeScript-first, plays well with monorepo)

### Schema parity

- Existing `pnpm parity:check` (commit `7342eb3`) validates TS ↔ Swift schema match
- Extend to also check DB schema matches TS schema (Drizzle → TS types → diff against `packages/core`)

### iOS networking

- `URLSession` with default `URLCache` — no Alamofire (zero third-party deps per CLAUDE.md)
- Bearer-token auth deferred (no user accounts in this PRD)
- API base URL configurable via `Secrets.plist` key `API_BASE_URL` with fallback to a hardcoded production URL

### Background location & battery

- Use `CLCircularRegion` for geofencing (already in `LocationService`) — does not drain battery like continuous tracking
- Cap monitored regions at iOS limit of 20 (already enforced)
- Pause location updates automatically when stationary
- Defer `startUpdatingLocation` until user explicitly opts into "live position" feature (not in this PRD)

### Migration safety

- All `UserPreferences.Snapshot` additions use `decodeIfPresent` with sane defaults (existing pattern)
- New keys: `hasCompletedOnboarding`, `lastSelectedCityCode`, `favoritedAt`, `quietHours`
- Old installs upgrade silently

### Testing

- Unit tests: `MapViewModel`, `LocationService`, `RemoteExperienceService`, `UserPreferences` migrations
- Snapshot tests: `OnboardingView` per step, `SettingsView`, `CityPickerSheet`, `FavoritesListView`, `CheckInInboxView`
- Integration: backend API contract tests via Vitest in `packages/api`
- Manual: simulator GPX traces for geofence wake-up scenarios

---

## 8. Success Metrics

- **First-run completion rate ≥ 80%** — % of new installs that finish onboarding and reach the map
- **First-meaningful-paint < 5s** — from app open to first marker visible (cold launch + permission grant)
- **Zero "Chiang Mai surprise"** — no production analytics event where a user lands on Chiang Mai map without explicitly choosing it
- **Background notification delivery > 90%** — % of geofence enters that fire a notification within 30s (measured via dogfood test on real devices)
- **App Store rejection count = 0** — privacy review passes on first submission
- **30-second comprehension test ≥ 8/10** — per PHASES.md gate (testers can articulate what the product does)
- **Battery drain < 5%/24h** — with 20 monitored regions, real device, normal use

---

## 9. Open Questions

1. **Backend platform**: Supabase vs Fly.io vs Vercel? Recommend Supabase for managed PostGIS + speed-to-deploy. Decision needed before US-008/009 start.
2. **Auth model**: Anonymous device IDs only? Or anonymous accounts upgradeable to email later? This PRD assumes anonymous-only; revisit before US-008.
3. **Seed data privacy**: Original CLAUDE.md mandated "seeds live in a private repo." With remote DB, what's the new boundary — public schema + private content? Document in `docs/PRODUCT_BRIEF.md` once decided.
4. **City coverage at launch**: Which cities ship with seeded content? Chiang Mai is current. Need a list and curation owner.
5. **Notification copy & frequency cap**: Should we cap to N notifications per day to avoid being spammy? Recommend 3/day max with a 1-hour cooldown per experience.
6. **Onboarding skip path**: If user denies location at onboarding step 2, do we still let them in? (Currently this PRD says yes — they go to manual city picker. Confirm.)
7. **Schema field for `favoritedAt`**: Should this also live server-side for cross-device sync, or strictly local? This PRD assumes local-only since there's no auth yet.
8. **Localization rollout**: Which languages first when we expand beyond `en`? (zh-Hans likely first given target user base?)

---

## 10. Suggested Phasing (mapped to issues)

| Phase | Scope | Issues | Estimated effort |
|---|---|---|---|
| 1 | Camera follow + onboarding skeleton | #57, parts of #60 | 1 week |
| 2 | City switcher + empty-state actions | #58, #59 | 1 week |
| 3 | Settings + Favorites + Check-in inbox | #61, #62 | 1.5 weeks |
| 4 | Backend + DB foundation | #56 → spawns new backend issues | 2 weeks |
| 5 | iOS RemoteExperienceService + migration off bundled seed | (extends #59) | 1 week |
| 6 | Background location (Always) + push | #63 | 1.5 weeks |
| 7 | Privacy hardening + App Store submission | #63 acceptance | 0.5 week |

**Total: ~8.5 weeks** for a single full-time engineer. Parallel iOS + backend work can compress this to ~6 weeks.

---

## 11. Risks

- **Background location is the #1 App Store rejection trigger** — privacy explainer and opt-in flow must be airtight
- **PostGIS managed-hosting cost** — Supabase free tier limits geo queries; budget for paid tier from day 1
- **Schema drift** — three sources of truth (TS / Swift / DB) means parity check must extend to DB or we'll have silent breakage
- **Geofence reliability** — iOS geofence wake-up has known flakiness; 90% delivery target may need adjustment after real-device testing
- **Onboarding abandonment** — making onboarding mandatory (option 2B) risks losing users who hate setup flows; monitor completion metric closely

---

## 12. References

- Umbrella issue: [#56](https://github.com/getyak/solo-compass/issues/56)
- Sub-issues: [#57](https://github.com/getyak/solo-compass/issues/57), [#58](https://github.com/getyak/solo-compass/issues/58), [#59](https://github.com/getyak/solo-compass/issues/59), [#60](https://github.com/getyak/solo-compass/issues/60), [#61](https://github.com/getyak/solo-compass/issues/61), [#62](https://github.com/getyak/solo-compass/issues/62), [#63](https://github.com/getyak/solo-compass/issues/63)
- Project conventions: `CLAUDE.md`
- Product brief & phases: `docs/PRODUCT_BRIEF.md`, `docs/PHASES.md`
- Schema: `packages/core/src/experience.ts`
