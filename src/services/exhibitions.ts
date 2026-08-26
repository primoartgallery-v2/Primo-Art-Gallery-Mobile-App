export type Exhibition = {
  id: number;
  title: string;
  subtitle?: string;
  status: "upcoming" | "current" | "past";
  dates: string;
  timings: string;
  venue: string;
  city: string;
  entry: string;
  description: string;
  imageUrl?: string;
  curator?: string;
  artists?: string[];
  link?: string;
  registrationUrl?: string;
};

export const EXHIBITION_REGISTRATION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScdKjYL_nitXY6JS1aKGLJQTdl6Dwh7LB14gQUzZ96hX0RC1A/viewform?usp=header";

// Fallback parsed from published WordPress Exhibition Page (Page ID 1260)
const PUBLISHED_EXHIBITION: Exhibition = {
  id: 1260,
  title: "The Emerging Perspectives",
  subtitle: "A Curated Group Exhibition of Contemporary Vision",
  status: "upcoming",
  dates: "27–30 September 2026",
  timings: "11:00 AM – 7:00 PM",
  venue: "India Habitat Centre, Lodhi Road",
  city: "New Delhi",
  entry: "Free Entry",
  description:
    "Join Primo Art Gallery for The Emerging Perspectives, a group exhibition showcasing the creative vision of three emerging contemporary artists. Discover new voices, fresh perspectives, and inspiring original artworks.",
  imageUrl:
    "https://primoartgallery.com/wp-content/uploads/2026/08/Instagram_4x5_The_Emerging_Perspectives-600x750.png",
  artists: ["Contemporary Emerging Artists"],
  link: "https://primoartgallery.com/upcoming-exhibition/",
  registrationUrl: EXHIBITION_REGISTRATION_URL,
};

export async function getExhibitions(): Promise<Exhibition[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    // Attempt to fetch live from WordPress via public REST endpoint
    const response = await fetch(
      "https://primoartgallery.com/wp-json/wp/v2/pages/1260",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    if (response.ok) {
      const page = await response.json();
      const excerpt = page.excerpt?.rendered || "";
      const content = page.content?.rendered || "";

      // Extract image if available in content
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      const imageUrl = imgMatch ? imgMatch[1] : PUBLISHED_EXHIBITION.imageUrl;

      return [
        {
          id: page.id || 1260,
          title: "The Emerging Perspectives",
          subtitle: "A Curated Group Exhibition",
          status: "upcoming",
          dates: "27–30 September 2026",
          timings: "11:00 AM – 7:00 PM",
          venue: "India Habitat Centre, Lodhi Road",
          city: "New Delhi",
          entry: "Free Entry",
          description: cleanExcerpt(excerpt) || PUBLISHED_EXHIBITION.description,
          imageUrl,
          link: page.link || PUBLISHED_EXHIBITION.link,
          registrationUrl: EXHIBITION_REGISTRATION_URL,
        },
      ];
    }
  } catch {
    // If network fails, return published exhibition record
  } finally {
    clearTimeout(timeout);
  }

  return [PUBLISHED_EXHIBITION];
}

function cleanExcerpt(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\[&hellip;\]/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}
