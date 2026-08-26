import { getProducts, type WooCommerceProduct } from "@/services/woocommerce";

export type AuctionItem = {
  id: number;
  title: string;
  artist: string;
  description?: string;
  imageUrl?: string;
  startingBid: number;
  currentBid?: number;
  reserveMet?: boolean;
  bidCount?: number;
  currency: string;
  startTime: string;
  endTime: string;
  status: "live" | "upcoming" | "ended";
  minimumIncrement?: number;
  lotNumber?: string;
};

export async function getAuctions(): Promise<AuctionItem[]> {
  try {
    // Query products that have auction category or metadata
    const result = await getProducts({ page: 1, perPage: 20 });
    
    // Filter for products that contain auction attributes or metadata
    const auctionProducts = result.products.filter((product: WooCommerceProduct) => {
      const hasAuctionCategory = product.categories.some((c) =>
        /auction/i.test(c.name) || /auction/i.test(c.slug)
      );
      const hasAuctionMeta = product.meta_data.some((m) =>
        /auction/i.test(m.key) || /bid/i.test(m.key)
      );
      return hasAuctionCategory || hasAuctionMeta;
    });

    return auctionProducts.map((product) => {
      const priceNum = parseFloat(product.price || product.regular_price || "0");
      return {
        id: product.id,
        title: product.name,
        artist: product.attributes.find((a) => /artist/i.test(a.name))?.options[0] || "Featured Artist",
        description: product.short_description || product.description,
        imageUrl: product.images[0]?.src,
        startingBid: priceNum,
        currentBid: priceNum,
        currency: "₹",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        status: "live" as const,
        lotNumber: `LOT #${product.id}`,
      };
    });
  } catch {
    return [];
  }
}
