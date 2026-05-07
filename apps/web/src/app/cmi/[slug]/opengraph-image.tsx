import { ImageResponse } from "next/og";
import { demoExperiences } from "@/data/demo-experiences";
import { categoryEmoji, categoryLabel } from "@/lib/category";
import { idFromSlug } from "@/components/SEOExperience";

export const runtime = "edge";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const exp = demoExperiences.find((e) => e.id === id);

  const title = exp?.title ?? "Chiang Mai experience";
  const oneLiner = exp?.oneLiner ?? "";
  const category = exp?.category ?? "culture";
  const score = exp?.soloScore.overall ?? 0;
  const emoji = categoryEmoji[category];
  const label = categoryLabel[category];

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F5F1E8",
        padding: "64px",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Top band */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          backgroundColor: "#2F6B6B",
        }}
      />

      {/* Category + city */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(47,107,107,0.12)",
            borderRadius: "999px",
            padding: "6px 16px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#2F6B6B",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <span>{emoji}</span>
          <span>{label}</span>
        </div>
        <span style={{ fontSize: "13px", color: "#2C2A2699", fontWeight: 500 }}>
          Chiang Mai · Solo Compass
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "52px",
          fontWeight: 800,
          color: "#2C2A26",
          lineHeight: 1.15,
          flex: 1,
          maxWidth: "900px",
        }}
      >
        {title}
      </div>

      {/* One-liner */}
      <div
        style={{
          fontSize: "22px",
          color: "#2C2A26AA",
          lineHeight: 1.4,
          maxWidth: "820px",
          marginBottom: "32px",
        }}
      >
        {oneLiner.length > 100 ? oneLiner.slice(0, 99) + "…" : oneLiner}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "#2F6B6B",
            }}
          >
            {score}
          </span>
          <span style={{ fontSize: "15px", color: "#2C2A2680" }}>/ 10 solo score</span>
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#2F6B6B",
            letterSpacing: "-0.01em",
          }}
        >
          solocompass.app
        </div>
      </div>

      {/* Bottom accent */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4px",
          backgroundColor: "#C68E3F",
        }}
      />
    </div>,
    { ...size },
  );
}
