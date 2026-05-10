#!/usr/bin/env bash
# Curl-based integration smoke test. Requires JWT (Supabase user
# access token) and PROJECT (project ref) in env.

set -euo pipefail

: "${JWT:?Set JWT to a valid Supabase user access token}"
: "${PROJECT:?Set PROJECT to your Supabase project ref}"

URL="https://${PROJECT}.functions.supabase.co/synthesize-experiences"

# A two-POI sample request. cacheKey would normally be the SHA256 of
# the canonical input batch from iOS; here it's a synthetic value so
# we can verify the cache hit path on a second invocation.
BODY=$(cat <<'JSON'
{
  "pois": [
    {
      "osmId": 999000001,
      "name": "Test Cafe",
      "nameEn": "Test Cafe",
      "lat": 21.0285,
      "lon": 105.8542,
      "tags": {"amenity": "cafe"}
    }
  ],
  "cityCode": "vn-hanoi",
  "locale": "en",
  "cacheKey": "test-cache-key-do-not-collide"
}
JSON
)

echo "→ POST $URL"
curl -fsSL "$URL" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  --data "$BODY" | python3 -m json.tool
