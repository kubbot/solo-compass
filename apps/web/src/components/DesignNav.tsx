"use client";

/**
 * DesignNav — small top-right pill on `/` that surfaces the design-handoff
 * scenarios (research view, mobile preview, trip recap, experience deep
 * link). Lo-fi, doesn't compete with the Mapbox map.
 *
 * Dev/preview affordance, not a marketing element.
 */

import Link from "next/link";

const ITEMS = [
  { href: "/lisbon", label: "Lisbon · A" },
  { href: "/porto", label: "Porto" },
  { href: "/mobile-preview", label: "Mobile · B" },
  { href: "/trip/sofia-lisbon-may-2025", label: "Trip · C" },
  { href: "/experience/miradouro-graca", label: "Experience · D" },
] as const;

export function DesignNav() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-1">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-paper-cream/85 px-2 py-1 text-xs text-ink-warm/80 shadow ring-1 ring-ink-warm/10 backdrop-blur-md"
        aria-label="Design scenarios"
      >
        <span
          className="px-2 font-mono text-[10px] uppercase tracking-wide text-ink-warm/50"
          aria-hidden="true"
        >
          Scenarios
        </span>
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="rounded-full px-2 py-0.5 font-medium text-ink-warm transition hover:bg-ink-warm/10"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
