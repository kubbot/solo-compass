# synthesize-experiences

Server-side AI synthesis. Removes the Anthropic API key from the iOS bundle (PRD US-030 / FR-19).

## Deploy

```bash
supabase functions deploy synthesize-experiences

supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.
```

## Test

```bash
JWT=<paste a real Supabase user access token from the iOS app>
PROJECT=<your-project-ref>

cd infra/supabase/functions/synthesize-experiences
JWT="$JWT" PROJECT="$PROJECT" ./test.sh
```

Expected response on cache hit / miss:

```json
{
  "experiences": [...],
  "cached": true
}
```

Quota / entitlement errors:

| Status | Meaning |
|---|---|
| 401 | Bearer token missing / invalid |
| 402 | Caller's profiles.entitlement_tier is `free` or `pro_expired` |
| 429 | Caller has used today's 30-call quota |
| 502 | Anthropic upstream failure or invalid JSON |

## Environment

- `ANTHROPIC_API_KEY` — required, set via `supabase secrets set`
- `SUPABASE_URL` — auto-injected at runtime
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected; used to read profiles + write synthesized_experiences (bypasses RLS)

## Cost guardrails

- Daily quota 30 / Pro user, enforced via `sc_function_calls`
- Cache hits do NOT increment the quota counter
- Anthropic Console hard cap $200/month is the final safety net
