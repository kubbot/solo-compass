import * as cheerio from "cheerio";
import type { Candidate } from "@solo-compass/sources-core";

/** Wikivoyage article sections that contain POI listings. */
const POI_SECTIONS = ["See", "Do", "Eat", "Drink"] as const;

const LICENSE = "CC-BY-SA-3.0";

interface RawPoi {
  title: string;
  description: string;
  coordinates?: readonly [number, number];
  sectionUrl: string;
}

function extractCoordinates(
  el: cheerio.Element,
  $: cheerio.CheerioAPI,
): readonly [number, number] | undefined {
  // Wikivoyage embeds geo data as class="geo" spans or data-lat/data-lon attributes
  const geoSpan = $(el).find(".geo").first().text().trim();
  if (geoSpan) {
    // Format: "lat; lon" or "lat, lon"
    const parts = geoSpan.split(/[;,]/).map((s) => parseFloat(s.trim()));
    const lat = parts[0];
    const lon = parts[1];
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      return [lon, lat]; // GeoJSON: [longitude, latitude]
    }
  }

  // Fallback: data attributes on the listing element or its parent
  const dataLat = $(el).attr("data-lat") ?? $(el).closest("[data-lat]").attr("data-lat");
  const dataLon = $(el).attr("data-lon") ?? $(el).closest("[data-lon]").attr("data-lon");
  if (dataLat !== undefined && dataLon !== undefined) {
    const lat = parseFloat(dataLat);
    const lon = parseFloat(dataLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      return [lon, lat];
    }
  }

  return undefined;
}

/**
 * Parses Wikivoyage article HTML and returns raw POI objects.
 * Extracts listings from See / Do / Eat / Drink sections.
 */
export function parseWikivoyageHtml(html: string, articleUrl: string): RawPoi[] {
  const $ = cheerio.load(html);
  const pois: RawPoi[] = [];

  for (const section of POI_SECTIONS) {
    // Section headings are <h2> or <h3> with a span whose id matches the section name
    const heading = $(`h2 span#${section}, h3 span#${section}`).first();
    if (heading.length === 0) continue;

    const headingEl = heading.closest("h2, h3");
    const sectionAnchor = `#${section}`;
    const sectionUrl = `${articleUrl}${sectionAnchor}`;

    // Walk siblings until the next same-level or higher heading
    const headingTag = headingEl.prop("tagName")?.toLowerCase() ?? "h2";
    let sibling = headingEl.next();

    while (sibling.length > 0) {
      const tag = sibling.prop("tagName")?.toLowerCase() ?? "";
      if (tag === "h1" || tag === "h2" || (headingTag === "h3" && tag === "h3")) break;

      // Wikivoyage uses <div class="listing"> or <li> or <dl> for POI entries
      const listings = sibling.find(".listing, li.vcard").addBack(".listing, li.vcard");

      listings.each((_i, el) => {
        const nameEl = $(el).find(".listing-name, .fn").first();
        const title = nameEl.text().trim() || $(el).find("b, strong").first().text().trim();
        if (!title) return;

        // Description: everything after the name, stripping nested tags' text
        const descEl = $(el).find(".listing-content, .note").first();
        let description = descEl.text().trim();
        if (!description) {
          // Fallback: all text in the element minus the name
          nameEl.remove();
          description = $(el).text().trim();
        }

        const coordinates = extractCoordinates(el, $);

        pois.push({ title, description, coordinates, sectionUrl });
      });

      sibling = sibling.next();
    }
  }

  return pois;
}

/**
 * Converts raw POIs from a city article into Candidates ready for the pipeline.
 */
export function toCandidates(
  pois: RawPoi[],
  citySlug: string,
  articleUrl: string,
): Candidate[] {
  const fetchedAt = new Date().toISOString();

  return pois.map((poi, index) => {
    const slugTitle = poi.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return {
      sourceId: `wikivoyage:${citySlug}:${slugTitle}:${index}`,
      sourceName: "Wikivoyage",
      title: poi.title,
      rawText: `${poi.description}\n\nSource: ${poi.sectionUrl}\nLicense: ${LICENSE}`,
      url: articleUrl,
      coordinates: poi.coordinates,
      fetchedAt,
    };
  });
}
