# @solo-compass/data

Data layer: ingestion, storage, query.

## Responsibilities

- **Ingestion** from open sources (OSM via Overpass, Wikivoyage MediaWiki API, Reddit, YouTube transcripts)
- **Schema** for Postgres + PostGIS (Supabase migration files)
- **Repositories**: `ExperienceRepo`, `UserRepo`, `CompletionRepo` — typed query interfaces
- **Cold-start seeders** that populate a new city to ~50 experiences

## What does NOT live here

- AI generation logic (that's `packages/ai`)
- Domain types (those are `packages/core`)

## Status

🚧 Skeleton only.

## Cold-start workflow (target)

```bash
# 1. Pull all OSM POI data for a city (free, offline)
pnpm tsx scripts/ingest-osm.ts --city cmi

# 2. Pull Wikivoyage article + extract listings
pnpm tsx scripts/ingest-wikivoyage.ts --city cmi

# 3. Pull Reddit threads matching city + relevant subs
pnpm tsx scripts/ingest-reddit.ts --city cmi

# 4. Run AI structuring pipeline → Experience candidates
pnpm tsx scripts/ai-structure-experiences.ts --city cmi --target 50

# 5. Field-verify top 20 (manual)
# 6. Push to Supabase
pnpm tsx scripts/seed-supabase.ts --city cmi
```
