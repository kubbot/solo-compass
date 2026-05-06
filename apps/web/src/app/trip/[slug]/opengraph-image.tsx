/**
 * Open Graph image for /trip/[slug].
 *
 * 1200×630 PNG card rendered via Next 15 ImageResponse at request time.
 * Next auto-wires this into the route's metadata.openGraph.images.
 */

import { ImageResponse } from "next/og";
import { findTripBySlug } from "@/lib/trips-data";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Solo Compass — trip recap";

interface Props {
  readonly params: Promise<{ slug: string }>;
}

export default async function TripOgImage({ params }: Props) {
  const { slug } = await params;
  const trip = findTripBySlug(slug);
  if (!trip) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FBF7F0",
            color: "#1A1612",
            fontFamily: "sans-serif",
            fontSize: 48,
          }}
        >
          Solo Compass
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#F8F4ED",
          color: "#1A1612",
          fontFamily: "sans-serif",
          padding: 72,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: "#C98628",
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#A66A00",
            }}
          >
            {trip.author} · {trip.monthLabel}
          </div>
        </div>

        <div
          style={{
            fontSize: 92,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            marginBottom: 28,
            color: "#1A1612",
            display: "flex",
          }}
        >
          {trip.titleZh}
        </div>

        <div
          style={{
            fontSize: 38,
            color: "#5C4F3E",
            fontStyle: "italic",
            lineHeight: 1.2,
            marginBottom: 48,
            display: "flex",
          }}
        >
          {trip.titleEn}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            paddingTop: 24,
            paddingBottom: 28,
            borderTop: "1px solid #E5DDCD",
            borderBottom: "1px solid #E5DDCD",
            marginBottom: 24,
          }}
        >
          {[
            { label: "WALKED", value: `${trip.stats.walkedKm} km` },
            { label: "PLACES", value: String(trip.stats.places) },
            { label: "DAYS", value: String(trip.days.length) },
            { label: "FAVORITE", value: trip.stats.favorite },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                paddingLeft: i === 0 ? 0 : 24,
                borderLeft: i > 0 ? "1px solid #E5DDCD" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  color: "#A39F99",
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: "#1A1612",
                  fontWeight: 600,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "linear-gradient(135deg, #FFE7C4, #C98628)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFF",
              fontSize: 18,
            }}
          >
            ✦
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#A39F99",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Solo Compass · trip recap
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 16, color: "#A39F99" }}>
            compass.io / {trip.slug}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
