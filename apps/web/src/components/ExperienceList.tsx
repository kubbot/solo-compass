"use client";

import { useEffect, useRef } from "react";
import type { NearbyResult } from "@/app/api/experiences/nearby/route";
import { categoryEmoji } from "@/lib/category";

interface ExperienceListProps {
  readonly results: readonly NearbyResult[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onHover: (id: string | null) => void;
}

export function ExperienceList({
  results,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: ExperienceListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Scroll selected row into view when selection comes from map click
  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current.get(selectedId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  if (results.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-warm/50 px-4">
        No experiences match this filter.
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">
      {results.map((result, index) => {
        const { experience: exp } = result;
        const isSelected = exp.id === selectedId;
        const isHovered = exp.id === hoveredId;
        const isTop = index === 0;

        return (
          <button
            key={exp.id}
            ref={(el) => {
              if (el) rowRefs.current.set(exp.id, el);
              else rowRefs.current.delete(exp.id);
            }}
            type="button"
            onClick={() => onSelect(exp.id)}
            onMouseEnter={() => onHover(exp.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(exp.id)}
            onBlur={() => onHover(null)}
            className={[
              "w-full text-left px-4 py-3 border-b border-muted-road transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-deep-teal",
              isSelected
                ? "bg-deep-teal/8 border-l-2 border-l-deep-teal"
                : isHovered
                  ? "bg-ink-warm/5"
                  : "hover:bg-ink-warm/3",
            ].join(" ")}
            aria-pressed={isSelected}
          >
            <div className="flex items-start gap-2.5">
              {/* Rank number */}
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-road text-[10px] font-semibold text-ink-warm/60">
                {index + 1}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span aria-hidden="true" className="text-base leading-none">
                    {categoryEmoji[exp.category]}
                  </span>
                  <span
                    className={[
                      "truncate text-sm font-semibold leading-snug",
                      isSelected ? "text-deep-teal" : "text-ink-warm",
                    ].join(" ")}
                  >
                    {exp.title}
                  </span>
                  {isTop && (
                    <span className="shrink-0 rounded-full bg-warm-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-warm-amber">
                      Top pick
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-warm/55">
                  <span>{result.walkingMinutes} min walk</span>
                  <span aria-hidden="true">·</span>
                  {/* Solo score badge */}
                  <span className="flex items-center gap-0.5">
                    <span
                      className="rounded-full bg-deep-teal px-1.5 py-0.5 text-[10px] font-semibold text-paper-cream"
                      aria-label={`Solo score ${exp.soloScore.overall}`}
                    >
                      {exp.soloScore.overall}
                    </span>
                    <span>solo</span>
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
