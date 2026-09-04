import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_BASE_URL as API_BASE } from "@/constants/apiConfig";

const DEFAULT_PER_PAGE = 10;

export const STORAGE_KEY_CATALOGUE_V1 = "@primo_cached_catalogue_v1";
export const STORAGE_KEY_ARTISTS_V1 = "@primo_cached_artists_v1";

/**
 * Retrieves persisted primary catalogue data from AsyncStorage for instant cold-start rendering.
 */
export async function getPersistentPrimaryProducts(): Promise<ProductPage | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_CATALOGUE_V1);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
      return parsed as ProductPage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists primary catalogue data to AsyncStorage for offline/fast load.
 */
export async function savePersistentPrimaryProducts(data: ProductPage): Promise<void> {
  try {
    if (data && Array.isArray(data.products) && data.products.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY_CATALOGUE_V1, JSON.stringify(data));
    }
  } catch {}
}

/**
 * Retrieves persisted artists list from AsyncStorage.
 */
export async function getPersistentArtistsList(): Promise<ArtistItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_ARTISTS_V1);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as ArtistItem[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists artists list to AsyncStorage.
 */
export async function savePersistentArtistsList(data: ArtistItem[]): Promise<void> {
  try {
    if (Array.isArray(data) && data.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY_ARTISTS_V1, JSON.stringify(data));
    }
  } catch {}
}

/**
 * Executes a network fetch with exactly one automatic retry after ~800ms delay on transient failures.
 */
async function fetchWithSingleRetry(
  url: string,
  headers: Record<string, string> = { Accept: "application/json" },
  timeoutMs = 20_000
): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const res = await doFetch();
    // If upstream server error (502, 503, 504), retry once after 800ms
    if (!res.ok && res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return await doFetch();
    }
    return res;
  } catch {
    // On transient network or abort failure, wait 800ms and retry once
    await new Promise((resolve) => setTimeout(resolve, 800));
    return await doFetch();
  }
}

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

export type WooCommerceCategory = {
  id: number;
  name: string;
  slug: string;
  parent?: number;
  description?: string;
  display?: string;
  image?: { id: number; src: string; alt?: string } | null;
  count?: number;
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

export type GetProductsOptions = {
  page?: number;
  perPage?: number;
  category?: number | string;
  search?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  orderby?: "date" | "id" | "include" | "title" | "slug" | "price" | "popularity" | "rating" | string;
  order?: "asc" | "desc" | string;
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
let categoriesCache: { data: WooCommerceCategory[]; timestamp: number } | null = null;
let artistsListCache: { data: ArtistItem[]; timestamp: number } | null = null;

export function clearWooCommerceCache() {
  productsCache.clear();
  productDetailCache.clear();
  artistCache.clear();
  categoriesCache = null;
  artistsListCache = null;
}

function createProductsUrl({
  page = 1,
  perPage = DEFAULT_PER_PAGE,
  category,
  search,
  minPrice,
  maxPrice,
  orderby,
  order,
  exclude,
}: GetProductsOptions) {
  const query = [
    `page=${page}`,
    `per_page=${perPage}`,
  ];

  if (category !== undefined && category !== null && String(category).trim().length > 0) {
    query.push(`category=${encodeURIComponent(String(category).trim())}`);
  }
  if (search !== undefined && search !== null && String(search).trim().length > 0) {
    query.push(`search=${encodeURIComponent(String(search).trim())}`);
  }
  if (minPrice !== undefined && minPrice !== null && String(minPrice).trim().length > 0) {
    query.push(`min_price=${encodeURIComponent(String(minPrice).trim())}`);
  }
  if (maxPrice !== undefined && maxPrice !== null && String(maxPrice).trim().length > 0) {
    query.push(`max_price=${encodeURIComponent(String(maxPrice).trim())}`);
  }
  if (orderby && String(orderby).trim().length > 0) {
    query.push(`orderby=${encodeURIComponent(String(orderby).trim().toLowerCase())}`);
  }
  if (order && String(order).trim().length > 0) {
    query.push(`order=${encodeURIComponent(String(order).trim().toLowerCase())}`);
  }
  if (exclude?.length) {
    query.push(`exclude=${exclude.join(",")}`);
  }

  return `${API_BASE}/api/products?${query.join("&")}`;
}

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<ProductPage> {
  const cacheKey = `${options.page ?? 1}_${options.perPage ?? DEFAULT_PER_PAGE}_${options.category ?? ""}_${options.search ?? ""}_${options.minPrice ?? ""}_${options.maxPrice ?? ""}_${options.orderby ?? ""}_${options.order ?? ""}_${(options.exclude ?? []).join(",")}`;
  const cached = productsCache.get(cacheKey);

  if (!options.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = createProductsUrl(options);
  console.log("[Primo API] Fetching artworks from proxy:", url);

  try {
    const response = await fetchWithSingleRetry(
      url,
      { Accept: "application/json" },
      20_000
    );

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

    // Save primary catalogue page to persistent storage for instant offline/cold load
    if (
      (options.page ?? 1) === 1 &&
      !options.category &&
      !options.search &&
      !options.minPrice &&
      !options.maxPrice &&
      !options.exclude?.length
    ) {
      void savePersistentPrimaryProducts(result);
    }

    return result;
  } catch (error) {
    console.error("[Primo API Error]:", error);

    if (cached) {
      return cached.data;
    }

    // Try reading persistent storage on primary query failure
    if (
      (options.page ?? 1) === 1 &&
      !options.category &&
      !options.search &&
      !options.minPrice &&
      !options.maxPrice &&
      !options.exclude?.length
    ) {
      const persistent = await getPersistentPrimaryProducts();
      if (persistent && persistent.products && persistent.products.length > 0) {
        return persistent;
      }
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

  const url = `${API_BASE}/api/products/${productId}`;

  try {
    const response = await fetchWithSingleRetry(
      url,
      { Accept: "application/json" },
      20_000
    );

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
  }
}

export async function getArtistsList(forceRefresh = false): Promise<ArtistItem[]> {
  if (!forceRefresh && artistsListCache && Date.now() - artistsListCache.timestamp < CACHE_TTL_MS) {
    return artistsListCache.data;
  }

  const url = `${API_BASE}/api/artists`;

  try {
    const response = await fetchWithSingleRetry(
      url,
      { Accept: "application/json" },
      20_000
    );

    if (!response.ok) {
      throw new WooCommerceError("Unable to load artists list.", response.status);
    }

    const parsed = (await response.json()) as ArtistItem[];
    artistsListCache = { data: parsed, timestamp: Date.now() };
    void savePersistentArtistsList(parsed);
    return parsed;
  } catch {
    if (artistsListCache) return artistsListCache.data;
    const persistent = await getPersistentArtistsList();
    if (persistent && persistent.length > 0) return persistent;
    throw new WooCommerceError("Unable to load gallery artists.");
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

  const url = `${API_BASE}/api/artists/${artistId}`;
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

/**
 * Fetches real categories from the secure Render proxy /api/categories.
 */
export async function getCategories(forceRefresh = false): Promise<WooCommerceCategory[]> {
  if (!forceRefresh && categoriesCache && Date.now() - categoriesCache.timestamp < CACHE_TTL_MS) {
    return categoriesCache.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const url = `${API_BASE}/api/categories`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (categoriesCache) return categoriesCache.data;
      throw new WooCommerceError("Unable to load categories.", response.status);
    }

    const data = (await response.json()) as WooCommerceCategory[];
    const valid = Array.isArray(data)
      ? data.filter((c) => c && c.id && c.name && c.slug !== "uncategorized")
      : [];
    categoriesCache = { data: valid, timestamp: Date.now() };
    return valid;
  } catch (error) {
    if (categoriesCache) return categoriesCache.data;
    console.error("[Primo API Categories Error]:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export type ArtworkCoA = {
  referenceId: string;
  artworkId: number;
  artworkTitle: string;
  artistName: string;
  medium: string;
  dimensions: string;
  creationYear: string;
  edition: string;
  signatureStatus: string;
  gallery: string;
  curator: string;
  issuedAt: string;
  integrityHash: string;
  cryptographicSignature: string;
  verificationMechanism: string;
  verificationUrl: string;
  legalNotice: string;
  imageUrl?: string | null;
};

/**
 * Fetches authoritative Certificate of Authenticity (CoA) metadata from the secure backend proxy.
 */
export async function getArtworkCoA(productId: number | string): Promise<ArtworkCoA | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const url = `${API_BASE}/api/products/${productId}/coa`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.success && data.coa) {
      return data.coa as ArtworkCoA;
    }
    return null;
  } catch (error) {
    console.warn("[Primo API CoA Error]:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

