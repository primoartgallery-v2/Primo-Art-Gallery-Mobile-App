function parseAuctionLot(product) {
  if (!product || typeof product !== "object") return null;
  const metaList = Array.isArray(product.meta_data) ? product.meta_data : [];
  const getMeta = (key) => {
    const item = metaList.find((m) => m && m.key === key);
    return item && item.value !== undefined && item.value !== null ? String(item.value).trim() : null;
  };

  // Authoritative auction-specific metadata validation
  // A product is an auction ONLY if it contains valid authoritative auction metadata (end date & starting price)
  const rawAuctionEndDate = getMeta("_auction_dates_to");
  const rawAuctionStartDate = getMeta("_auction_dates_from");
  const rawAuctionStartPrice = getMeta("_auction_start_price") || getMeta("_auction_starting_bid");

  // Reject regular catalogue products, products with only regular_price, or missing auction metadata
  if (!rawAuctionEndDate || !rawAuctionStartPrice) {
    return null;
  }

  const startingBid = parseFloat(rawAuctionStartPrice);
  if (isNaN(startingBid) || startingBid < 0) {
    return null;
  }

  const endMs = new Date(rawAuctionEndDate).getTime();
  if (isNaN(endMs)) {
    return null;
  }

  const startMs = rawAuctionStartDate ? new Date(rawAuctionStartDate).getTime() : 0;
  if (rawAuctionStartDate && isNaN(startMs)) {
    return null;
  }

  const nowMs = Date.now();
  const isExplicitlyClosed =
    getMeta("_auction_closed") === "1" || getMeta("_auction_closed") === "2" || getMeta("_auction_closed") === "yes";

  const isTimeEnded = endMs <= nowMs;
  const isUpcoming = startMs > 0 && startMs > nowMs;

  let status = "live";
  if (isUpcoming) {
    status = "upcoming";
  } else if (isExplicitlyClosed || isTimeEnded) {
    status = "closed";
  }

  const currentBid = parseFloat(getMeta("_auction_current_bid") || "0") || 0;
  const bidIncrement = parseFloat(getMeta("_auction_bid_increment") || "5000") || 5000;
  const reservePrice = parseFloat(getMeta("_auction_reserved_price") || "0") || 0;
  const bidCount = parseInt(getMeta("_auction_bid_count") || "0", 10) || 0;

  const effectiveCurrent = currentBid > 0 ? currentBid : startingBid;
  const nextMinimumBid = currentBid > 0 ? currentBid + bidIncrement : startingBid;

  const artistAttr = Array.isArray(product.attributes)
    ? product.attributes.find((a) => a && a.name && /artist/i.test(a.name))
    : null;
  const artist =
    artistAttr && artistAttr.options && artistAttr.options.length > 0
      ? artistAttr.options[0]
      : "Featured Master Artist";

  const permalink =
    product.permalink && typeof product.permalink === "string" && product.permalink.startsWith("http")
      ? product.permalink
      : "https://primoartgallery.com/live-auction/";

  return {
    id: product.id,
    lotNumber: `LOT #${product.id}`,
    title: product.name || "Curated Masterwork",
    artist,
    description: product.short_description || product.description || "",
    imageUrl: product.images && product.images[0] ? product.images[0].src : null,
    images: product.images ? product.images.map((img) => img.src) : [],
    startingBid,
    currentBid: effectiveCurrent,
    bidIncrement,
    reservePrice,
    nextMinimumBid,
    bidCount,
    startTime: rawAuctionStartDate || new Date(startMs || (endMs - 86400000 * 7)).toISOString(),
    endTime: rawAuctionEndDate,
    status,
    currency: "₹",
    permalink,
  };
}


module.exports = {
  parseAuctionLot,
};