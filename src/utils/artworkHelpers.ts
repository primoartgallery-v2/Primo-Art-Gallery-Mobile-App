import type {
  WooCommerceProduct,
  WooCommerceProductAttribute,
  WooCommerceProductMetaData,
  WordPressArtist,
} from "@/services/woocommerce";

export const ARTIST_FIELD_KEYS = [
  "artist",
  "artist name",
  "artist_name",
  "artists",
  "select artist",
  "select artists",
  "selected artist",
  "selected artists",
];

export type ArtistProfile = {
  name: string;
  bio: string;
};

export function getArtistId(product: WooCommerceProduct): string | number | undefined {
  const artistMeta = product.meta_data.find((item) => item.key === "egns_product_meta");
  const value = artistMeta?.value;

  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const artistIds = (value as Record<string, unknown>).artists_list_ids;
  if (!Array.isArray(artistIds)) return undefined;

  const artistId = artistIds[0];
  return typeof artistId === "string" || typeof artistId === "number"
    ? artistId
    : undefined;
}

export function extractArtistProfile(artist: WordPressArtist): ArtistProfile {
  const name = getArtistField(artist, [
    ["name"],
    ["artist_name"],
    ["display_name"],
    ["title", "rendered"],
    ["title"],
    ["acf", "name"],
    ["acf", "artist_name"],
  ]);
  const bio = getArtistField(artist, [
    ["biography"],
    ["bio"],
    ["description"],
    ["details"],
    ["content", "rendered"],
    ["content"],
    ["excerpt", "rendered"],
    ["excerpt"],
    ["acf", "biography"],
    ["acf", "bio"],
    ["acf", "description"],
    ["acf", "details"],
  ]);

  return { name, bio };
}

export function getArtistField(source: WordPressArtist, paths: string[][]): string {
  for (const path of paths) {
    let value: unknown = source;
    for (const key of path) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[key];
    }

    const text = getArtistText(value);
    if (text) return text;
  }

  return "";
}

export function getArtistText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return cleanArtistText(String(value));
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["rendered", "raw", "value", "name", "title"]) {
    const text = getArtistText(record[key]);
    if (text) return text;
  }
  return "";
}

export function cleanArtistText(value: string): string {
  return value
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function getArtworkValue(product: WooCommerceProduct, keys: string[], fallback: string): string {
  const normalizedKeys = keys.map(normalizeKey);
  const attribute = product.attributes.find((item) => normalizedKeys.includes(normalizeKey(item.name)));
  const attributeValue = getAttributeValue(attribute);
  if (attributeValue) return attributeValue;

  const meta = product.meta_data.find((item) => normalizedKeys.includes(normalizeKey(item.key)));
  const metaValue = getMetaValue(meta);
  return metaValue || fallback;
}

export function getAttributeValue(attribute?: WooCommerceProductAttribute): string {
  if (!attribute) return "";
  return attribute.option || attribute.options.filter(Boolean).join(", ");
}

export function getMetaValue(meta?: WooCommerceProductMetaData): string {
  if (!meta || meta.value === null || meta.value === undefined) return "";
  if (Array.isArray(meta.value)) return meta.value.filter(Boolean).join(", ");
  if (typeof meta.value === "object") return "";
  return String(meta.value).trim();
}

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

export function getInitials(name: unknown): string {
  if (typeof name !== "string") {
    return "AR";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
