import type { Metadata } from "next";
import type { ExperienceCategory } from "@solo-compass/core";
import { demoExperiences } from "@/data/demo-experiences";
import { categoryEmoji, categoryLabel } from "@/lib/category";
import { slugFromId, SoloScorePill, CategoryBadge } from "@/components/SEOExperience";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Things to do in Chiang Mai for solo travelers · Solo Compass",
  description:
    "25 curated, solo-friendly experiences in Chiang Mai: temples at sunset, khao soi, specialty coffee, forest meditation, hidden rooftops. Honest tips, real inconveniences.",
  openGraph: {
    title: "Things to do in Chiang Mai for solo travelers",
    description:
      "25 curated solo-friendly experiences in Chiang Mai. Temples, food, coffee, wellness, nightlife — with honest solo-travel tips.",
    url: "https://solocompass.app/cmi",
    siteName: "Solo Compass",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Things to do in Chiang Mai for solo travelers · Solo Compass",
    description:
      "25 curated solo-friendly experiences in Chiang Mai. Temples, food, coffee, wellness, nightlife.",
  },
  alternates: { canonical: "https://solocompass.app/cmi" },
};

const CATEGORIES: ExperienceCategory[] = [
  "culture",
  "nature",
  "food",
  "coffee",
  "work",
  "wellness",
  "nightlife",
  "hidden",
];

const activeExperiences = demoExperiences.filter((e) => e.status === "active");

export default function ChiangMaiPage() {
  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    items: activeExperiences.filter((e) => e.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Things to do in Chiang Mai for solo travelers",
            description:
              "Curated solo-friendly experiences in Chiang Mai, Thailand. Temples, food, coffee, wellness, nightlife, and hidden gems.",
            url: "https://solocompass.app/cmi",
            hasPart: activeExperiences.map((exp) => ({
              "@type": "TouristAttraction",
              name: exp.title,
              description: exp.oneLiner,
              url: `https://solocompass.app/cmi/${slugFromId(exp.id)}`,
              geo: {
                "@type": "GeoCoordinates",
                longitude: exp.location.coordinates[0],
                latitude: exp.location.coordinates[1],
              },
            })),
            breadcrumb: {
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
              ],
            },
          }),
        }}
      />

      <div className="min-h-screen bg-paper-cream pb-16">
        {/* Nav */}
        <nav className="sticky top-0 z-10 border-b border-ink-warm/10 bg-paper-cream/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <a href="/" className="text-sm font-semibold text-deep-teal">
              Solo Compass
            </a>
            <a
              href="/"
              className="hidden rounded-lg bg-deep-teal px-4 py-2 text-xs font-semibold text-paper-cream transition hover:bg-deep-teal/90 md:inline-flex"
            >
              Plan a trip →
            </a>
          </div>
        </nav>

        <main className="mx-auto max-w-4xl px-4 py-8">
          {/* Hero */}
          <header className="mb-10">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-warm/50">
              Thailand · Chiang Mai
            </div>
            <h1 className="mb-4 text-3xl font-bold leading-tight text-ink-warm md:text-4xl">
              Things to do in Chiang Mai
              <br />
              <span className="text-deep-teal">for solo travelers</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-ink-warm/70">
              {activeExperiences.length} curated experiences — not places, not restaurants, not
              things to &ldquo;check off&rdquo;. Each one is a concrete, time-bound story worth
              doing alone.
            </p>

            {/* Map preview placeholder */}
            <div className="mt-6 flex h-40 items-center justify-center rounded-2xl bg-muted-road/30 ring-1 ring-ink-warm/10 md:h-56">
              <a
                href="/"
                className="flex flex-col items-center gap-2 text-ink-warm/50 hover:text-deep-teal"
              >
                <span className="text-4xl">🗺️</span>
                <span className="text-sm font-medium">Open interactive map</span>
              </a>
            </div>
          </header>

          {/* Category filter pills */}
          <div className="mb-8 flex flex-wrap gap-2">
            <a
              href="/cmi"
              className="rounded-full bg-deep-teal px-4 py-1.5 text-xs font-semibold text-paper-cream"
            >
              All ({activeExperiences.length})
            </a>
            {byCategory.map(({ cat, items }) => (
              <a
                key={cat}
                href={`/cmi/category/${cat}`}
                className="rounded-full bg-ink-warm/8 px-4 py-1.5 text-xs font-semibold text-ink-warm/70 ring-1 ring-ink-warm/10 transition hover:bg-deep-teal/10 hover:text-deep-teal"
              >
                {categoryEmoji[cat]} {categoryLabel[cat]} ({items.length})
              </a>
            ))}
          </div>

          {/* Experience grid by category */}
          {byCategory.map(({ cat, items }) => (
            <section key={cat} className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink-warm">
                <span className="text-xl" aria-hidden="true">
                  {categoryEmoji[cat]}
                </span>
                {categoryLabel[cat]}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((exp) => (
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
                      <p className="text-xs leading-relaxed text-ink-warm/60 line-clamp-2">
                        {exp.oneLiner}
                      </p>
                      {exp.bestTimes.length > 0 && exp.bestTimes[0] && (
                        <p className="text-xs text-ink-warm/50">
                          🕐{" "}
                          {`${String(exp.bestTimes[0].startHour).padStart(2, "0")}:00–${String(exp.bestTimes[0].endHour).padStart(2, "0")}:00`}
                          {exp.bestTimes[0].note ? ` · ${exp.bestTimes[0].note}` : ""}
                        </p>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
