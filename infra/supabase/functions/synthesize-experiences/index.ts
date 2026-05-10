// Edge Function: synthesize-experiences
// Epic E US-030 — server-side AI synthesis so the iOS bundle never
// contains an Anthropic API key.
//
// Flow:
//   1. Verify Supabase JWT from Authorization header.
//   2. Look up profiles.entitlement_tier; free tier rejected with 402.
//   3. Rate-limit: count today's calls in sc_function_calls; cap at 30.
//   4. Read SHA256 cache key from body; if synthesized_experiences row
//      exists, return it without calling Anthropic.
//   5. Call Anthropic Sonnet 4.6 with the prompt + POI batch.
//   6. Validate response shape, write to synthesized_experiences,
//      return to client.
//
// Deploy: `supabase functions deploy synthesize-experiences`
// Required secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const DAILY_QUOTA_PRO = 30;

interface POI {
  osmId: number;
  name: string;
  nameEn?: string | null;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface RequestBody {
  pois: POI[];
  cityCode: string;
  locale: string;
  cacheKey: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // 1. Auth: extract user_id from JWT in Authorization header.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer /i, "");
  if (!jwt) return json({ error: "missing bearer token" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Verify JWT and extract user_id.
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "invalid jwt" }, 401);
  const userId = userData.user.id;

  // 2. Entitlement check.
  const { data: profile } = await admin
    .from("profiles")
    .select("entitlement_tier")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = profile?.entitlement_tier ?? "free";
  if (tier === "free" || tier === "pro_expired") {
    return json({ error: "subscription required" }, 402);
  }

  // 3. Rate-limit: today's call count.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("sc_function_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("function_name", "synthesize-experiences")
    .gte("called_at", dayStart.toISOString());
  if ((count ?? 0) >= DAILY_QUOTA_PRO) {
    return json({ error: "daily quota exceeded", quota: DAILY_QUOTA_PRO }, 429);
  }

  // 4. Parse + cache check.
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.cacheKey || !Array.isArray(body.pois) || body.pois.length === 0) {
    return json({ error: "cacheKey + non-empty pois required" }, 400);
  }
  if (body.pois.length > 15) {
    return json({ error: "max 15 POIs per call" }, 400);
  }

  const { data: cached } = await admin
    .from("synthesized_experiences")
    .select("payload")
    .eq("source_cache_key", body.cacheKey)
    .limit(1)
    .maybeSingle();
  if (cached?.payload) {
    return json({ experiences: cached.payload, cached: true });
  }

  // 5. Call Anthropic.
  const prompt = buildPrompt(body);
  const anthropicReq = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!anthropicReq.ok) {
    const text = await anthropicReq.text();
    return json({ error: `anthropic error ${anthropicReq.status}: ${text}` }, 502);
  }
  const anthropicJson = await anthropicReq.json();
  const text: string = anthropicJson?.content?.[0]?.text ?? "";

  // 6. Validate response shape.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    return json({ error: "anthropic returned no JSON array" }, 502);
  }
  let items: unknown;
  try {
    items = JSON.parse(text.substring(start, end + 1));
  } catch {
    return json({ error: "anthropic returned invalid JSON" }, 502);
  }
  if (!Array.isArray(items)) {
    return json({ error: "anthropic returned non-array" }, 502);
  }
  for (const item of items as Record<string, unknown>[]) {
    if (
      typeof item.osmId !== "number" ||
      typeof item.title !== "string" ||
      typeof item.oneLiner !== "string" ||
      typeof item.whyItMatters !== "string" ||
      typeof item.category !== "string"
    ) {
      return json({ error: "anthropic item missing required fields" }, 502);
    }
  }

  // Write to cache and accounting tables.
  await admin.from("synthesized_experiences").upsert({
    id: `exp_osm_${(items as Record<string, unknown>[])[0].osmId}`,
    city_code: body.cityCode,
    payload: items,
    model_name: MODEL,
    source_cache_key: body.cacheKey,
  });
  await admin.from("sc_function_calls").insert({
    user_id: userId,
    function_name: "synthesize-experiences",
  });

  return json({ experiences: items, cached: false });
});

function buildPrompt(body: RequestBody): string {
  const lines = body.pois
    .map(
      (p) =>
        `- osmId=${p.osmId} name="${p.name}" nameEn="${p.nameEn ?? p.name}" lat=${p.lat} lon=${p.lon} tags=${JSON.stringify(p.tags)}`,
    )
    .join("\n");
  return `You are writing solo-traveler-focused entries for real OpenStreetMap places.

CRITICAL: Use ONLY the provided OSM tags. Do NOT invent menu items, hours, prices, owner backstories, or seating positions.

For each POI, return a JSON object with: osmId(int), title, oneLiner, whyItMatters, category(food|coffee|culture|nature|work|wellness|nightlife|hidden), bestStartHour(0-23), bestEndHour(0-23), durationMinMinutes(int), durationMaxMinutes(int), howTo(string[] navigation only), soloHint, soloOverall(6.0-9.5).

Output a JSON array, one object per POI, in input order. No prose, no markdown fences.

Output language: ${body.locale}.
City code: ${body.cityCode}.

POIs:
${lines}`;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
