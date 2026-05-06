"use client";

/**
 * CommandPalette — ⌘K / Ctrl+K modal for jumping across the four web
 * scenarios and any Lisbon experience deep link.
 *
 * Intentionally simple: keyboard nav (↑/↓/Enter/Esc), substring match
 * across (zh+en) titles + place names, single column. No fuzzy ranking,
 * no third-party cmdk dep.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WEB_CATS,
  type WebExperience,
} from "@/lib/lisbon-data";
import { CITIES, CITY_ORDER } from "@/lib/cities-data";
import { TRIPS } from "@/lib/trips-data";

const FONT_DISPLAY =
  '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
const FONT_CN = '"PingFang SC", "Hiragino Sans GB", system-ui, sans-serif';

type Lang = "zh" | "en";

interface PaletteItem {
  readonly id: string;
  readonly kind: "scenario" | "experience" | "trip";
  readonly title: string;
  readonly subtitle: string;
  readonly hint: string;
  readonly href: string;
  readonly accent: string;
}

function buildItems(lang: Lang): readonly PaletteItem[] {
  const langSuffix = lang === "en" ? "?lang=en" : "";

  const scenarios: PaletteItem[] = [
    {
      id: "scenario-home",
      kind: "scenario",
      title: lang === "zh" ? "首页（手机地图）" : "Home — mobile map",
      subtitle: "/",
      hint: "Scenario · /",
      href: "/",
      accent: "#C98628",
    },
    {
      id: "scenario-lisbon",
      kind: "scenario",
      title: lang === "zh" ? "里斯本研究视图" : "Lisbon research view",
      subtitle: "/lisbon",
      hint: "Scenario A · desktop",
      href: `/lisbon${langSuffix}`,
      accent: "#C98628",
    },
    {
      id: "scenario-porto",
      kind: "scenario",
      title: lang === "zh" ? "波尔图（预览）" : "Porto (preview)",
      subtitle: "/porto",
      hint: "City · index",
      href: `/porto${langSuffix}`,
      accent: "#A66A00",
    },
    {
      id: "scenario-mobile-preview",
      kind: "scenario",
      title: lang === "zh" ? "手机浏览器预览" : "Mobile preview",
      subtitle: "/mobile-preview",
      hint: "Scenario B · 390 × 844",
      href: `/mobile-preview${langSuffix}`,
      accent: "#3F4B7A",
    },
    {
      id: "scenario-trip",
      kind: "scenario",
      title: lang === "zh" ? "旅程回顾示例" : "Trip recap sample",
      subtitle: "/trip/sofia-lisbon-may-2025",
      hint: "Scenario C · share",
      href: `/trip/sofia-lisbon-may-2025${langSuffix}`,
      accent: "#4C7A3F",
    },
  ];

  const experiences: PaletteItem[] = CITY_ORDER.flatMap((slug) => {
    const city = CITIES[slug];
    if (!city) return [];
    return city.experiences.map((e) => {
      const cat = WEB_CATS[e.cat];
      const title = lang === "zh" ? e.titleZh : e.title;
      const place = lang === "zh" ? e.placeZh : e.place;
      const cityLabel = lang === "zh" ? city.zh : city.en;
      return {
        id: `exp-${e.id}`,
        kind: "experience" as const,
        title,
        subtitle: `${place} · ${e.neighborhood} · ${cityLabel}`,
        hint: cat.short,
        href: `/experience/${e.id}${langSuffix}`,
        accent: cat.color,
      };
    });
  });

  const trips: PaletteItem[] = Object.values(TRIPS).map((t) => ({
    id: `trip-${t.slug}`,
    kind: "trip" as const,
    title: lang === "zh" ? t.titleZh : t.titleEn,
    subtitle: `${t.author} · ${lang === "zh" ? t.monthLabelZh : t.monthLabel}`,
    hint: lang === "zh" ? "回顾" : "recap",
    href: `/trip/${t.slug}${langSuffix}`,
    accent: "#4C7A3F",
  }));

  return [...scenarios, ...experiences, ...trips];
}

function matches(
  item: PaletteItem,
  exp: WebExperience | undefined,
  q: string,
): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  const fields = [
    item.title,
    item.subtitle,
    item.hint,
    exp?.title,
    exp?.titleZh,
    exp?.place,
    exp?.placeZh,
    exp?.neighborhood,
  ];
  return fields.some((f) => f && f.toLowerCase().includes(lower));
}

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly lang: Lang;
}

export function CommandPalette({ open, onOpenChange, lang }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const items = useMemo(() => buildItems(lang), [lang]);
  const expById = useMemo(() => {
    const map = new Map<string, WebExperience>();
    for (const slug of CITY_ORDER) {
      const city = CITIES[slug];
      if (!city) continue;
      for (const e of city.experiences) map.set(e.id, e);
    }
    return map;
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const expId = it.kind === "experience" ? it.id.replace(/^exp-/, "") : "";
      return matches(it, expById.get(expId), query);
    });
  }, [items, expById, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Global ⌘K toggle + in-modal nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        const target = filtered[activeIdx];
        if (target) {
          e.preventDefault();
          onOpenChange(false);
          router.push(target.href);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, filtered, activeIdx, router]);

  if (!open) return null;

  const fontStack = lang === "zh" ? FONT_CN : FONT_DISPLAY;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(8,6,4,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(21,17,13,0.96)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: "0.5px solid var(--dark-border-strong)",
          borderRadius: 12,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(229,205,160,0.06) inset",
          overflow: "hidden",
          fontFamily: fontStack,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--dark-border)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="#A89377" strokeWidth="1.4" />
            <path
              d="M9 9 L13 13"
              stroke="#A89377"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === "zh"
                ? "搜场景、体验、城市…"
                : "Search scenarios, experiences, cities…"
            }
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--dark-fg)",
              fontFamily: fontStack,
              fontSize: 15,
              padding: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              color: "var(--dark-fg-faint)",
              padding: "2px 6px",
              border: "0.5px solid var(--dark-border-strong)",
              borderRadius: 4,
            }}
          >
            ESC
          </span>
        </div>

        <div
          className="lc-scroll"
          style={{ maxHeight: 380, overflow: "auto", padding: "6px 0" }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                padding: "22px 18px",
                fontFamily: fontStack,
                fontSize: 13,
                color: "var(--dark-fg-subtle)",
                textAlign: "center",
              }}
            >
              {lang === "zh" ? "没有匹配项" : "No matches"}
            </div>
          )}
          {filtered.map((it, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={it.id}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  onOpenChange(false);
                  router.push(it.href);
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  paddingLeft: active ? 14 : 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: active ? "var(--dark-surface-hover)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  borderLeft: active
                    ? `2px solid ${it.accent}`
                    : "2px solid transparent",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: it.accent,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: fontStack,
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--dark-fg)",
                      letterSpacing: lang === "zh" ? "0.1px" : "-0.2px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {it.title}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10.5,
                      color: "var(--dark-fg-subtle)",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {it.subtitle}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    color: "var(--dark-fg-faint)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    border: "0.5px solid var(--dark-border-strong)",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  {it.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "8px 16px",
            borderTop: "1px solid var(--dark-border)",
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            color: "var(--dark-fg-faint)",
            letterSpacing: 0.4,
          }}
        >
          <span>↑↓ {lang === "zh" ? "导航" : "navigate"}</span>
          <span style={{ color: "var(--dark-border-strong)" }}>·</span>
          <span>↵ {lang === "zh" ? "跳转" : "go"}</span>
          <span style={{ flex: 1 }} />
          <span>{CITY_ORDER.length} cities</span>
        </div>
      </div>
    </div>
  );
}
