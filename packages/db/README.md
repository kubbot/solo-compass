# @solo-compass/db

Drizzle ORM schema and migrations for the Solo Compass Postgres database.

## Setup

### Start the database

```bash
pnpm db:up
```

This starts `postgres:16` with PostGIS 3.4 via Docker Compose (defined at the repo root). Default connection: `postgres://solo:solo@localhost:5432/solocompass`.

### Run migrations

```bash
pnpm db:migrate
```

Applies all pending SQL migrations from `./migrations/` to the database.

### Generate migrations after schema changes

```bash
pnpm db:generate
```

Diffs `./src/schema/` against the database and writes a new migration file to `./migrations/`.

## Environment

Set `DATABASE_URL` to override the default connection string:

```
DATABASE_URL=postgres://user:pass@host:5432/dbname
```
