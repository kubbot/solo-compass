import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ExperienceCategory } from "@solo-compass/core";
import { demoExperiences } from "@/data/demo-experiences";
import { categoryEmoji, categoryLabel } from "@/lib/category";
import { slugFromId, SoloScorePill } from "@/components/SEOExperience";

export const revalidate = 3600;

const VALID_CATEGORIES: ExperienceCategory[] = [
  "culture",
  "nature",
  "food",
  "coffee",
  "work",
  "wellness",
  "nightlife",
  "hidden",
];

export function generateStaticParams() {
  return VALID_CATEGORIES.map((category) => ({ category }));
}

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as ExperienceCategory)) return { title: "Not found" };
  const cat = category as ExperienceCategory;

  const count = demoExperiences.filter((e) => e.category === cat && e.status === "active").length;

  const title = `${categoryLabel[cat]} experiences in Chiang Mai for solo travelers · Solo Compass`;
  const description = `${count} solo-friendly ${categoryLabel[cat].toLowerCase()} experiences in Chiang Mai. Curated with real tips, best times, and honest inconveniences.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://solocompass.app/cmi/category/${cat}`,
      siteName: "Solo Compass",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: `https://solocompass.app/cmi/category/${cat}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as ExperienceCategory)) notFound();
  const cat = category as ExperienceCategory;

  const experiences = demoExperiences.filter((e) => e.category === cat && e.status === "active");
  if (experiences.length === 0) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${categoryLabel[cat]} in Chiang Mai`,
        description: `Solo-friendly ${categoryLabel[cat].toLowerCase()} experiences in Chiang Mai, Thailand.`,
        url: `https://solocompass.app/cmi/category/${cat}`,
        hasPart: experiences.map((exp) => ({
          "@type": "TouristAttraction",
          name: exp.title,
          description: exp.oneLiner,
          url: `https://solocompass.app/cmi/${slugFromId(exp.id)}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Solo Compass",
            item: "https://solocompass.app",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Chiang Mai",
            item: "https://solocompass.app/cmi",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: categoryLabel[cat],
            item: `https://solocompass.app/cmi/category/${cat}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <nav className="sticky top-0 z-10 border-b border-ink-warm/10 bg-paper-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <a href="/cmi" className="text-sm font-semibold text-deep-teal">
            ← Chiang Mai
          </a>
          <a
            href="/"
            className="hidden rounded-lg bg-deep-teal px-4 py-2 text-xs font-semibold text-paper-cream transition hover:bg-deep-teal/90 md:inline-flex"
          >
            Plan a trip →
          </a>
        </div>
      </nav>

      <div className="min-h-screen bg-paper-cream pb-16">
        <main className="mx-auto max-w-4xl px-4 py-8">
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
              <li className="text-ink-warm/70">{categoryLabel[cat]}</li>
            </ol>
          </nav>

          <header className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">
                {categoryEmoji[cat]}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-warm/50">
                  Chiang Mai · Solo Compass
                </p>
                <h1 className="text-2xl font-bold text-ink-warm md:text-3xl">
                  {categoryLabel[cat]} in Chiang Mai
                </h1>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-ink-warm/70">
              {experiences.length} solo-friendly {categoryLabel[cat].toLowerCase()} experience
              {experiences.length !== 1 ? "s" : ""} — curated with real tips, best times, and honest
              inconveniences.
            </p>
          </header>

          {/* Other category links */}
          <div className="mb-8 flex flex-wrap gap-2">
            <a
              href="/cmi"
              className="rounded-full bg-ink-warm/8 px-4 py-1.5 text-xs font-semibold text-ink-warm/70 ring-1 ring-ink-warm/10 transition hover:bg-deep-teal/10 hover:text-deep-teal"
            >
              All categories
            </a>
            {VALID_CATEGORIES.filter((c) => c !== cat).map((c) => (
              <a
                key={c}
                href={`/cmi/category/${c}`}
                className="rounded-full bg-ink-warm/8 px-4 py-1.5 text-xs font-semibold text-ink-warm/70 ring-1 ring-ink-warm/10 transition hover:bg-deep-teal/10 hover:text-deep-teal"
              >
                {categoryEmoji[c]} {categoryLabel[c]}
              </a>
            ))}
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {experiences.map((exp) => (
              <li key={exp.id}>
                <a
                  href={`/cmi/${slugFromId(exp.id)}`}
                  className="group flex flex-col gap-2 rounded-2xl bg-white/50 p-4 ring-1 ring-ink-warm/10 transition hover:ring-deep-teal/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-ink-warm group-hover:text-deep-teal">
                      {exp.title}
                    </p>
                    <SoloScorePill score={exp.soloScore.overall} />
                  </div>
                  <p className="text-xs leading-relaxed text-ink-warm/60">{exp.oneLiner}</p>
                  {exp.bestTimes.length > 0 && exp.bestTimes[0] && (
                    <p className="text-xs text-ink-warm/50">
                      🕐{" "}
                      {`${String(exp.bestTimes[0].startHour).padStart(2, "0")}:00–${String(exp.bestTimes[0].endHour).padStart(2, "0")}:00`}
                      {exp.bestTimes[0].note ? ` · ${exp.bestTimes[0].note}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {exp.realInconveniences.slice(0, 1).map((r, i) => (
                      <span
                        key={i}
                        className="rounded bg-warm-amber/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-warm-amber"
                      >
                        {r.category}
                      </span>
                    ))}
                    <span className="text-xs text-ink-warm/50">
                      {exp.durationMinutes.min === exp.durationMinutes.max
                        ? `${exp.durationMinutes.min} min`
                        : `${exp.durationMinutes.min}–${exp.durationMinutes.max} min`}
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </main>
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
    </>
  );
}
