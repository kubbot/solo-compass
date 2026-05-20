# Solo Compass API

Go service that provides the RAG (retrieval-augmented generation) pipeline for Solo Compass. It aggregates real user reviews into Solo Score calculations and exposes them to the mobile app.

## Purpose

- Persist and query per-experience reviews from a PostgreSQL database.
- Compute aggregate Solo Scores from real review data.
- Serve as the home for future AI enrichment pipelines (embedding search, re-ranking).

## Endpoints

| Method | Path                             | Description                                                                                                        |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | `/healthz`                       | Health check — always returns `{"status":"ok"}`, no DB dependency.                                                 |
| GET    | `/v1/experiences/:id/solo-score` | Returns the aggregate solo score and review count for an experience. Returns 503 when the database is unavailable. |

## Environment variables

| Variable       | Default  | Description                                                                               |
| -------------- | -------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL` | _(none)_ | PostgreSQL DSN (`postgres://user:pass@host/db`). When absent, `/v1` endpoints return 503. |
| `PORT`         | `8080`   | TCP port the server listens on.                                                           |

## Running locally

```bash
# From the repo root:
make -C apps/api api-run

# Or from apps/api/:
make api-run
```

## Docker

```bash
docker build -t solo-compass-api apps/api
docker run -p 8080:8080 -e DATABASE_URL=postgres://... solo-compass-api
```

## Tests

```bash
cd apps/api
go test ./...
```
