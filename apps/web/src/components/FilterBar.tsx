"use client";

import type { ExperienceCategory } from "@solo-compass/core";
import { categoryEmoji, categoryLabel } from "@/lib/category";

export type FilterValue = ExperienceCategory | "now" | "all";

const FILTERS: { value: FilterValue; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "🗺️" },
  { value: "now", label: "Open now", emoji: "🕐" },
  { value: "culture", label: categoryLabel.culture, emoji: categoryEmoji.culture },
  { value: "nature", label: categoryLabel.nature, emoji: categoryEmoji.nature },
  { value: "food", label: categoryLabel.food, emoji: categoryEmoji.food },
  { value: "coffee", label: categoryLabel.coffee, emoji: categoryEmoji.coffee },
  { value: "work", label: categoryLabel.work, emoji: categoryEmoji.work },
  { value: "wellness", label: categoryLabel.wellness, emoji: categoryEmoji.wellness },
  { value: "nightlife", label: categoryLabel.nightlife, emoji: categoryEmoji.nightlife },
  { value: "hidden", label: categoryLabel.hidden, emoji: categoryEmoji.hidden },
];

interface FilterBarProps {
  readonly value: FilterValue;
  readonly onChange: (value: FilterValue) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-muted-road">
      {FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            className={[
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              "border focus:outline-none focus:ring-2 focus:ring-deep-teal focus:ring-offset-1",
              active
                ? "bg-deep-teal text-paper-cream border-deep-teal"
                : "bg-paper-cream text-ink-warm border-muted-road hover:border-ink-warm/40",
            ].join(" ")}
            aria-pressed={active}
          >
            <span aria-hidden="true">{f.emoji}</span>
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
