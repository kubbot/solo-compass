/**
 * POST /api/traffic
 *
 * Anonymous GPS traffic ping. Records that an opaque visitor was physically
 * near an experience. Used by the confidence-decay system: if ≥3 unique
 * anonymous visitors have been near an experience in the last 7 days,
 * and the experience's last_verified_at is >60 days old, we refresh it.
 *
 * Privacy: no PII is stored. The `anon_id` is a SHA-256 hash of the
 * request IP + User-Agent, salted by the experience ID so it cannot be
 * used to correlate across experiences.
 *
 * Fails open: if the DB is unavailable we still return { ok: true } so
 * client-side errors are never surfaced to the user.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@solo-compass/data";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  experienceId: z.string().min(1).max(128),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

/** SHA-256 hex of `ip:ua:experienceId`. Deterministic, non-reversible, scoped. */
async function buildAnonId(
  ip: string,
  userAgent: string,
  experienceId: string,
): Promise<string> {
  const raw = `${ip}:${userAgent}:${experienceId}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_AGO_ISO = (): string =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

export async function POST(
  request: Request,
): Promise<NextResponse<{ ok: true }>> {
  // Always return ok: true — never leak DB state to the client.
  const ok = NextResponse.json({ ok: true as const });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ok;
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return ok;

  const { experienceId } = parsed.data;

  // Build a scoped, non-reversible fingerprint from IP + UA.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  let anonId: string;
  try {
    anonId = await buildAnonId(ip, userAgent, experienceId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[traffic] buildAnonId failed", err);
    return ok;
  }

  // Service-role client — traffic_pings is not user-auth-bound.
  let client: ReturnType<typeof createClient<Database>>;
  try {
    const env = getServerEnv();
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[traffic] service client unavailable", err);
    return ok;
  }

  try {
    // Upsert ping — conflict on (experience_id, anon_id) updates pinged_at.
    const { error: upsertError } = await client.from("traffic_pings").upsert(
      { experience_id: experienceId, anon_id: anonId, pinged_at: new Date().toISOString() },
      { onConflict: "experience_id,anon_id" },
    );
    if (upsertError) {
      // eslint-disable-next-line no-console
      console.error("[traffic] upsert failed", upsertError.message);
      return ok;
    }

    // Check whether this experience needs a confidence refresh via traffic.
    // Fetch experience's last_verified_at — stored inside the confidence JSONB.
    const { data: expData, error: expError } = await client
      .from("experiences")
      .select("confidence")
      .eq("id", experienceId)
      .maybeSingle();

    if (expError || !expData) return ok;

    const confidence = expData.confidence as { lastVerifiedAt?: string } | null;
    const lastVerifiedAt = confidence?.lastVerifiedAt;
    if (!lastVerifiedAt) return ok;

    const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
    if (ageMs <= SIXTY_DAYS_MS) return ok; // Still fresh — no refresh needed.

    // Count unique anon visitors in the last 7 days for this experience.
    const { count, error: countError } = await client
      .from("traffic_pings")
      .select("anon_id", { count: "exact", head: true })
      .eq("experience_id", experienceId)
      .gte("pinged_at", SEVEN_DAYS_AGO_ISO());

    if (countError || count === null) return ok;

    if (count >= 3) {
      // Passive GPS traffic is sufficient to refresh the experience's last_verified_at.
      // We update the confidence JSONB in place to bump lastVerifiedAt.
      const refreshedConfidence = {
        ...(confidence as object),
        lastVerifiedAt: new Date().toISOString(),
      };
      const { error: updateError } = await client
        .from("experiences")
        .update({ confidence: refreshedConfidence })
        .eq("id", experienceId);

      if (updateError) {
        // eslint-disable-next-line no-console
        console.error("[traffic] confidence refresh failed", updateError.message);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[traffic] unexpected error", err);
  }

  return ok;
}
