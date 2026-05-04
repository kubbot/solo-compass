# apps/web · Pre-MVP

> Next.js + Mapbox GL. The 4-week validation harness.

## Why this exists

Before writing 3 months of native iOS, validate the core hypothesis with a web prototype that costs 4 weeks. See [`docs/PHASES.md`](../../docs/PHASES.md) for the reasoning.

**This app deliberately doesn't do background GPS.** Users tap "I'm here" manually. We test the *content* and *recommendation* layer; native phase tests the *automation* layer.

## Status

🚧 Not started yet. Starts after Phase 0 (field week).

## Stack (target)

- Next.js 15 (App Router, RSC)
- Mapbox GL JS
- Tailwind + shadcn/ui
- Supabase client (auth + data)
- `@solo-compass/core` for types
- `@solo-compass/ai` for recommendations
- Vercel for deploy

## Development

```bash
# from repo root
pnpm install
pnpm --filter @solo-compass/web dev
```

Open http://localhost:3000.
