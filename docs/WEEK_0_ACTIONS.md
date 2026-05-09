# Week 0 Action Sheet — for @cubxxw

> Last updated 2026-05-09. Companion to `docs/WEB_OPS.md` and Epic I in
> `tasks/prd-paid-app-foundation.md`.
>
> **What this file is:** the 6 things that block engineering downstream
> and need a human (you) to do them, in priority order. None of them
> takes longer than 30 minutes of your active time. Most of the elapsed
> time is waiting on external review.

## Done already (no action)

- Privacy policy drafted (`docs/PRIVACY.md`) — copy to a Notion page when ready.
- Customer support reply templates drafted (`docs/SUPPORT.md`).
- Operations runbook drafted (`docs/WEB_OPS.md`).
- Domain decision recorded (deferred to v1.2).

## Action 1 — Apple Developer Program: verify still active (5 min)

**Why now:** Week 4 (Epic D) needs IAP SKUs, which need an active enrollment. Apple sometimes lets it lapse silently.

**Steps:**
1. Sign in to https://developer.apple.com/account
2. Confirm membership status reads "Active" and renewal date is > 4 months away.
3. If renewal is < 4 months out, renew now ($99/yr).

## Action 2 — App Store Connect: create app + 2 IAP SKUs (20 min, then 24–48h Apple review)

**Why now:** Apple's IAP SKU review is a hard blocker on Epic D (week 4). Submit early so it clears in time.

**Steps:**
1. Sign in to https://appstoreconnect.apple.com
2. **My Apps → "+" → New App**
   - Platform: iOS
   - Name: **Solo Compass** (English primary), **孤旅指南针** (zh-Hans secondary)
   - Primary language: English
   - Bundle ID: `com.solocompass.app` (create the matching App ID in the developer portal first if it doesn't exist)
   - SKU: `SOLOCOMPASS-IOS-001`
   - User access: Full access
3. **Pricing and Availability** → Free (the app itself is free; subscriptions are IAP).
4. **Subscriptions** → "+" → Subscription Group named **"Solo Compass Pro"**
5. Add subscription **Monthly**:
   - Reference name: `Pro Monthly`
   - Product ID: `com.solocompass.pro.monthly`
   - Subscription Duration: 1 Month
   - Price: Apple price tier 2 (~$1.99 USD; auto-converted per region)
   - Subscription Display Name: "Pro Monthly" (en) / "高级月付" (zh)
   - Description: "Unlock AI-powered Explore Here, voice intent, and AI insights" (en) / "解锁 AI 探索附近、语音查询、AI 解读" (zh)
   - Introductory Offer: 7-day free trial, applicable on first subscription
   - Promotional artwork: 1024×1024 PNG (use a placeholder if final art isn't ready — can update before submission)
6. Add subscription **Yearly** (same group):
   - Reference name: `Pro Yearly`
   - Product ID: `com.solocompass.pro.yearly`
   - Duration: 1 Year
   - Price: Apple price tier 11 (~$14.99 USD)
   - Display Name: "Pro Yearly" (en) / "高级年付" (zh)
   - Description: "Same as Monthly, save ~37% with annual billing" (en) / "同月付权益，年付节省约 37%" (zh)
   - Introductory Offer: 7-day free trial
7. **Submit both for review** — they need 24–48h.

**Confirm:** record both Product IDs in `docs/APP_STORE.md` (create that file if it doesn't exist) and check off US-I4 acceptance criteria.

## Action 3 — Mapbox: account + 2 tokens (10 min)

**Why now:** Week 7 (Epic G) needs a real Mapbox token. Doing it now means zero waiting later.

**Steps:**
1. Sign up at https://account.mapbox.com (free Studio tier).
2. **Account → Access tokens → Create a token**
   - Name: `solo-compass-prod`
   - Scopes (read-only is enough): `styles:read`, `fonts:read`, `tiles:read`, `datasets:read`
   - URL restrictions: `*.vercel.app` (until v1.2 adds a real domain)
   - Save the token to 1Password under "Solo Compass / Mapbox / production"
3. Create a second token:
   - Name: `solo-compass-dev`
   - Same scopes
   - **No** URL restriction
   - Save to 1Password under "Solo Compass / Mapbox / development"
4. Optional (can defer to week 7): Mapbox Studio → New Style → fork "Outdoors" → adjust to warm cream basemap. Note the style ID for `apps/web/src/lib/map-style.ts`.

**Confirm:** US-I1 acceptance criteria.

## Action 4 — Supabase: create production project (15 min, then ~10 min provisioning)

**Why now:** Epic E (week 5) and Epic G (week 7) both depend on this. Provisioning is fast but Pro plan upgrade requires a credit card; do it once, then forget.

**Steps:**
1. Sign in to https://supabase.com/dashboard (use the founder Gmail).
2. **New Project**
   - Name: `solo-compass-prod`
   - Database password: generate strong, save to 1Password under "Solo Compass / Supabase / Postgres password"
   - Region: **Southeast Asia (Singapore)** = `ap-southeast-1`
   - Pricing plan: **Pro** ($25/month)
3. After provisioning completes, **Project Settings → API**:
   - Copy `Project URL` → save to 1Password as `SUPABASE_URL`
   - Copy `anon` `public` key → save as `SUPABASE_ANON_KEY`
   - Copy `service_role` `secret` key → save as `SUPABASE_SERVICE_ROLE_KEY` (treat like a password)
4. **Database → Backups** → enable PITR (should be on by default on Pro).
5. Run a manual snapshot now ("Take backup now") — confirms backups work.

**Confirm:** US-I2 acceptance criteria. Do **not** push these keys to git; they go into Vercel + iOS Secrets.plist later.

## Action 5 — Vercel: link the GitHub repo + reserve project name (10 min)

**Why now:** The default URL `solo-compass.vercel.app` is first-come-first-served; reserve it before someone else does.

**Steps:**
1. Sign in to https://vercel.com (use the founder GitHub).
2. **Add New → Project → Import** the `getyak/solo-compass` GitHub repo.
3. **Configure Project:**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `apps/web`
   - Build & Development settings: defaults
   - Environment variables: leave empty for now (will fill in week 7)
4. **Deploy** — first build will fail because env vars are missing; that's fine. The point is reserving the URL.
5. **Project Settings → Domains** → confirm `solo-compass.vercel.app` is yours (or note the auto-assigned alias if that exact name is taken).
6. **Project Settings → Functions → Region** → set to **Singapore (`sin1`)**.

**Confirm:** Vercel project URL recorded in `docs/WEB_OPS.md` "URLs in production" section.

## Action 6 — Gmail support alias + Notion privacy page (10 min)

**Why now:** App Store submission requires a working privacy policy URL and a contact email. Both can use free options.

**Steps:**

### 6a. Gmail support alias

Pick one of these two patterns (the founder's choice):

- **Option A (cleaner):** create a new free Gmail account `solocompass.support@gmail.com`. Forward to your personal Gmail.
- **Option B (faster):** use a "+" alias on your existing Gmail, e.g. `yourname+solocompass@gmail.com`. Apple accepts these.

Record the chosen address in `docs/WEB_OPS.md` and `docs/SUPPORT.md`.

### 6b. Notion privacy + terms public pages

1. Open Notion → New Page → name it "Solo Compass Privacy Policy".
2. Copy the entire contents of `docs/PRIVACY.md` into the Notion page.
3. **Share → Publish to web** → set to **Allow comments: off, Allow editing: off, Search engine indexing: on**.
4. Copy the public URL (looks like `https://solocompass.notion.site/...` if you've claimed the workspace name, otherwise a `https://www.notion.so/<random>` URL).
5. Repeat for a Terms of Service page (we'll draft the content next; for now an empty placeholder is fine).
6. Record both URLs in `docs/WEB_OPS.md` "URLs in production" section.

**Confirm:** US-I5 acceptance criteria for "publicly hosted privacy URL" satisfied.

## What you can ignore for now

- **Anthropic prod workspace** — needed by week 5, not Week 0. Set up when Epic E starts.
- **Sentry / PostHog projects** — needed by week 7, not Week 0.
- **Beta tester recruitment** — week 9, not Week 0.
- **Launch announcement materials** — week 11, not Week 0.

## How to know Week 0 is done

When all six checkboxes below are ticked in `docs/WEB_OPS.md` "Account inventory" status column:

- [ ] Apple Developer membership verified active
- [ ] App Store Connect app entry + 2 IAP SKUs submitted
- [ ] Mapbox account + 2 tokens created
- [ ] Supabase prod project + backups verified
- [ ] Vercel project URL reserved
- [ ] Gmail support alias + Notion privacy URL live

I'll move from here to Epic A (SwiftData persistence) the moment Week 0 is closed. The 6 weeks of iOS engineering can then run uninterrupted.

## When you hit a snag

- **Apple rejects a SKU** — usually because of pricing tier or display name. Reply with the rejection reason and I'll adjust.
- **Supabase region not available** — pick Tokyo (`ap-northeast-1`) as the documented failover.
- **Vercel project name taken** — pick the next-best (`solocompass-app.vercel.app` or similar) and update `docs/WEB_OPS.md`.
- **Mapbox URL restriction confusing** — leave both tokens unrestricted for Week 0; we'll lock down before deploying to production in week 7.
