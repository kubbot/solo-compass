# CLAUDE.md

> Project memory for Claude Code and other AI coding agents working in this repo.

## What this project is

**Solo Compass** is a map-first, experience-as-unit, AI-curated companion app for solo travelers. The core unit is `Experience`, not `Place`. The map is the home screen, not a feature.

Read these first when picking up a task:

1. `docs/PRODUCT_BRIEF.md` — the *why*
2. `docs/PHASES.md` — what we're building *now*
3. `packages/core/src/experience.ts` — the schema everything orbits

## How to think about changes

### The three-pillar test

Before suggesting any feature or change, ask:

1. **Does it respect Map-First?** The map is the home screen. Tabs, drawers, side menus, modal flows that take the user away from the map without a strong reason — these get pushed back.
2. **Does it respect Experience-as-Unit?** We don't store "places". We store "things worth doing". If a change introduces a "Restaurant" or "POI" type, that's a smell — articulate why it's not an experience.
3. **Does it respect AI-doesn't-decide?** AI filters from many to few. AI explains. AI does not present a single answer with no alternatives. Recommendations are options.

If a change violates one of these, surface it explicitly in the PR description and explain why an exception is justified.

### The privacy posture

This product is for solo travelers, who often have heightened safety awareness. Privacy defaults are strict:

- No real names required.
- Background location is opt-in with clear explanation.
- "Other solo travelers nearby" surfaces *count* and *aggregated traces*, never identities.
- No photos required for any flow.
- The product never asks for an emergency contact, government ID, or social graph.

If a feature requires loosening these, it needs an issue + brief discussion before code.

## Repository conventions

### Monorepo
- `pnpm` workspaces + `turbo` for tasks.
- `packages/*` — platform-agnostic, no UI deps.
- `apps/*` — apps. Web (Next.js), iOS (Swift, Xcode-managed, NOT in pnpm workspaces), Bot (Telegraf).

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`. Don't disable.
- Prefer `interface` for object shapes, `type` for unions.
- All IDs are branded types (`UserId`, `ExperienceId`). Never `string`.

### Geo
- Coordinates are `[longitude, latitude]` (GeoJSON / Mapbox / PostGIS convention).
- **Never** mix with `[lat, lng]` (Google Maps convention). When integrating with Google APIs, convert at the boundary.

### Time
- Storage: ISO 8601 strings, UTC.
- Display: local to the user's current city.
- Best-time windows for experiences use 0–23 hour ints in *local time of the experience's city*.

### Commit messages
- Conventional Commits, lowercase scope.
- Examples in `CONTRIBUTING.md`.

## When stuck or unsure

- Open a GitHub issue describing the question. Don't ship code that depends on an answer the team hasn't given.
- If you find yourself adding a field to `Experience`, post the proposal as a comment on a tracking issue first. The schema is the moat — changes are deliberate.

## Things I (Claude) should never do here

- Add a "social feed" of any kind. The product's North Star is "calm." Feeds break that.
- Add a points/leaderboard system. The product respects users; gamification cheapens it.
- Add features that pressure the user to share, post, invite, or rate.
- Optimize for "engagement metrics." Optimize for week-1 retention from people who *needed* the app, not for time-in-app from people scrolling.
- Generate seed experiences and commit them to the public repo. Seeds are curated and live in a private repo.

## Useful commands

```bash
# Install everything
pnpm install

# Type-check the whole graph
pnpm typecheck

# Format
pnpm format

# Run a specific app
pnpm --filter @solo-compass/web dev
pnpm --filter @solo-compass/bot dev
```
