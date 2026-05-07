import type { Experience, ExperienceCategory, TimeWindow } from "@solo-compass/core";
import { categoryEmoji, categoryLabel } from "@/lib/category";

// ─── helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function readingMinutes(exp: Experience): number {
  const wordCount =
    (exp.whyItMatters?.split(" ").length ?? 0) +
    exp.howTo.reduce((n, s) => n + s.text.split(" ").length, 0) +
    exp.realInconveniences.reduce((n, r) => n + r.text.split(" ").length, 0);
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function slugFromId(id: string): string {
  // exp_cmi_suan_dok_sunset → suan-dok-sunset
  return id.replace(/^exp_[a-z]+_/, "").replaceAll("_", "-");
}

export function idFromSlug(slug: string): string {
  return "exp_cmi_" + slug.replaceAll("-", "_");
}

export function experiencePageTitle(exp: Experience): string {
  return `${exp.title} · Chiang Mai · Solo Compass`;
}

export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function formatTimeWindow(t: TimeWindow): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const window = `${pad(t.startHour)}:00–${pad(t.endHour)}:00`;
  const days =
    t.dayOfWeek && t.dayOfWeek.length > 0 ? t.dayOfWeek.map((d) => DAY_NAMES[d]).join(", ") : null;
  const note = t.note ?? null;
  return [window, days, note ? `(${note})` : null].filter(Boolean).join(" · ");
}

// ─── category badge ──────────────────────────────────────────────────────────

export function CategoryBadge({ category }: { readonly category: ExperienceCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-deep-teal">
      <span aria-hidden="true">{categoryEmoji[category]}</span>
      {categoryLabel[category]}
    </span>
  );
}

// ─── solo score pill ─────────────────────────────────────────────────────────

export function SoloScorePill({ score }: { readonly score: number }) {
  const color =
    score >= 9
      ? "bg-soft-green/30 text-deep-teal"
      : score >= 7
        ? "bg-warm-amber/20 text-warm-amber"
        : "bg-muted-road/40 text-ink-warm/70";
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full px-3 py-1 text-xs font-semibold ${color}`}
    >
      <span className="text-sm font-bold">{score}</span>
      <span className="font-normal opacity-70">/ 10 solo</span>
    </span>
  );
}

// ─── section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-warm/50">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── when to go widget ───────────────────────────────────────────────────────

function WhenToGo({ bestTimes }: { readonly bestTimes: readonly TimeWindow[] }) {
  if (bestTimes.length === 0) return null;
  return (
    <Section title="When to go">
      <ul className="space-y-1.5">
        {bestTimes.map((t, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-ink-warm/80">
            <span className="text-base" aria-hidden="true">
              🕐
            </span>
            {formatTimeWindow(t)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─── main SEO experience page component ────────────────────────────────────

interface SEOExperienceProps {
  readonly experience: Experience;
  readonly relatedExperiences?: readonly Experience[];
}

export function SEOExperience({ experience: exp, relatedExperiences = [] }: SEOExperienceProps) {
  const mins = readingMinutes(exp);

  return (
    <article className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-ink-warm/50">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <a href="/" className="hover:text-deep-teal hover:underline">
              Solo Compass
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <a href="/cmi" className="hover:text-deep-teal hover:underline">
              Chiang Mai
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <a
              href={`/cmi/category/${exp.category}`}
              className="hover:text-deep-teal hover:underline capitalize"
            >
              {categoryLabel[exp.category]}
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li className="text-ink-warm/70 truncate max-w-[200px]">{exp.title}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={exp.category} />
          <SoloScorePill score={exp.soloScore.overall} />
          <span className="text-xs text-ink-warm/50">
            {exp.durationMinutes.min === exp.durationMinutes.max
              ? `${exp.durationMinutes.min} min`
              : `${exp.durationMinutes.min}–${exp.durationMinutes.max} min`}
          </span>
          <span className="text-xs text-ink-warm/50">· {mins} min read</span>
        </div>

        <h1 className="mb-3 text-2xl font-bold leading-snug text-ink-warm md:text-3xl">
          {exp.title}
        </h1>
        <p className="text-base leading-relaxed text-ink-warm/80 md:text-lg">{exp.oneLiner}</p>

        {exp.location.placeNameRomanized && (
          <p className="mt-2 text-sm text-ink-warm/50">
            📍 {exp.location.placeNameRomanized}
            {exp.location.addressHint ? ` · ${exp.location.addressHint}` : ""}
          </p>
        )}
      </header>

      {/* Why it matters */}
      <Section title="Why it matters">
        <p className="text-sm leading-relaxed text-ink-warm/80">{exp.whyItMatters}</p>
      </Section>

      {/* When to go */}
      <WhenToGo bestTimes={exp.bestTimes} />

      {/* How to */}
      <Section title="How to do this">
        <ol className="space-y-3">
          {exp.howTo.map((step) => (
            <li key={step.order} className="flex gap-3 text-sm leading-relaxed text-ink-warm/80">
              <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-deep-teal/10 text-xs font-semibold text-deep-teal">
                {step.order}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Real inconveniences */}
      {exp.realInconveniences.length > 0 && (
        <Section title="Real inconveniences">
          <ul className="space-y-2">
            {exp.realInconveniences.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-warm/80">
                <span className="flex-shrink-0 rounded bg-warm-amber/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-warm-amber">
                  {r.category}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Solo score breakdown */}
      <Section title="Solo score">
        <div className="rounded-xl bg-paper-cream/60 p-4 ring-1 ring-ink-warm/10">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ink-warm">{exp.soloScore.overall}</span>
            <span className="text-sm text-ink-warm/60">
              / 10 · based on {exp.soloScore.basedOnCount} reports
            </span>
          </div>
          {exp.soloScore.hint && (
            <p className="mb-3 text-sm italic text-ink-warm/70">{exp.soloScore.hint}</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink-warm/70">
            {(
              [
                ["Seating friendly", exp.soloScore.breakdown.seatingFriendly],
                ["Solo patron ratio", exp.soloScore.breakdown.soloPatronRatio],
                ["Staff pressure", exp.soloScore.breakdown.staffPressure],
                ["Solo portioning", exp.soloScore.breakdown.soloPortioning],
                ["Ambiance fit", exp.soloScore.breakdown.ambianceFit],
                ["Safety", exp.soloScore.breakdown.safety],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd className="font-medium text-ink-warm/90">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* Sources */}
      {exp.sources.length > 0 && (
        <Section title="Sources">
          <ul className="space-y-1">
            {exp.sources.map((s, i) => (
              <li key={i} className="text-xs text-ink-warm/60">
                <span className="font-medium capitalize text-ink-warm/80">{s.type}</span>
                {s.attribution && <> · {s.attribution}</>}
                {s.url && (
                  <>
                    {" · "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-deep-teal hover:underline"
                    >
                      source ↗
                    </a>
                  </>
                )}
                <span className="ml-2 text-ink-warm/40">verified {s.verifiedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Related experiences */}
      {relatedExperiences.length > 0 && (
        <Section title="Nearby experiences">
          <ul className="space-y-2">
            {relatedExperiences.map((r) => (
              <li key={r.id}>
                <a
                  href={`/cmi/${slugFromId(r.id)}`}
                  className="group flex items-start gap-3 rounded-xl p-3 ring-1 ring-ink-warm/10 transition hover:ring-deep-teal/40"
                >
                  <span className="text-xl" aria-hidden="true">
                    {categoryEmoji[r.category]}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-warm group-hover:text-deep-teal">
                      {r.title}
                    </p>
                    <p className="text-xs text-ink-warm/60">{truncate(r.oneLiner, 80)}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Desktop CTA */}
      <div className="hidden md:flex mt-8 justify-end">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-deep-teal px-5 py-3 text-sm font-semibold text-paper-cream transition hover:bg-deep-teal/90"
        >
          Plan a trip to Chiang Mai →
        </a>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex md:hidden border-t border-ink-warm/10 bg-paper-cream/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          className="w-full rounded-xl bg-deep-teal py-3 text-sm font-semibold text-paper-cream"
        >
          Open in app
        </button>
      </div>
    </article>
  );
}
