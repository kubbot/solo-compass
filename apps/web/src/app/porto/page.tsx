/**
 * Porto — minimal city index (server component).
 *
 * Placeholder until the full research view is generalized from `/lisbon`.
 * Lists the seeded Porto experiences with deep links and points back to
 * the Lisbon research view for the full UX.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { findCity, WEB_CATS } from "@/lib/cities-data";

const FONT_DISPLAY =
  '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
const FONT_CN = '"PingFang SC", "Hiragino Sans GB", system-ui, sans-serif';

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Lang = "zh" | "en";

function resolveLang(
  searchParams: Record<string, string | string[] | undefined>,
): Lang {
  const v = searchParams.lang;
  const single = Array.isArray(v) ? v[0] : v;
  return single === "en" ? "en" : "zh";
}

export const metadata: Metadata = {
  title: "Porto — Solo Compass",
  description:
    "A river, six bridges, and a wine that takes its name from the city.",
  alternates: {
    languages: { en: "/porto?lang=en", zh: "/porto" },
  },
};

export default async function PortoPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const lang = resolveLang(sp);
  const city = findCity("porto");
  if (!city) return null;
  const fontStack = lang === "zh" ? FONT_CN : FONT_DISPLAY;

  const T =
    lang === "zh"
      ? {
          eyebrow: "波尔图 · 葡萄牙",
          intro: city.taglineZh,
          experiences: "正在收录的体验",
          mapHint: "完整研究视图正在迁移；点击任一体验先看详情。",
          backHome: "回到首页",
          openLisbon: "看 里斯本 全景视图 →",
          mins: "分钟",
        }
      : {
          eyebrow: "Porto · Portugal",
          intro: city.tagline,
          experiences: "Experiences in progress",
          mapHint:
            "Full research view is being generalized; tap any experience for the deep link.",
          backHome: "Back to home",
          openLisbon: "See the full Lisbon view →",
          mins: "min",
        };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-warm)",
        padding: "56px 24px 80px",
        fontFamily: fontStack,
        color: "var(--fg-primary)",
      }}
    >
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href={`/${lang === "en" ? "?lang=en" : ""}`}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: "var(--fg-muted)",
            textDecoration: "none",
            letterSpacing: 0.5,
          }}
        >
          ← {T.backHome}
        </Link>

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: "var(--fg-subtle)",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          {T.eyebrow}
        </div>
        <h1
          style={{
            fontFamily: lang === "zh" ? FONT_CN : "var(--font-serif)",
            fontSize: lang === "zh" ? 40 : 48,
            fontWeight: lang === "zh" ? 600 : 400,
            fontStyle: lang === "zh" ? "normal" : "italic",
            lineHeight: 1.05,
            letterSpacing: lang === "zh" ? "-0.4px" : "-1.2px",
            margin: "0 0 14px",
          }}
        >
          {lang === "zh" ? city.zh : city.en}
        </h1>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--fg-muted)",
            margin: "0 0 32px",
            maxWidth: 560,
          }}
        >
          {T.intro}
        </p>

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: "var(--fg-subtle)",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {T.experiences} · {city.experiences.length}
        </div>
        <div
          style={{
            fontFamily: fontStack,
            fontSize: 13,
            color: "var(--fg-muted)",
            marginBottom: 18,
          }}
        >
          {T.mapHint}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {city.experiences.map((e) => {
            const cat = WEB_CATS[e.cat];
            const title = lang === "zh" ? e.titleZh : e.title;
            const place = lang === "zh" ? e.placeZh : e.place;
            return (
              <Link
                key={e.id}
                href={`/experience/${e.id}${lang === "en" ? "?lang=en" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 6px",
                  borderBottom: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: cat.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: lang === "zh" ? FONT_CN : FONT_DISPLAY,
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.35,
                      color: "var(--fg-primary)",
                      letterSpacing: lang === "zh" ? "0.1px" : "-0.2px",
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontFamily: fontStack,
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      marginTop: 3,
                    }}
                  >
                    {place} · {e.neighborhood}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    color: "var(--fg-subtle)",
                  }}
                >
                  {e.walkMin} {T.mins}
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          href={`/lisbon${lang === "en" ? "?lang=en" : ""}`}
          style={{
            display: "inline-block",
            marginTop: 32,
            padding: "10px 16px",
            borderRadius: 6,
            background: "var(--accent)",
            color: "#FFF7EA",
            fontFamily: fontStack,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {T.openLisbon}
        </Link>
      </article>
    </main>
  );
}
