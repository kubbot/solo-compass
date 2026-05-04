# Architecture

## Layered diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          apps/                                    │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │   web/       │  │   ios/       │  │   bot/       │           │
│   │   Next.js    │  │   SwiftUI    │  │   Telegraf   │           │
│   └──────────────┘  └──────────────┘  └──────────────┘           │
│         │                  │                   │                  │
│         └────────┬─────────┴─────────┬─────────┘                  │
└──────────────────┼───────────────────┼────────────────────────────┘
                   │                   │
┌──────────────────▼───────────────────▼────────────────────────────┐
│                       packages/                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │   ai/        │  │   data/      │  │   ui/        │           │
│   │  prompts,    │  │  ingestion,  │  │  design      │           │
│   │  ranking,    │  │  storage,    │  │  tokens      │           │
│   │  Claude      │  │  queries     │  │  (web only)  │           │
│   └──────┬───────┘  └──────┬───────┘  └──────────────┘           │
│          │                  │                                     │
│          └────────┬─────────┘                                     │
│                   ▼                                               │
│   ┌──────────────────────────┐                                    │
│   │   core/                  │                                    │
│   │   domain types           │                                    │
│   │   Experience, Confidence │                                    │
│   │   geo primitives         │                                    │
│   │   ZERO runtime deps      │                                    │
│   └──────────────────────────┘                                    │
└───────────────────────────────────────────────────────────────────┘
                   │                   │
┌──────────────────▼───────────────────▼────────────────────────────┐
│                       External services                          │
│   Anthropic API · Mapbox · Supabase · OSM · Wikivoyage · Reddit  │
└───────────────────────────────────────────────────────────────────┘
```

## Dependency rules (enforced by review, eventually by tooling)

| Layer    | May import from | Must NOT import    |
| -------- | --------------- | ------------------ |
| `core`   | (nothing)       | anything else      |
| `ai`     | `core`          | `data`, `ui`, apps |
| `data`   | `core`          | `ai`, `ui`, apps   |
| `ui`     | `core`          | `ai`, `data`, apps |
| `apps/*` | any package     | other apps         |

The asymmetry is deliberate: `core` is the most-shared, slowest-to-change layer. `data` and `ai` are sister layers that don't talk to each other directly — they communicate via `core` types or via apps composing them.

## Why the iOS app is outside the pnpm workspace

iOS uses Swift Package Manager and Xcode project files. Mixing them into a Node monorepo is more pain than it's worth. The TypeScript `core` types are mirrored as Swift structs in `apps/ios/SoloCompassCore/`, kept in sync by:

- a `scripts/check-swift-parity.ts` script in CI (planned)
- discipline (now)

When the schema changes, the PR title must mention "schema" so the iOS dev knows to mirror.

## Data flow at runtime (Phase 2 web)

```
User opens https://solo-compass.app
  ↓
Browser geolocation: lng/lat
  ↓
[Web app]    GET /api/experiences/nearby?lng=...&lat=...
  ↓
[API route]  experiencesRepo.findNearby(coords, radius)   ← packages/data
  ↓
[Supabase]   PostGIS ST_DWithin query → 50 candidates
  ↓
[API route]  rankCandidates(candidates, userIntent)        ← packages/ai
  ↓
[Claude]     Reads candidate descriptions + user voice intent
             Returns ranked list with reasons
  ↓
[Web app]    Renders ranked experiences as map markers
             User taps one → detail card shows confidence,
             real inconveniences, how-to steps
```

The API route is thin — it composes `data` + `ai` and adds nothing of its own. This way iOS can call the same route during Phase 3.
