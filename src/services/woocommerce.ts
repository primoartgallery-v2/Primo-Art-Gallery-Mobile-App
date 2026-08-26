import { WOOCOMMERCE_CONFIG } from "@/constants/apiKeys";

const API_BASE = WOOCOMMERCE_CONFIG.URL.replace(/\/$/, "");
const CONSUMER_KEY = WOOCOMMERCE_CONFIG.CONSUMER_KEY;
const CONSUMER_SECRET = WOOCOMMERCE_CONFIG.CONSUMER_SECRET;
const DEFAULT_PER_PAGE = 10;

export type WooCommerceProductImage = {
  id: number;
  src: string;
  alt: string;
};

export type WooCommerceProductCategory = {
  id: number;
  name: string;
  slug: string;
};

export type WooCommerceProductAttribute = {
  id: number;
  name: string;
  option: string;
  options: string[];
  visible: boolean;
  variation: boolean;
};

export type WooCommerceProductMetaData = {
  id: number;
  key: string;
  value: unknown;
};

export type WooCommerceProduct = {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  short_description: string;
  description: string;
  images: WooCommerceProductImage[];
  categories: WooCommerceProductCategory[];
  attributes: WooCommerceProductAttribute[];
  meta_data: WooCommerceProductMetaData[];
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  stock_status: "instock" | "outofstock" | "onbackorder" | string;
  stock_quantity: number | null;
};

export type ProductPage = {
  products: WooCommerceProduct[];
  page: number;
  total: number;
  totalPages: number;
};

export type WordPressArtist = Record<string, unknown>;

export type ArtistItem = {
  id: number;
  name: string;
  slug: string;
  link: string;
  imageUrl?: string | null;
  category?: string;
  bio?: string;
  artworksCount?: number;
};

type GetProductsOptions = {
  page?: number;
  perPage?: number;
  category?: number;
  exclude?: number[];
  forceRefresh?: boolean;
};

export class WooCommerceError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "WooCommerceError";
    this.status = status;
  }
}

// In-Memory Cache with 5-minute TTL
const CACHE_TTL_MS = 5 * 60 * 1000;
const productsCache = new Map<string, { data: ProductPage; timestamp: number }>();
const productDetailCache = new Map<string, { data: WooCommerceProduct; timestamp: number }>();
const artistCache = new Map<string, { data: WordPressArtist; timestamp: number }>();
let artistsListCache: { data: ArtistItem[]; timestamp: number } | null = null;

export function clearWooCommerceCache() {
  productsCache.clear();
  productDetailCache.clear();
  artistCache.clear();
  artistsListCache = null;
}

function createProductsUrl({
  page = 1,
  perPage = DEFAULT_PER_PAGE,
  category,
  exclude,
}: GetProductsOptions) {
  const query = [
    `consumer_key=${encodeURIComponent(CONSUMER_KEY)}`,
    `consumer_secret=${encodeURIComponent(CONSUMER_SECRET)}`,
    `page=${page}`,
    `per_page=${perPage}`,
    `status=publish`,
  ];

  if (category) {
    query.push(`category=${category}`);
  }
  if (exclude?.length) {
    query.push(`exclude=${exclude.join(",")}`);
  }

  return `${API_BASE}/wp-json/wc/v3/products?${query.join("&")}`;
}

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<ProductPage> {
  const cacheKey = `${options.page ?? 1}_${options.perPage ?? DEFAULT_PER_PAGE}_${options.category ?? ""}_${(options.exclude ?? []).join(",")}`;
  const cached = productsCache.get(cacheKey);

  if (!options.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  const url = createProductsUrl(options);
  console.log("[Primo API] Fetching artworks from:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[Primo API] Non-200 response:", response.status);
      throw new WooCommerceError(
        "Unable to load artworks. Please try again.",
        response.status
      );
    }

    const products = (await response.json()) as WooCommerceProduct[];
    console.log("[Primo API] Artworks loaded successfully. Count:", products.length);

    const result: ProductPage = {
      products,
      page: options.page ?? 1,
      total: Number(response.headers.get("x-wp-total") ?? products.length),
      totalPages: Number(response.headers.get("x-wp-totalpages") ?? 1),
    };

    productsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error("[Primo API Error]:", error);

    if (cached) {
      return cached.data;
    }

    if (error instanceof WooCommerceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new WooCommerceError(
        "The request took too long. Please check your connection and try again."
      );
    }

    throw new WooCommerceError(
      "Unable to connect to Primo Art Gallery. Please try again."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getProduct(
  id: string | number,
  forceRefresh = false
): Promise<WooCommerceProduct> {
  const productId = String(id).trim();

  if (!/^\d+$/.test(productId)) {
    throw new WooCommerceError("This artwork could not be found.", 400);
  }

  const cached = productDetailCache.get(productId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const url = `${API_BASE}/wp-json/wc/v3/products/${productId}?consumer_key=${encodeURIComponent(CONSUMER_KEY)}&consumer_secret=${encodeURIComponent(CONSUMER_SECRET)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WooCommerceError(
        response.status === 404
          ? "This artwork is no longer available."
          : "Unable to load this artwork. Please try again.",
        response.status
      );
    }

    const product = (await response.json()) as WooCommerceProduct;
    productDetailCache.set(productId, { data: product, timestamp: Date.now() });
    return product;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    if (error instanceof WooCommerceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new WooCommerceError(
        "The request took too long. Please check your connection and try again."
      );
    }

    throw new WooCommerceError(
      "Unable to connect to Primo Art Gallery. Please try again."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getArtistsList(forceRefresh = false): Promise<ArtistItem[]> {
  if (!forceRefresh && artistsListCache && Date.now() - artistsListCache.timestamp < CACHE_TTL_MS) {
    return artistsListCache.data;
  }

  const url = `${API_BASE}/wp-json/wp/v2/artists?per_page=100&_embed=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WooCommerceError("Unable to load artists list.", response.status);
    }

    const rawData = (await response.json()) as any[];
    const parsed: ArtistItem[] = rawData
      .map((item) => ({
        id: item.id,
        name:
          item.title?.rendered
            ?.replace(/&amp;/g, "&")
            ?.replace(/&#0*39;/g, "'")
            ?.replace(/&quot;/g, '"') || "Artist",
        slug: item.slug,
        link: item.link,
        imageUrl: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
        category: item._embedded?.["wp:term"]?.[0]?.[0]?.name || "Contemporary Artist",
        bio:
          item.content?.rendered
            ?.replace(/<[^>]*>/g, "")
            ?.replace(/&nbsp;/g, " ")
            ?.replace(/&amp;/g, "&")
            ?.replace(/&#0*39;/g, "'")
            ?.trim() || "",
      }))
      .filter((a) => a.name !== "." && a.name.trim().length > 0);

    artistsListCache = { data: parsed, timestamp: Date.now() };
    return parsed;
  } catch (error) {
    if (artistsListCache) return artistsListCache.data;
    throw new WooCommerceError("Unable to load gallery artists.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getArtist(
  id: string | number,
  forceRefresh = false
): Promise<WordPressArtist> {
  const artistId = String(id).trim();

  if (!/^\d+$/.test(artistId)) {
    throw new WooCommerceError("This artist could not be found.", 400);
  }

  const cached = artistCache.get(artistId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${API_BASE}/wp-json/wp/v2/artists/${artistId}?_embed=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WooCommerceError("Unable to load artist details.", response.status);
    }

    const artistData = (await response.json()) as WordPressArtist;
    artistCache.set(artistId, { data: artistData, timestamp: Date.now() });
    return artistData;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    if (error instanceof WooCommerceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new WooCommerceError("Artist details took too long to load.");
    }

    throw new WooCommerceError("Unable to load artist details.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getArtistBiography(artist: WordPressArtist): Promise<string> {
  const artistUrl = artist.link;
  if (typeof artistUrl !== "string" || !artistUrl) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(artistUrl, {
      method: "GET",
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) return "";

    return extractBiographyFromArtistPage(await response.text());
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function extractBiographyFromArtistPage(html: string) {
  const biographyMatch = html.match(
    /<p[^>]*class=["'][^"']*biography-top-text[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
  );
  if (!biographyMatch?.[1]) return "";

  return biographyMatch[1]
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robustly extracts all artist IDs and artist names associated with a WooCommerce product.
 */
export function extractProductArtistIds(product: WooCommerceProduct): string[] {
  const ids: string[] = [];

  // 1. Egns theme metadata (artists_list_ids)
  const egnsMeta = product.meta_data?.find((m) => m.key === "egns_product_meta");
  if (egnsMeta?.value) {
    if (typeof egnsMeta.value === "object" && egnsMeta.value !== null) {
      const list = (egnsMeta.value as Record<string, unknown>).artists_list_ids;
      if (Array.isArray(list)) {
        list.forEach((id) => {
          if (id !== undefined && id !== null && String(id).trim()) {
            ids.push(String(id).trim());
          }
        });
      }
    } else if (typeof egnsMeta.value === "string") {
      try {
        const parsed = JSON.parse(egnsMeta.value);
        if (Array.isArray(parsed?.artists_list_ids)) {
          parsed.artists_list_ids.forEach((id: unknown) => {
            if (id !== undefined && id !== null && String(id).trim()) {
              ids.push(String(id).trim());
            }
          });
        }
      } catch {
        ids.push(egnsMeta.value.trim());
      }
    }
  }

  // 2. Fallback attributes
  product.attributes?.forEach((attr) => {
    if (attr.name.toLowerCase().includes("artist")) {
      attr.options?.forEach((opt) => {
        if (opt && String(opt).trim()) {
          ids.push(String(opt).trim());
        }
      });
    }
  });

  return Array.from(new Set(ids));
}
