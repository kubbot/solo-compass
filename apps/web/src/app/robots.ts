import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/cmi/"],
        disallow: ["/u/", "/api/"],
      },
    ],
    sitemap: "https://solocompass.app/sitemap.xml",
  };
}
