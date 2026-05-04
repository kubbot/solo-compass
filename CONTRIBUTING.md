# Contributing

> Pre-alpha. Hard hat zone. The schema and architecture are in flux.

## Before you write any code

Read these first, in order:

1. [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) — what we're building and why
2. [`docs/PHASES.md`](docs/PHASES.md) — what we're building *now* vs *later*
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — package boundaries
4. [`packages/core/src/experience.ts`](packages/core/src/experience.ts) — the domain heart

If a PR violates a principle in (1) or (2), it gets bounced regardless of code quality.

## Workflow

```
1. Open an issue first — even for small changes. Discuss the *why* there.
2. Branch off main. Naming: feat/<scope>, fix/<scope>, docs/<scope>, chore/<scope>
3. Commit with conventional commits: feat(core): add solo score breakdown
4. Open a draft PR early. Push frequently. Request review when ready.
5. PRs need ≥1 approval. CI green. Branch up to date with main.
```

## Coding principles

### TypeScript
- `strict: true`. No `any` without a `// HACK:` comment explaining the timeline.
- Prefer `readonly` and `interface`. Mutation is the source of half our bugs.
- Branded types for IDs (`UserId`, `ExperienceId`) — they're not interchangeable strings.

### Architecture
- `packages/core` has zero external runtime dependencies. It's the most-shared, slowest-to-change layer.
- `packages/ai` and `packages/data` import from `core`, never the reverse.
- Apps import packages, never each other.
- If you find yourself copying a type between packages, it belongs in `core`.

### Data
- Coordinates are `[lng, lat]` GeoJSON-style. **Never** mix with `[lat, lng]` Google-style.
- Times are ISO 8601 strings. UTC for storage. Local for display.
- All user-facing data carries provenance + freshness. No exceptions.

### Comments
- Explain **why**, not **what**. The code shows what.
- If you write a comment defending a decision that contradicts a brief, link to the brief and the contradiction.

## Commit messages

Conventional Commits, lowercase scope:

```
feat(core): add bestTimes window array
fix(web): prevent map jitter on geolocation refresh
docs(brief): tighten the "AI doesn't decide" section
chore(deps): bump turbo to 2.1.3
```

Subject line ≤72 chars. Body explains the why. Reference issues with `Closes #123`.

## What lives in this repo vs not

**In this repo (open source):**
- All code
- Domain schemas and design tokens
- Architecture decisions
- Aggregated documentation

**NOT in this repo (private, separate):**
- Curated seed experiences for each city
- Production prompts (the prompt engineering is competitive)
- User-generated experience corpus
- Production credentials, of course
