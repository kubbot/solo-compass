# Phases — what we build now vs later

> Strict rule: don't skip ahead. Each phase has a stop/go gate.

The biggest mistake a small team can make is building a 3-month iOS app to test a hypothesis that a 4-week web prototype could test.

## Phase 0 — Field Week (1 week)

**Goal:** Generate 7 seed experiences with emotional weight.

You and your co-builder go to Chiang Mai. Each day, do *one* experience that fits the "story-rich" criteria. Record it: voice notes, photos, structured writeup.

**Output:** 7 hand-curated seed experiences in `seeds/chiang-mai/` (private repo).

**Gate to Phase 1:** All 7 experiences pass the "would this make a stranger want to do it?" test.

Why this is non-negotiable: every later phase scales from these seeds. If the seeds are mediocre, no algorithm can save the product.

## Phase 1 — Notion + Figma Prototype (2–3 weeks)

**Goal:** Test the *content quality* and *interaction flow* before writing any code.

- Build the seeds into a Notion DB matching the `Experience` schema.
- High-fidelity Figma prototype of the map, experience card, voice flow.
- Show to 10 solo-traveler friends. 30-second comprehension test.

**Gate to Phase 2:** 8/10 testers can articulate what the product does after 30 seconds, and 6/10 want to try it.

## Phase 2 — Web Pre-MVP (4 weeks)

**Goal:** Validate the recommendation hypothesis with real users in real Chiang Mai.

`apps/web` ships. Manual check-in (no background GPS yet). Real Mapbox map. Real Claude-powered recommendations from real seed data.

Distribution: post the link in 3 Telegram groups for digital nomads in Chiang Mai. ~50 target users.

**Gate to Phase 3:** 30+ users complete ≥1 experience in week 1, and ≥40% retention in week 2.

If gate fails: the recommendation hypothesis is wrong. Go back to Phase 0 and rethink seeds before writing iOS.

## Phase 3 — iOS Native (2–3 months)

**Goal:** The real product. Background GPS, push notifications, native map performance.

Built only after Phase 2 succeeds. Built using the *exact* recommendation engine validated in Phase 2.

**Gate to public launch:** App Store review + 10 closed beta users (Chiang Mai) using daily for 2 weeks.

## Parallel: Bot lane

`apps/bot` runs as a *parallel* validation lane to Phase 2 — not a substitute. The bot tests the same recommendation hypothesis but with chat UI instead of map UI. If bot retention is dramatically higher than web, that's a signal the map metaphor is wrong.

Don't both-build at full intensity. Bot is one developer, one weekend, ongoing maintenance only.
