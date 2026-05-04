# Product Brief

> Solo Compass · 独行罗盘
>
> One sentence: **打开 App 就是地图,地图上自动显示周边值得做的事——为独自旅行者设计的"活地图"。**
> One sentence (EN): **Open the app and you see a map; the map shows things worth doing nearby — a living map for people traveling alone.**

---

## What this is, in three sentences

1. Not another travel app. Not a Google Maps clone. Not a small-red-book replacement.
2. A **map-first**, **experience-as-unit**, **AI-curated** companion for people traveling alone.
3. Every dot on the map is a *thing worth doing*, not just *a place that exists*.

## Why does this need to exist

Existing options fail solo travelers in specific ways:

| Existing | Failure for solo travelers |
|---|---|
| Google Maps | "places" not "experiences"; ratings inflated; doesn't know if a spot is solo-friendly |
| 小红书/Xiaohongshu | network-promoted noise; "instagrammable" ≠ good; no honest inconvenience |
| Lonely Planet | static; cannot reflect "is this open right now in the rain on a Tuesday afternoon" |
| Tripadvisor | gamed reviews; designed for couples and groups |
| ChatGPT travel | hallucinations; no live data; no map; no memory of your day |

Nothing in the market combines: live map, honest curation, solo-aware framing, AI that *filters* without *deciding*.

## Three design pillars (non-negotiable)

| Pillar | Meaning |
|---|---|
| **Map-First** | The map is the home screen. No tabs, no drawer, no onboarding. Everything happens on the map. |
| **Experience-as-Unit** | Not "places" — concrete, time-bound, story-rich things to do. |
| **AI doesn't decide** | AI filters from many to few and explains. Never "the answer." Always "options." |

> AI doesn't travel for you. AI helps you travel better.

## Anti-goals

The product is at least as defined by what it refuses to be:

- **No social feed.** No following, no posting, no likes.
- **No gamification.** No points, badges, leaderboards.
- **No "for you" engagement loops.** No notifications optimized for re-open rate.
- **No real-name requirement.** No mandatory photo, email, or social graph.
- **No coupling to a single city's rules.** The schema works in Chiang Mai, Lisbon, Tokyo, identically.

If a feature pulls toward any of these, it's a smell.

## The user we're building for

Primary persona: a solo traveler in Chiang Mai who is technically capable, mildly introverted, has been to a few cities alone, and wants *non-obvious* recommendations. Likely a digital nomad. Aged 25–40. Phone is set up to accept new apps but they have a high bar.

What they're already doing today:
- Opening Google Maps, scrolling Saved
- Reading 小红书 with mounting cynicism
- Asking ChatGPT and feeling the answers are too generic
- Asking strangers in coffee shops (this is actually their best signal)

What we're trying to be: **a slightly better version of "asking that local friend who knows."**

## The Experience as a unit

A place is "Wat Suan Dok temple."

An *experience* is "watch the sunset paint the white stupas at 17:30, lasts 45 minutes, often peaceful, locals come for evening prayer at 18:30 if you want to stay."

The difference:
- a place is a noun
- an experience is a verb-bound, time-bound, sensorially-anchored unit

Schema: see `packages/core/src/experience.ts`. The fields encoded there are the operational form of this principle.

## AI's role

Three jobs, in order of importance:

1. **Filter** — narrow 1000 candidates to 5 based on location, time, intent, weather, user history.
2. **Explain** — for each suggestion, give the reason. Surface evidence (sources, confidence, what other solo travelers said).
3. **Translate** — voice intent ("somewhere quiet I can read for 2 hours") into a search.

What AI does NOT do:
- Pick *the* answer.
- Generate experiences from thin air. (Experiences are sourced from real data + verified.)
- Hide its uncertainty. Confidence is always visible.

## Trust, freshness, confidence

Solo travelers are particularly vulnerable to bad recommendations — they have no one to commiserate with when something fails. Trust is the moat.

Mechanism:

- Every experience carries `sources` (where the info came from) and `confidence` (5-level signal score).
- `lastVerifiedAt` triggers freshness icons: 🟢 healthy → 🟡 fading → 🔴 questioned → ⚫ may-be-gone.
- Passive GPS traffic (anonymized aggregate) acts as a distributed health check on every place. If nobody passes near for 60 days, it auto-degrades.
- Active reports (rating, voice memo) lift confidence. Trusted reporters lift it more.

Honest, visible, falsifiable. Closer to a Wikipedia article than a TripAdvisor review.

## What the seeds look like

The product launches with **~50 seed experiences in Chiang Mai**, hand-curated from 7 deeply researched ones (the field-week experiences) plus AI-assisted expansion using Wikivoyage and Reddit.

Quality bar for a seed: a solo traveler in Chiang Mai who reads it in 20 seconds wants to do it.

If the seeds aren't good, no algorithm fixes the product. So Phase 0 is "go to Chiang Mai and do 7 experiences."

## Validation hierarchy

1. **30-second comprehension test (Phase 1).** Show the Figma to 10 friends. Can they articulate what it does?
2. **Week-1 retention (Phase 2).** Of users who try the web app once, do 40% come back the following week?
3. **Completion rate (Phase 2).** Of recommendations shown, what % do users actually go do?
4. **NPS at 30 days (Phase 3).** Honest signal, not vanity.

DAU and MAU are not the success metric. *Retention from people who needed the app* is.

## Out of scope (for now)

- Booking flows (transport, lodging, tickets). These exist; we link to them.
- Multi-day trip planning. We help with the *next 3 hours*, not the next week.
- Group features. The product is solo. (Two solos meeting up is fine; that's still solo.)
- AI that "writes back" with personality. The voice is restrained, factual, friendly. Not chatty.

## Open questions tracked separately

- Pricing model (currently leaning: free with a pro tier for trip archive)
- Multi-city expansion sequence after Chiang Mai
- Privacy/data retention specifics
- Native Android timing
