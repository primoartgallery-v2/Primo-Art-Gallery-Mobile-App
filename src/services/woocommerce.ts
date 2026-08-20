const PROXY_API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");
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

type GetProductsOptions = {
  page?: number;
  perPage?: number;
  category?: number;
  exclude?: number[];
};

export class WooCommerceError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "WooCommerceError";
    this.status = status;
  }
}

function createProductsUrl({
  page = 1,
  perPage = DEFAULT_PER_PAGE,
  category,
  exclude,
}: GetProductsOptions) {
  const query = [
    `page=${page}`,
    `per_page=${perPage}`,
  ];

  if (category) {
    query.push(`category=${category}`);
  }
  if (exclude?.length) {
    query.push(`exclude=${exclude.join(",")}`);
  }

  return `${PROXY_API_URL}/products?${query.join("&")}`;
}

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<ProductPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(createProductsUrl(options), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WooCommerceError(
        "Unable to load artworks. Please try again.",
        response.status
      );
    }

    const products = (await response.json()) as WooCommerceProduct[];

    return {
      products,
      page: options.page ?? 1,
      total: Number(response.headers.get("x-wp-total") ?? products.length),
      totalPages: Number(response.headers.get("x-wp-totalpages") ?? 1),
    };
  } catch (error) {
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

export async function getProduct(id: string | number): Promise<WooCommerceProduct> {
  const productId = String(id).trim();

  if (!/^\d+$/.test(productId)) {
    throw new WooCommerceError("This artwork could not be found.", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const url = `${PROXY_API_URL}/products/${productId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
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

    return (await response.json()) as WooCommerceProduct;
  } catch (error) {
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

export async function getArtist(id: string | number): Promise<WordPressArtist> {
  const artistId = String(id).trim();

  if (!/^\d+$/.test(artistId)) {
    throw new WooCommerceError("This artist could not be found.", 400);
  }

  const url = `${PROXY_API_URL}/artists/${artistId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WooCommerceError("Unable to load artist details.", response.status);
    }

    return (await response.json()) as WordPressArtist;
  } catch (error) {
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
