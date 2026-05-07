import type { MetadataRoute } from "next";
import type { ExperienceCategory } from "@solo-compass/core";
import { demoExperiences } from "@/data/demo-experiences";
import { slugFromId } from "@/components/SEOExperience";

const BASE = "https://solocompass.app";

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

export default function sitemap(): MetadataRoute.Sitemap {
  const activeExperiences = demoExperiences.filter((e) => e.status === "active");

  const experienceUrls: MetadataRoute.Sitemap = activeExperiences.map((exp) => ({
    url: `${BASE}/cmi/${slugFromId(exp.id)}`,
    lastModified: exp.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE}/cmi/category/${cat}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE,
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE}/cmi`,
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...categoryUrls,
    ...experienceUrls,
  ];
}
