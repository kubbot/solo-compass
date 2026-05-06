/**
 * Open Graph image for /experience/[id].
 *
 * 1200×630 PNG card rendered via Next 15 ImageResponse at request time.
 * Next auto-wires this into the route's metadata.openGraph.images.
 *
 * No remote fonts — system fallbacks keep this fast and dependency-free.
 */

import { ImageResponse } from "next/og";
import { WEB_CATS } from "@/lib/lisbon-data";
import { findExperienceAcrossCities } from "@/lib/cities-data";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Solo Compass — Lisbon experience";

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function ExperienceOgImage({ params }: Props) {
  const { id } = await params;
  const found = findExperienceAcrossCities(id);
  if (!found) {
    return new ImageResponse(
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
      </div>,
      size,
    );
  }

  const { exp, city } = found;
  const cat = WEB_CATS[exp.cat];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#FBF7F0",
        color: "#1A1612",
        fontFamily: "sans-serif",
        padding: 72,
        position: "relative",
      }}
    >
      {/* Category color wash */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: `linear-gradient(180deg, ${cat.color}1F, transparent)`,
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: cat.color,
          }}
        />
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: cat.color,
          }}
        >
          {cat.en} · {city.en}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 84,
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: -2,
          marginBottom: 24,
          color: "#1A1612",
          zIndex: 1,
          display: "flex",
        }}
      >
        {exp.titleZh}
      </div>

      {/* English subtitle */}
      <div
        style={{
          fontSize: 36,
          color: "#5C4F3E",
          fontStyle: "italic",
          lineHeight: 1.2,
          marginBottom: 48,
          zIndex: 1,
          display: "flex",
        }}
      >
        {exp.title}
      </div>

      <div style={{ flex: 1 }} />

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingTop: 28,
          borderTop: "1px solid #E5DDCD",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: "linear-gradient(135deg, #FFE7C4, #C98628)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 18,
            fontSize: 22,
            color: "#FFF",
          }}
        >
          ✦
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1612",
            }}
          >
            {exp.place} · {exp.neighborhood}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#A39F99",
              marginTop: 4,
            }}
          >
            compass.io / {city.slug} / {exp.id}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#A39F99",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Solo Compass
          </div>
          <div
            style={{
              fontSize: 16,
              color: "#A39F99",
              marginTop: 4,
            }}
          >
            {exp.walkMin} min walk · {exp.pricePill}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
