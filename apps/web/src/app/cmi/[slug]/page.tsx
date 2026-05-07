import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoExperiences } from "@/data/demo-experiences";
import {
  SEOExperience,
  slugFromId,
  idFromSlug,
  experiencePageTitle,
  truncate,
} from "@/components/SEOExperience";
import { categoryLabel } from "@/lib/category";

export const revalidate = 3600;

export function generateStaticParams() {
  return demoExperiences
    .filter((e) => e.status === "active")
    .map((e) => ({ slug: slugFromId(e.id) }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const exp = demoExperiences.find((e) => e.id === id);
  if (!exp) return { title: "Not found" };

  const title = experiencePageTitle(exp);
  const description = truncate(exp.oneLiner, 155);
  const url = `https://solocompass.app/cmi/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Solo Compass",
      locale: "en_US",
      type: "article",
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
    alternates: { canonical: url },
  };
}

export default async function ExperiencePage({ params }: Props) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const exp = demoExperiences.find((e) => e.id === id);
  if (!exp || exp.status !== "active") notFound();

  const related = exp.nearbyExperienceIds
    .map((rid) => demoExperiences.find((e) => e.id === rid))
    .filter((e): e is (typeof demoExperiences)[number] => e !== undefined && e.status === "active");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "@id": `https://solocompass.app/cmi/${slug}`,
        name: exp.title,
        description: exp.whyItMatters,
        url: `https://solocompass.app/cmi/${slug}`,
        touristType: "Solo travelers",
        geo: {
          "@type": "GeoCoordinates",
          longitude: exp.location.coordinates[0],
          latitude: exp.location.coordinates[1],
        },
        containedInPlace: {
          "@type": "Place",
          name: "Chiang Mai",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Chiang Mai",
            addressCountry: "TH",
          },
        },
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
            name: categoryLabel[exp.category],
            item: `https://solocompass.app/cmi/category/${exp.category}`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: exp.title,
            item: `https://solocompass.app/cmi/${slug}`,
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
      {/* Minimal nav */}
      <nav className="sticky top-0 z-10 border-b border-ink-warm/10 bg-paper-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
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
      <SEOExperience experience={exp} relatedExperiences={related} />
    </>
  );
}
