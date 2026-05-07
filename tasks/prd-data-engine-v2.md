# PRD v2: Solo Compass Data Engine — AI Compilation, Cross-Verification, Editorial, User Signals

**Status:** Draft (supersedes data-related portions of v1)
**Owner:** TBD
**Linked Umbrella Issue:** [#56](https://github.com/getyak/solo-compass/issues/56) — to be re-scoped or replaced
**Predecessor:** `tasks/prd-ios-first-run-experience.md` (iOS frontend portions remain valid; data layer is replaced by this doc)
**Last Updated:** 2026-05-07

---

## 0. Reading Order

This is a long PRD because the product is large. Read in this order:

1. §1 Why this exists — what changed from v1
2. §2 Architecture — the three-leg model
3. §3 Data flow — how a single Experience is born
4. §6 User Stories — the 24 deliverables
5. §11 Phasing — how this rolls out over 6 months

Skim §4–§10 on first read; refer back when implementing.

---

## 1. Why This Exists

### 1.1 What changed from v1

PRD v1 assumed a curated seed dataset would expand city-by-city through human curation, with iOS shipping a backend-fed catalog. After product-strategy review, two facts forced a rewrite:

1. **Curated single-city seeds cannot satisfy the value prop**. A user in Lisbon who opens the app deserves Lisbon content on day one. Waiting for a curator to visit Lisbon is not a product — it is a hobby.
2. **Pure AI generation cannot satisfy the quality bar**. AI cannot answer "is this café comfortable for solo dining?" without grounding signals from real solo travelers. Shipping AI slop kills the product before it has a chance.

The resolution is a **three-leg data engine** that decouples three concerns:

| Concern                                 | Solved by                                        |
| --------------------------------------- | ------------------------------------------------ |
| Coverage (everywhere on earth)          | AI compilation pipeline ingesting public sources |
| Quality (Solo Compass voice + judgment) | Editorial review queue with internal admin app   |
| Differentiation (solo-traveler signal)  | User behavior + micro-survey aggregation         |

No leg works alone. Together they form the product's moat.

### 1.2 What this PRD does NOT replace from v1

The iOS frontend work (US-001 camera follow, US-002 onboarding, US-004 settings, US-006 favorites, US-007 check-in inbox, US-011/012 background location + push) remains valid. v1 §3 stories US-001 through US-007 and US-011 through US-013 are **carried forward unchanged**.

This PRD replaces v1's:

- US-003 (city switcher) — concept of "cities" is demoted from a primary navigation construct to a search facet
- US-008 (backend API) — replaced by US-D08 below with new endpoints
- US-009 (Postgres schema) — extended significantly with sources/evidence/audit tables
- US-010 (RemoteExperienceService) — extended to handle compilation status and confidence tiers

### 1.3 Strategic principles (non-negotiable)

These principles override convenience throughout the PRD. When you face a tradeoff, refer back here:

- **Transparency over magic**: Every Experience surfaces its `confidence.level` and source attribution. We never pretend AI-compiled data is human-verified.
- **Coverage without compromise on voice**: AI rewrites must match Solo Compass voice (sensory detail, no superlatives, "you" not "tourists"). Failed rewrites stay in queue, never auto-publish.
- **User signal beats source signal**: Once `userVerifications >= 5`, user-derived `soloScore` overrides AI-derived `soloScore`. Always.
- **No silent overwrite**: Every change to an Experience is audited. AI re-compilations create a new revision; editors approve a diff, never blind-overwrite.
- **Cost discipline**: AI calls and external APIs cost real money. Every leg has a budget cap and a degradation path.

---

## 2. Architecture: The Three-Leg Data Engine

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  USER opens app at coordinate (lat, lon)                              │
│      │                                                                │
│      ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ iOS RemoteExperienceService                                  │    │
│  │   GET /v1/experiences?lat={}&lon={}&radiusKm={}             │    │
│  │   Returns: existing Experiences (any confidence tier) +     │    │
│  │            triggers async backfill if coverage < threshold  │    │
│  └────────────────────┬─────────────────────────────────────────┘    │
│                       │                                               │
│  ┌────────────────────▼─────────────────────────────────────────┐    │
│  │ COVERAGE GUARD                                               │    │
│  │   if (experiencesNearby < 5 OR oldestStale > 90d):          │    │
│  │      enqueue compilation_job(lat, lon, radiusKm)             │    │
│  │      return whatever we have NOW                            │    │
│  └────────────────────┬─────────────────────────────────────────┘    │
│                       │                                               │
│         ┌─────────────┴──────────────┐                                │
│         │                            │                                │
│  ┌──────▼─────────┐         ┌────────▼─────────────┐                 │
│  │  LEG 1: AI     │         │  LEG 2: EDITORIAL    │                 │
│  │  COMPILATION   │         │  REVIEW QUEUE        │                 │
│  └──────┬─────────┘         └────────▲─────────────┘                 │
│         │                            │                                │
│  ┌──────▼─────────────────────────────────────────────────────┐      │
│  │  Source adapters (extensible)                              │      │
│  │  ├─ Wikivoyage (CC-BY-SA, primary "voice" source)         │      │
│  │  ├─ OpenStreetMap + Overpass (free POI metadata)          │      │
│  │  ├─ Google Places API ($, opening hours, ratings)         │      │
│  │  ├─ [Phase 2] HN + Reddit (via official APIs)             │      │
│  │  ├─ [Phase 2] Substack/Medium RSS                         │      │
│  │  └─ [Phase 2] YouTube transcript                          │      │
│  └──────┬─────────────────────────────────────────────────────┘      │
│         │                                                             │
│  ┌──────▼─────────────────────────────────────────────────────┐      │
│  │  Cross-verification engine                                 │      │
│  │  • Compute evidence weight per source                      │      │
│  │  • Detect contradictions (hours, vibe, status)            │      │
│  │  • Compute initial confidence.level (1-3 max for AI)      │      │
│  │  • Reject if total_weight < 5 OR sources_count < 2        │      │
│  └──────┬─────────────────────────────────────────────────────┘      │
│         │                                                             │
│  ┌──────▼─────────────────────────────────────────────────────┐      │
│  │  AI Compilation (Claude Opus 4.7)                          │      │
│  │  • Match Solo Compass voice (oneLiner, whyItMatters)      │      │
│  │  • Extract bestTimes, howTo, realInconveniences           │      │
│  │  • Initial soloScore (low confidence, all dims = 5)       │      │
│  │  • Status: .aiCompiled, awaiting review                   │      │
│  └──────┬─────────────────────────────────────────────────────┘      │
│         │                                                             │
│         ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  PostgreSQL + PostGIS                                       │     │
│  │  experiences | sources | evidence | revisions | audit_log  │     │
│  └────┬───────────────────────────────────┬────────────────────┘     │
│       │                                   │                           │
│       │                                   ▼                           │
│       │                  ┌─────────────────────────────────┐          │
│       │                  │ apps/admin (Next.js)            │          │
│       │                  │  Editor reviews queue, approves │          │
│       │                  │  diffs, marks .editorVerified   │          │
│       │                  └─────────────────────────────────┘          │
│       │                                                               │
│       ▼                                                               │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  LEG 3: USER SIGNAL AGGREGATION                         │         │
│  │  • Passive: GPS dwell >15min in 200m radius → +1 hit    │         │
│  │  • Active: post-completion 3-question micro-survey      │         │
│  │  • Aggregate: when verifiedUserCount >= 5,              │         │
│  │    user-derived soloScore overrides AI-derived          │         │
│  │  • Auto-bump confidence.level when signals accumulate   │         │
│  └─────────────────────────────────────────────────────────┘         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Confidence tiers (visible in UI)

| Tier | Label                     | Source                                | UI badge                                        |
| ---- | ------------------------- | ------------------------------------- | ----------------------------------------------- |
| 5    | `userVerified`            | ≥5 user surveys agree                 | 🟢 Green ring + "Verified by N solo travelers"  |
| 4    | `editorVerified`          | Editor approved + ≥1 user signal      | 🟢 Green ring                                   |
| 3    | `editorApproved`          | Editor approved, no user signal yet   | 🟢 Green ring + "Recently added"                |
| 2    | `aiCompiled_multiSource`  | ≥3 sources, ≥10 weight, no editor yet | 🟡 Yellow ring + "AI compiled, awaiting review" |
| 1    | `aiCompiled_singleSource` | <3 sources or <10 weight              | 🔴 Red ring + "Speculative — please verify"     |
| 0    | `candidate`               | User-submitted via long-press         | ⚪ Gray dashed ring                             |

**Rule**: tier 1 is **never returned by default** — only when user opts into "Show speculative" in Settings.

---

## 3. Data Flow: Birth of a Single Experience

Walk through one concrete case: a user opens the app in Lisbon, no existing data within 5km.

### 3.1 Trigger

- iOS calls `GET /v1/experiences?lat=38.7223&lon=-9.1393&radiusKm=5`
- Backend returns `[]` (empty) but enqueues a `compilation_job`

### 3.2 Source collection (parallel, with timeouts)

- Wikivoyage Lisbon page → 47 candidate POIs extracted
- OSM Overpass `[amenity=cafe|restaurant|place_of_worship]` within 5km → 312 nodes
- Google Places `nearbysearch` → 60 results (paginated 3x for 180 max)
- **Total candidates after dedup by name+location: ~85**

### 3.3 Per-candidate evidence aggregation

For each candidate, compute:

```
evidence = {
  wikivoyage: { weight: 3, raw: "...", verifiedAt: now },
  osm: { weight: 2, raw: { tags: {...} }, verifiedAt: now },
  google: { weight: 1, raw: { rating: 4.3, ... }, verifiedAt: now }
}
total_weight = 6
sources_count = 3
→ qualifies for AI compilation (>= 5 weight, >= 2 sources)
```

### 3.4 AI compilation (per candidate)

Prompt to Claude Opus 4.7:

```
You are writing for Solo Compass — an app for solo travelers.
Voice: sensory, specific, no superlatives. "You" not "tourists".
Inputs: <evidence JSON for one candidate>
Output: Experience JSON matching schema below.
Constraints:
  - oneLiner ≤ 100 chars, includes a sensory detail
  - whyItMatters: 80-150 words, explains why solo
  - realInconveniences: minimum 2, drawn from evidence
  - soloScore.breakdown: all dims = 5 (placeholder until user signal)
  - soloScore.basedOnCount: 0
  - confidence.level: 2 (multi-source, no editor)
```

### 3.5 Quality gate

- LLM returns invalid JSON → retry once → if fail, reject candidate, log
- LLM returns valid JSON but `oneLiner` mentions "amazing/best/must-see" → reject (voice violation)
- LLM returns valid JSON but `whyItMatters` < 80 words → reject (depth violation)

### 3.6 Persist + enqueue review

- Insert into `experiences` with `status = 'awaiting_review'`, `confidence.level = 2`
- Insert per-source rows into `sources` table linked by `experience_id`
- Insert `evidence_snapshot` row (full raw evidence, for editor reference)
- Push to `editor_queue` topic

### 3.7 User immediately benefits

- When the iOS app polls again 30s later, `GET /v1/experiences?lat=...&lon=...` returns the new tier-2 experiences with yellow rings
- User sees "AI compiled, awaiting editor review" badge — transparent

### 3.8 Editor reviews (within hours)

- Editor opens `apps/admin/queue` → sees the 85 new candidates sorted by potential value (signal weight × population proximity)
- Per candidate: side-by-side view (raw evidence | AI output | editable form)
- Actions: **Approve** (→ tier 3), **Edit & approve** (→ tier 3 with diff stored), **Reject** (→ archived with reason)
- Approved Experiences are immediately served at tier 3

### 3.9 First user visits and completes

- User taps "Mark as done" → micro-survey appears
- 3 questions:
  1. "Did you feel comfortable here alone?" (1-5)
  2. "Did staff or other patrons make you feel out of place?" (1-5, inverted)
  3. "Would you tell a solo friend to come here?" (yes/no/depends)
- Stored in `user_signals` table
- When `verified_user_count >= 5`, recompute `soloScore` from user data, bump tier to 4 → 5

### 3.10 Re-compilation cycle

- Cron job nightly: `SELECT id FROM experiences WHERE last_compiled_at < now() - 90 days`
- For each: re-run §3.2–§3.6, generate diff, push to editor with "REFRESH" label
- Editor compares old vs new, decides if update warranted

---

## 4. Goals

- **Coverage**: A new user in any city of >100k population sees ≥10 experiences within 30 seconds of opening the app, anywhere on earth
- **Voice consistency**: 95% of AI-compiled experiences pass voice audit on first generation (manual sample of 100/month)
- **Editor throughput**: Editorial team can process ≥50 candidates/day without burning out (validated by editor satisfaction survey)
- **Confidence clarity**: 100% of experiences shown to users have visible confidence tier; users can articulate "what does the yellow ring mean" after reading help once
- **User signal flywheel**: By month 6, at least 30% of high-traffic experiences are tier 4+ (user-verified)
- **Cost discipline**: Per-experience marginal cost ≤ $0.50 fully loaded (sources + AI + editor time amortized)
- **Latency**: Compilation job completes within 5 minutes of trigger; user sees new content on next app refresh
- **Data integrity**: Zero silent data loss; every Experience has a complete revision history

---

## 5. Personas

- **Wanderer Wendy** (end user): Solo traveler in Lisbon, opens app, expects to see things tonight
- **Editor Ellis** (internal): Reviews AI candidates 30 min/day, approves or fixes voice/judgment
- **Operator Omar** (internal): Monitors pipeline health, costs, source freshness, abuse signals
- **Trust Officer Toni** (internal, future): Reviews user signal abuse claims, manages reporter reputation

---

## 6. User Stories

### Section A — Source Adapters (Phase 1)

#### US-D01: Wikivoyage source adapter

**Description:** As the data engine, I need to extract candidate POIs from Wikivoyage articles so I have voice-rich primary content.

**Acceptance Criteria:**

- [ ] New package `packages/sources/wikivoyage`
- [ ] `fetchCity(cityName: string): Promise<Candidate[]>` — pulls Wikivoyage article, parses sections (See/Do/Eat/Drink/Sleep)
- [ ] Each Candidate has: `name`, `description`, `location` (geocoded if Wikivoyage gives coords, else null), `source_url`, `extracted_at`
- [ ] Respects CC-BY-SA: stores attribution, never claims content as original
- [ ] Rate limit: max 10 requests/min to Wikivoyage
- [ ] Cache responses 7 days
- [ ] Unit tests with fixture HTML for Lisbon, Tokyo, Chiang Mai

#### US-D02: OpenStreetMap + Overpass source adapter

**Description:** As the data engine, I need POI metadata (coords, type, hours) from OSM.

**Acceptance Criteria:**

- [ ] New package `packages/sources/osm`
- [ ] `fetchPOIs(bbox: BBox, types: string[]): Promise<Candidate[]>`
- [ ] Default types: `amenity={cafe,restaurant,bar,place_of_worship,library,bookshop}`, `tourism={attraction,viewpoint,artwork,museum}`, `leisure={park,garden}`, `natural={beach}`
- [ ] Use Overpass QL with `out:json` and `timeout:30`
- [ ] Respect Overpass usage policy: max 1 req/sec per IP
- [ ] Cache responses 24h
- [ ] Unit tests with recorded Overpass responses

#### US-D03: Google Places API source adapter

**Description:** As the data engine, I need authoritative opening hours, ratings, and recent photos.

**Acceptance Criteria:**

- [ ] New package `packages/sources/google-places`
- [ ] `fetchNearby(lat, lon, radiusM): Promise<Candidate[]>`
- [ ] `fetchDetails(placeId): Promise<CandidateDetail>`
- [ ] API key from `GOOGLE_PLACES_API_KEY` env var; redacted in logs
- [ ] Cost monitoring: log per-request cost ($0.017/req for Nearby Search, $0.017 + $0.003/field for Details)
- [ ] Daily budget cap: $50/day (configurable). Refuse calls when exceeded; alert.
- [ ] Cache nearby responses 6h, details 24h
- [ ] **Compliance**: store only place_id + signals derived from data, NOT raw Google fields (per Google ToS)

#### US-D04: Source adapter contract + registry

**Description:** As the data engine, I need a uniform interface so adding new sources doesn't require pipeline changes.

**Acceptance Criteria:**

- [ ] `packages/sources/core/SourceAdapter.ts` defines the interface
- [ ] All adapters implement `name`, `weight`, `fetch(query: SourceQuery): Promise<Candidate[]>`, `healthCheck()`
- [ ] Registry: `getActiveAdapters(): SourceAdapter[]` reads from config + feature flags
- [ ] Each adapter has independent failure isolation (one source down ≠ pipeline down)
- [ ] Unit test: pipeline still runs correctly with only 1/3 adapters healthy

### Section B — Cross-Verification & Compilation

#### US-D05: Candidate deduplication

**Description:** As the data engine, I need to identify when 3 sources reference the same physical location and merge them into one Candidate.

**Acceptance Criteria:**

- [ ] `dedup(candidates: Candidate[]): MergedCandidate[]`
- [ ] Match on (name fuzzy ≥0.85 similarity) AND (coordinates within 50m)
- [ ] When merged: combine evidence array, preserve all source URLs, take most-recent name
- [ ] Logged: how many merges per pipeline run
- [ ] Unit test: "Wat Suan Dok" from Wikivoyage + "วัดสวนดอก" from OSM at same coords → 1 merged candidate

#### US-D06: Evidence weight scoring

**Description:** As the data engine, I need to compute total evidence weight per candidate to decide whether it's worth AI-compiling.

**Acceptance Criteria:**

- [ ] Per-source weights configurable in `packages/db/sources_config`:
  - wikivoyage: 3
  - osm: 2
  - google_places: 1
  - reddit_solo_signal (Phase 2): 5
  - blog (Phase 2): 2
  - youtube_vlog (Phase 2): 3
- [ ] Compute `total_weight` and `sources_count` per candidate
- [ ] Threshold: must satisfy `total_weight >= 5 AND sources_count >= 2` to proceed to compilation
- [ ] Below-threshold candidates stored in `dropped_candidates` with reason

#### US-D07: AI compilation service

**Description:** As the data engine, I need to convert merged evidence into a fully-formed Experience JSON.

**Acceptance Criteria:**

- [ ] New package `packages/ai/compilation`
- [ ] `compile(candidate: MergedCandidate): Promise<Experience | RejectReason>`
- [ ] Uses Claude Opus 4.7 via Anthropic SDK
- [ ] Prompt template versioned in `packages/ai/prompts/compile-experience.v1.md`
- [ ] Output validated against `packages/core/src/experience.ts` Zod schema
- [ ] Voice gate: rejects if `oneLiner` matches `/(amazing|best|must-see|incredible|breathtaking)/i`
- [ ] Depth gate: rejects if `whyItMatters.length < 80 words`
- [ ] Required fields gate: `realInconveniences.length >= 2`, all required schema fields present
- [ ] Per-call cost tracked; daily budget $200/day with alert
- [ ] Retries: 1 retry on JSON parse fail; 0 retries on voice/depth gate fail
- [ ] All compilations logged with input + output + verdict

#### US-D08: Backend API

**Description:** As iOS, I need geo-aware endpoints that trigger backfill when coverage is thin.

**Acceptance Criteria:**

- [ ] `GET /v1/experiences?lat={}&lon={}&radiusKm={}&minTier={1-5,default 2}` returns experiences sorted by `(confidence.level desc, distance asc)`
- [ ] `GET /v1/experiences?bbox=...&minTier=` for map pan queries
- [ ] `GET /v1/experiences/{id}` returns single experience with full evidence chain
- [ ] `POST /v1/experiences/{id}/signals` accepts user micro-survey results (auth via device id)
- [ ] When `count < 5 OR oldest > 90d`, async-enqueue compilation job; **return current state immediately** (don't block user)
- [ ] Response includes `meta.compilationStatus: 'idle' | 'queued' | 'running'` so iOS can show "Finding more nearby..." indicator
- [ ] Cache: 60s public, 5s when `compilationStatus != 'idle'`
- [ ] OpenAPI spec in `packages/api/openapi.yaml`
- [ ] All responses match `packages/core/src/experience.ts`

### Section C — Database & Schema

#### US-D09: Postgres + PostGIS schema

**Description:** As the data engine, I need a schema that supports geo queries, source attribution, evidence chain, and audit history.

**Acceptance Criteria:**

- [ ] New package `packages/db` using Drizzle ORM
- [ ] Tables (sketched, finalize in implementation):
  - `experiences` (id, location: geography(POINT, 4326), title, oneLiner, whyItMatters, category, confidence_level, status, created_at, updated_at, last_compiled_at)
  - `experience_revisions` (id, experience_id, revision_number, full_payload jsonb, created_by ('ai' | editor_id | 'system'), created_at)
  - `sources` (id, experience_id, source_type, source_url, weight, evidence jsonb, verified_at)
  - `dropped_candidates` (id, evidence jsonb, reason, dropped_at) — for diagnostics
  - `compilation_jobs` (id, query jsonb, status, started_at, completed_at, error)
  - `editor_queue` (id, experience_id, priority, claimed_by, claimed_at)
  - `user_signals` (id, experience_id, anonymous_device_id, signal_type, payload jsonb, created_at)
  - `audit_log` (id, actor, action, target_type, target_id, payload jsonb, at)
- [ ] PostGIS extension enabled; GIST index on `experiences.location`
- [ ] All migrations forward-only, versioned, runnable from scratch
- [ ] `docker-compose.yml` for local dev
- [ ] Production: Supabase managed Postgres
- [ ] Backup policy: PITR, daily snapshot retained 30d
- [ ] Schema parity check extended: TS ↔ Swift ↔ DB all aligned in CI

#### US-D10: Anonymous device ID

**Description:** As the system, I need to attribute user signals without requiring sign-up.

**Acceptance Criteria:**

- [ ] iOS generates UUIDv4 on first launch, persists in Keychain (survives reinstall? open question)
- [ ] Sent as `X-Device-ID` header on all signal-writing requests
- [ ] Server stores device_id in `user_signals` (not in `experiences`)
- [ ] No PII; not joinable to any other identifier
- [ ] Device IDs rotate-able from Settings (resets all contributed signals)

### Section D — Editorial Admin App

#### US-D11: Admin app scaffold

**Description:** As an editor, I need a web app to triage AI candidates.

**Acceptance Criteria:**

- [ ] New app `apps/admin` (Next.js, App Router, share `packages/core` types)
- [ ] Auth: simple email magic-link (Supabase Auth) restricted to allowlist (env var)
- [ ] Routes: `/queue`, `/queue/[id]`, `/published`, `/dropped`, `/sources`, `/metrics`
- [ ] Mobile-responsive (editors might triage on phone)
- [ ] Dark mode default (editors' eyes)

#### US-D12: Review queue UI

**Description:** As an editor, I want to see and prioritize candidates needing review.

**Acceptance Criteria:**

- [ ] `/queue` lists candidates with `status = 'awaiting_review'`, sorted by:
  - Population proximity (more potential users → higher priority)
  - Evidence weight (higher → higher)
  - Age (older → higher)
- [ ] Each row shows: title, city, source count, weight, age
- [ ] Filter by city, source type, weight range
- [ ] "Claim" button locks a candidate to current editor for 30 min (prevents double-review)

#### US-D13: Side-by-side review UI

**Description:** As an editor, I want to compare raw evidence vs AI output and edit before approving.

**Acceptance Criteria:**

- [ ] `/queue/[id]` three-pane view:
  - Left: raw evidence (collapsible per source)
  - Center: AI-generated Experience (read-only diff vs default)
  - Right: editable form with same fields
- [ ] Map preview of location + nearby published experiences
- [ ] Voice violations highlighted (regex matches `/amazing|best|must-see/i` in red)
- [ ] Actions: **Approve as-is** (→ tier 3), **Approve with edits** (→ tier 3, store diff), **Reject** (→ requires reason)
- [ ] After action: queue advances to next candidate automatically

#### US-D14: Editor metrics & audit

**Description:** As an operator, I want to see editorial throughput and individual editor patterns.

**Acceptance Criteria:**

- [ ] `/metrics` shows: queue depth, throughput per editor (per day/week), approval rate, edit rate, reject reasons distribution
- [ ] `/published` lists recently approved with editor attribution
- [ ] `/dropped` lists rejected with reason; bulk re-queue option for false-rejects
- [ ] Audit log searchable by editor, date range, action

### Section E — User Signal Aggregation

#### US-D15: Passive GPS dwell signal

**Description:** As the system, I need to detect when a user actually visited an experience.

**Acceptance Criteria:**

- [ ] iOS `LocationService` already monitors regions (200m radius, ≤20 simultaneously)
- [ ] On `didEnterRegion`, start dwell timer; on `didExitRegion`, compute duration
- [ ] If duration >= 15 minutes: POST `/v1/experiences/{id}/signals` with `signal_type: 'gps_dwell'`, `payload: { duration_seconds }`
- [ ] Server increments `passiveGpsHits30d` counter; resets monthly
- [ ] Privacy: only experience_id + duration sent, never coordinates

#### US-D16: Active micro-survey on completion

**Description:** As a user marking an experience as done, I'm asked 3 quick questions.

**Acceptance Criteria:**

- [ ] After tapping "Mark as done", a sheet appears with 3 questions:
  1. "Did you feel comfortable here alone?" (1-5 stars)
  2. "Did staff/patrons make you feel out of place?" (1-5, inverted)
  3. "Would you recommend this to a solo friend?" (yes / no / depends)
- [ ] Submit POSTs to `/v1/experiences/{id}/signals` with `signal_type: 'micro_survey'`, `payload: { q1, q2, q3 }`
- [ ] "Skip" button is allowed but logged; if user skips 3 in a row, feature respects that for 30 days
- [ ] Server stores in `user_signals`
- [ ] When `verified_user_count >= 5`, recompute `soloScore` from user data and bump confidence tier
- [ ] Localized survey copy

#### US-D17: Aggregation worker

**Description:** As the system, I need to recompute `soloScore` and `confidence.level` as signals accumulate.

**Acceptance Criteria:**

- [ ] Background job (Supabase Edge Function or cron) runs hourly
- [ ] For each experience with `pending_signal_aggregation = true`:
  - Pull all `user_signals` where `signal_type = 'micro_survey'`
  - Compute new `soloScore.breakdown` from question medians
  - Compute new `confidence.level` based on count + recency
  - Insert new revision with `created_by = 'system'`
- [ ] Old AI-derived score is preserved in revision history (never lost)
- [ ] Audit log entry per aggregation

### Section F — Re-compilation & Freshness

#### US-D18: Staleness detection

**Description:** As the system, I need to surface experiences whose data may be outdated.

**Acceptance Criteria:**

- [ ] Nightly cron: select experiences where `last_compiled_at < now() - 90 days`
- [ ] For each: re-run §3.2–§3.6, generate new revision
- [ ] Compare old vs new: if material changes (closed, moved, hours changed), push to editor queue with REFRESH label
- [ ] If no material changes, just bump `last_compiled_at`
- [ ] Soft-delete experiences confirmed permanently closed (status = 'closed')

#### US-D19: User-reported issues

**Description:** As a user, I want to report when an experience is wrong/closed/different.

**Acceptance Criteria:**

- [ ] Report button on `ExperienceDetailView`
- [ ] Reasons (single-select): closed permanently, moved, hours wrong, vibe different, factually wrong, other
- [ ] Optional free-text (max 200 chars)
- [ ] POST `/v1/experiences/{id}/signals` with `signal_type: 'user_report'`
- [ ] When reports >= 3 within 30 days: auto-flag for editor review
- [ ] Reporter device_id reputation tracked (frequent false reports → throttled)

### Section G — Cost & Health Monitoring

#### US-D20: Per-source cost tracking

**Description:** As an operator, I need real-time visibility into spend.

**Acceptance Criteria:**

- [ ] `apps/admin/metrics` shows daily/monthly spend per source
- [ ] Hard caps configurable per source; pipeline degrades gracefully when cap hit (skip that source)
- [ ] Slack/email alert when 80% of daily cap hit
- [ ] Monthly export to CSV for accounting

#### US-D21: Pipeline health dashboard

**Description:** As an operator, I need to see pipeline status at a glance.

**Acceptance Criteria:**

- [ ] `/metrics` shows: jobs queued / running / completed / failed last 24h
- [ ] Per-adapter health: success rate, latency p50/p95, error reasons
- [ ] Compilation success rate (passed all gates)
- [ ] Editor queue depth + age of oldest item

#### US-D22: Abuse detection

**Description:** As the system, I need to detect signal abuse (e.g. one device spam-rating to manipulate score).

**Acceptance Criteria:**

- [ ] Per-device rate limit: max 10 micro-surveys/day, max 5 reports/day
- [ ] Detect coordinated patterns (N devices submitting identical surveys within minutes)
- [ ] Suspicious signals quarantined, not counted toward aggregation
- [ ] Trust officer can review/reverse quarantine

### Section H — Bootstrap & Phase 0

#### US-D23: Bootstrap pipeline run

**Description:** As the team, we need an initial dataset to ship a non-empty product on day one.

**Acceptance Criteria:**

- [ ] Pre-launch script runs compilation pipeline against 20 cities (list curated by team)
- [ ] Editorial team reviews before launch; only `editorApproved` (tier 3+) experiences shipped
- [ ] Target: ≥30 published experiences per city before launch
- [ ] Launch checklist documents each city's coverage before going live

#### US-D24: Confidence-tier UI

**Description:** As a user, I want to immediately understand which experiences are battle-tested vs AI-guessed.

**Acceptance Criteria:**

- [ ] Map markers visually distinguish confidence tier (per §2.1 table)
- [ ] Detail view shows confidence tier explicitly with explanation
- [ ] Help screen (linked from any tier badge) explains the system in 100 words
- [ ] Settings toggle: "Show speculative (tier 1) experiences" — default OFF
- [ ] Source attribution panel on detail view: "Compiled from Wikivoyage + OSM + 2 user reports"

---

## 7. Functional Requirements

### Source layer

- **FR-D1**: Each adapter is independently failure-isolated; pipeline produces output even with N-1 adapters down
- **FR-D2**: Adapter responses cached per source-specific TTL (Wikivoyage 7d, OSM 24h, Google 6h)
- **FR-D3**: Adapter responses include attribution metadata; downstream stages preserve attribution

### Compilation layer

- **FR-D4**: Cross-verification computes `total_weight` and `sources_count` per candidate
- **FR-D5**: Compilation only runs when `total_weight >= 5 AND sources_count >= 2`
- **FR-D6**: AI compilation rejects outputs failing voice gate or depth gate; no auto-publish
- **FR-D7**: All AI compilations logged with input + output + verdict
- **FR-D8**: AI compilation respects daily cost cap; degrades gracefully when hit

### Persistence layer

- **FR-D9**: Every Experience mutation creates an `experience_revision` row
- **FR-D10**: Original AI-derived score is never lost when overridden by user-derived score
- **FR-D11**: All editor and system actions logged in `audit_log`
- **FR-D12**: PostGIS GIST index on `experiences.location` enables sub-100ms bbox queries up to 10k results

### API layer

- **FR-D13**: `GET /v1/experiences` triggers async backfill when coverage thin; never blocks user
- **FR-D14**: API responses include `meta.compilationStatus` so client can show progress indicator
- **FR-D15**: `minTier` parameter defaults to 2; tier 1 only returned on explicit opt-in
- **FR-D16**: Anonymous device ID required for signal-writing endpoints

### Admin layer

- **FR-D17**: Editor queue prioritizes by population proximity × evidence weight × age
- **FR-D18**: Side-by-side review highlights voice violations
- **FR-D19**: All editor actions are auditable
- **FR-D20**: Editor metrics visible to operators

### User signal layer

- **FR-D21**: Passive GPS dwell signals reported only with experience_id + duration (no coords)
- **FR-D22**: Micro-survey skip respected for 30 days after 3 consecutive skips
- **FR-D23**: When `verified_user_count >= 5`, user-derived `soloScore` overrides AI-derived
- **FR-D24**: Aggregation runs hourly via background worker
- **FR-D25**: Suspected abuse signals quarantined, not counted

---

## 8. Non-Goals (Out of Scope for v2)

- **No social/sharing features** (no comments, no friending, no public activity feed) — confirmed from PRD v1
- **No paid sources** beyond Google Places (no Foursquare API, no Yelp API in this PRD)
- **No real-time multi-user crowdsourcing UI** ("X people are here right now") — privacy-incompatible
- **No AI content generation in non-English** for v2 (compile in English; localized rendering later)
- **No fully automated approval** — every Experience requires editor review before tier 3
- **No remote push notifications via APNs server** — local notifications only (per v1)
- **No user-to-user messaging**
- **No payment / subscription tier**
- **No third-party export/embed** of compiled content
- **No mobile admin app** — admin is web-only

---

## 9. Design Considerations

### UI for confidence transparency

- Confidence tier is a **first-class visual element**, not buried in a detail field
- Map marker rings color-coded per §2.1 table
- Detail view header includes tier badge + one-line explanation
- Help center explains the tiering system in plain language

### Editor UX

- Single-screen review (no tab switching) reduces fatigue
- Keyboard shortcuts: `A` approve, `E` edit, `R` reject, `↓` next
- Auto-save edit draft every 5 seconds
- Bulk operations for similar candidates (e.g. "approve all OSM-only cafes in this batch")

### iOS interactions with confidence tiers

- Default filter: tier ≥ 2 (excludes "speculative")
- Tier 1 reveal toggle in Settings (requires explicit acknowledgment of risk)
- Empty state when filter excludes too much: "Loosen filter to show {N} more"

---

## 10. Technical Considerations

### Architecture decisions

| Decision               | Choice                                                | Rationale                                                            |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Backend platform       | Supabase                                              | Managed PostGIS + Auth + Edge Functions, single vendor for MVP speed |
| ORM                    | Drizzle                                               | TypeScript-first, plays well with monorepo, lighter than Prisma      |
| Pipeline orchestration | Supabase Edge Functions + pg_cron for v2              | Avoids new infra; revisit (Inngest/Trigger.dev) if it doesn't scale  |
| AI provider            | Anthropic Claude Opus 4.7                             | Already used in iOS; voice quality required                          |
| Admin app              | Next.js App Router in `apps/admin`                    | Reuses monorepo conventions                                          |
| Auth (admin)           | Supabase Magic Link + allowlist                       | Zero implementation cost                                             |
| Anonymous user ID      | UUIDv4 in Keychain                                    | Stable across reinstall on same device                               |
| Cost cap enforcement   | Per-source daily caps in DB; checked before each call | Hard ceiling > soft monitoring                                       |

### Schema parity

- Existing TS↔Swift parity check (`pnpm parity:check`) extended to also validate Drizzle schema matches `packages/core/src/experience.ts`
- CI fails on any drift between three layers

### Testing

- **Unit**: each source adapter, dedup, evidence weight, voice gate, depth gate
- **Integration**: full pipeline run with recorded fixtures (no real API calls in CI)
- **Contract**: API tests validate request/response against OpenAPI
- **Load**: simulate 1000 concurrent geo queries; assert p95 < 500ms
- **End-to-end**: bootstrap pipeline against 1 city in staging; verify ≥10 published

### Observability

- Structured logging (JSON) to Supabase Logs
- Per-stage metrics (sources fetched, candidates merged, compilations attempted/passed/failed, editor queue depth)
- Alerting on: cost cap hit, queue depth > 500, error rate > 5%

---

## 11. Phased Rollout

| Phase                          | Weeks | Scope                                                                       | Issues                         |
| ------------------------------ | ----- | --------------------------------------------------------------------------- | ------------------------------ |
| 0 — Foundation                 | 1–2   | DB schema, Supabase setup, source adapter contract, OpenAPI skeleton        | US-D04, US-D09, US-D10         |
| 1 — First source + compilation | 3–5   | Wikivoyage adapter, dedup, evidence scoring, AI compile                     | US-D01, US-D05, US-D06, US-D07 |
| 2 — Add OSM + Google + API     | 6–8   | OSM, Google Places, full API endpoints                                      | US-D02, US-D03, US-D08         |
| 3 — Admin app                  | 9–11  | Admin scaffold, queue, side-by-side review, metrics                         | US-D11, US-D12, US-D13, US-D14 |
| 4 — User signals               | 12–13 | GPS dwell, micro-survey, aggregation worker                                 | US-D15, US-D16, US-D17         |
| 5 — Re-compilation + reports   | 14–15 | Staleness detection, user report flow                                       | US-D18, US-D19                 |
| 6 — Cost + health + abuse      | 16–17 | Per-source cost, pipeline health, abuse detection                           | US-D20, US-D21, US-D22         |
| 7 — Bootstrap + confidence UI  | 18–19 | Run bootstrap pipeline against 20 cities, ship confidence-tier UI           | US-D23, US-D24                 |
| 8 — iOS frontend integration   | 20–22 | Wire iOS to new API, ship onboarding/settings/favorites/checkin from PRD v1 | (v1 carryover)                 |

**Total: ~22 weeks ≈ 5.5 months** for one full-time engineer + one part-time editor.
Two engineers in parallel can compress to ~14 weeks (~3.5 months).

---

## 12. Cost Model (rough, monthly at 10k MAU)

| Item                                                     | Estimate                             |
| -------------------------------------------------------- | ------------------------------------ |
| Supabase Pro (DB + Auth + Edge Functions + Storage)      | $25–$200                             |
| PostGIS hosting overage                                  | $50–$200                             |
| Google Places API (capped at $50/day)                    | $1,500 max                           |
| Anthropic Claude Opus 4.7 (compilation, capped $200/day) | $6,000 max                           |
| Anthropic Claude (iOS in-app, existing)                  | $500                                 |
| Editor labor (0.5 FTE @ $30/hr × 80h)                    | $2,400                               |
| Operator alerting (PagerDuty / Slack)                    | $50                                  |
| **Total monthly ceiling**                                | **~$10,500/mo at hard caps**         |
| **Realistic month 1**                                    | **~$1,500/mo (pipeline ramping up)** |

### Per-experience marginal cost target

- Sources: $0.05 (mostly free + Google)
- AI compilation: $0.20
- Editor time: $0.20 (12 sec @ $60/hr)
- **Total: $0.45 per published Experience** (target ≤ $0.50)

---

## 13. Risks & Mitigations

| Risk                                      | Severity | Mitigation                                                                               |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| AI generates plausible-but-wrong content  | High     | Mandatory editor review before tier 3; voice/depth gates pre-publish                     |
| Editorial throughput becomes bottleneck   | High     | Strong queue prioritization; bulk operations; auto-batch similar candidates              |
| Source ToS violation (esp. Google Places) | High     | Store only IDs + derived fields, never raw payload; legal review before launch           |
| AI cost overruns                          | Medium   | Hard daily caps per source; degradation to "no new compilations today"                   |
| Cold-start: empty cities at launch        | Medium   | US-D23 bootstrap run pre-launch covers 20 cities                                         |
| User signal abuse skews scores            | Medium   | US-D22 abuse detection + signal quarantine + reputation system                           |
| Schema drift across TS/Swift/DB           | Medium   | Extended parity check in CI; release blocker on drift                                    |
| Editor burnout                            | Medium   | Track editor metrics; cap shifts at 30 min/day; rotate editors                           |
| GDPR / data subject requests              | Medium   | Anonymous device IDs; user-initiated reset clears all signals; document deletion process |
| Wikivoyage content licensing (CC-BY-SA)   | Low      | Always store + display attribution; never claim originality                              |

---

## 14. Open Questions

1. **Bootstrap city list**: Which 20 cities for launch? Suggest: Chiang Mai, Bangkok, Tokyo, Kyoto, Lisbon, Porto, Mexico City, Oaxaca, Bali (Ubud + Canggu), Medellín, Buenos Aires, Berlin, Barcelona, Tbilisi, Istanbul, Cairo, Marrakech, Cape Town, Hanoi, Hoi An. Final list TBD with team.
2. **Editor recruiting**: Is the editor role you + co-builder for v2, or do we recruit external editors? Affects admin auth scope and SOPs.
3. **Anonymous ID Keychain persistence**: Do we want device IDs to survive app reinstall (Keychain) or reset (UserDefaults)? Trade-off: stable signals vs privacy.
4. **Wikivoyage attribution UI**: Where exactly does the attribution show? Suggest: detail view "Sources" section + map overlay watermark when content is heavily Wikivoyage-derived.
5. **Tier 1 (speculative) — show or hide by default?** Current PRD says hide. Confirm.
6. **Re-compilation cadence**: 90 days is a guess. May need adjustment per category (cafés change faster than temples).
7. **Multi-language strategy**: When do we add zh-Hans / es / pt source adapters? PRD v2 is English-only for compilation.
8. **Long-press user-submitted Experiences (existing iOS feature)**: How do they enter the moderation pipeline? Suggest: enter as tier 0 candidates, require ≥3 user verifications before promoting to tier 2.

---

## 15. Definition of Done (for the entire data engine)

- All 24 US-D stories have acceptance criteria met and tests passing
- Bootstrap pipeline has run against 20 cities; ≥30 published experiences per city
- Cost dashboard shows actuals within 30% of model
- Editor team can clear daily queue in ≤30 min/day per editor
- iOS app served by new API, no longer reads bundled `seed_experiences.json` for primary content (only as offline fallback)
- A new user opening the app in any of the 20 launch cities sees ≥10 experiences in <5 seconds
- 95% of editor-approved experiences pass post-launch voice audit
- Schema parity check extends to all three layers (TS / Swift / DB) and is green in CI

---

## 16. References

- PRD v1: `tasks/prd-ios-first-run-experience.md` (iOS frontend portions still authoritative)
- Umbrella issue: [#56](https://github.com/getyak/solo-compass/issues/56)
- Project conventions: `CLAUDE.md`
- Product brief & phases: `docs/PRODUCT_BRIEF.md`, `docs/PHASES.md`
- Schema source of truth: `packages/core/src/experience.ts`
- Existing schema parity guard: commit `7342eb3`
