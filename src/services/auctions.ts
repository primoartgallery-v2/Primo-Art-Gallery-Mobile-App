import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken } from "./collectorStorage";

export type AuctionLot = {
  id: number;
  lotNumber: string;
  title: string;
  artist: string;
  description?: string;
  imageUrl?: string | null;
  images?: string[];
  startingBid: number;
  currentBid: number;
  bidIncrement: number;
  reservePrice?: number;
  nextMinimumBid: number;
  bidCount: number;
  startTime: string;
  endTime: string;
  status: "live" | "upcoming" | "closed";
  currency: string;
  permalink?: string;
};

export type AuctionBid = {
  bidId: string;
  bidReference: string;
  lotId: number;
  lotTitle: string;
  artist: string;
  bidAmount: number;
  previousBid?: number;
  collectorUid?: string | null;
  collectorName?: string;
  collectorEmail?: string;
  collectorPhone?: string | null;
  status: string;
  createdAt?: string;
  placedAt?: string;
};

export type PlaceBidPayload = {
  lotId: number;
  bidAmount: number;
  collectorName: string;
  collectorEmail: string;
  collectorPhone?: string;
};

export type PlaceBidResponse = {
  success: boolean;
  bidId: string;
  bidReference: string;
  bid: AuctionBid;
  nextMinimumBid: number;
  message: string;
};

import { API_BASE_URL } from "@/constants/apiConfig";

export const AUCTION_BIDS_STORAGE_PREFIX = "@primo_auction_bids_";

export function getAuctionBidsStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${AUCTION_BIDS_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return `${AUCTION_BIDS_STORAGE_PREFIX}guest`;
}

/**
 * Retrieves cached auction bids from AsyncStorage.
 */
export async function getLocalBids(
  userId: string | number | null | undefined
): Promise<AuctionBid[]> {
  try {
    const key = getAuctionBidsStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[AuctionService] Failed to load local bids:", err);
    return [];
  }
}

/**
 * Persists an auction bid to local cache.
 */
export async function saveLocalBid(
  userId: string | number | null | undefined,
  bid: AuctionBid
): Promise<void> {
  try {
    const key = getAuctionBidsStorageKey(userId);
    const existing = await getLocalBids(userId);
    const deduped = [bid, ...existing.filter((b) => b.bidId !== bid.bidId)];
    await AsyncStorage.setItem(key, JSON.stringify(deduped));
  } catch (err) {
    console.warn("[AuctionService] Failed to save local bid:", err);
  }
}

/**
 * Retrieves all curated auction lots from the server.
 */
export async function getLiveAuctions(): Promise<AuctionLot[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/auctions`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data.lots) ? data.lots : [];
  } catch (err) {
    console.warn("[AuctionService] Error fetching auction lots:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Retrieves a single auction lot with live calculated minimum increment and status.
 */
export async function getAuctionLot(lotId: number): Promise<AuctionLot | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/auctions/${lotId}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.lot || null;
  } catch (err) {
    console.warn(`[AuctionService] Error fetching lot ${lotId}:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Places an authenticated VIP bid on an auction lot.
 */
export async function placeAuctionBid(payload: PlaceBidPayload): Promise<PlaceBidResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Authentication required. Please sign in to place an auction bid.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/auctions/${payload.lotId}/bid`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg =
        data.error ||
        (res.status === 429
          ? "You have reached the maximum allowed bids per minute. Please slow down."
          : "Unable to place auction bid.");
      throw new Error(errorMsg);
    }

    return data as PlaceBidResponse;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your internet connection.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Retrieves cloud-synced auction bids for the authenticated collector.
 */
export async function getCollectorCloudBids(): Promise<AuctionBid[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/my-bids`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data.bids) ? data.bids : [];
  } catch (err) {
    console.warn("[AuctionService] Cloud bids fetch notice:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
