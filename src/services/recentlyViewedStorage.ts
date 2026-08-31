import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken } from "./collectorStorage";
import type { WooCommerceProduct } from "./woocommerce";

export type RecentlyViewedItem = {
  id: number;
  name: string;
  price: string;
  imageUrl: string;
  artist: string;
  viewedAt: string;
};

export const RECENTLY_VIEWED_STORAGE_PREFIX = "@primo_recently_viewed_";
export const GUEST_RECENTLY_VIEWED_KEY = "@primo_recently_viewed_guest";
export const PENDING_RECENTLY_VIEWED_SYNC_PREFIX = "@primo_pending_recently_viewed_sync_";

import { API_BASE_URL } from "@/constants/apiConfig";

export function getRecentlyViewedStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${RECENTLY_VIEWED_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return GUEST_RECENTLY_VIEWED_KEY;
}

export function getPendingRecentlyViewedSyncKey(userId: string | number): string {
  return `${PENDING_RECENTLY_VIEWED_SYNC_PREFIX}${String(userId).trim()}`;
}

/**
 * Deduplicates recently viewed items by numeric ID, keeping newest viewedAt, max 20 items.
 */
export function deduplicateRecentlyViewed(items: RecentlyViewedItem[]): RecentlyViewedItem[] {
  const itemMap = new Map<number, RecentlyViewedItem>();

  for (const item of items) {
    if (!item || item.id === undefined || item.id === null) continue;
    const numId = Number(item.id);
    if (isNaN(numId)) continue;

    if (itemMap.has(numId)) {
      const existing = itemMap.get(numId)!;
      if (new Date(item.viewedAt) > new Date(existing.viewedAt)) {
        itemMap.set(numId, item);
      }
    } else {
      itemMap.set(numId, item);
    }
  }

  return Array.from(itemMap.values())
    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
    .slice(0, 20);
}

/**
 * Retrieves local recently viewed artworks.
 */
export async function getLocalRecentlyViewed(
  userId: string | number | null | undefined
): Promise<RecentlyViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(getRecentlyViewedStorageKey(userId));
    if (!raw) return [];
    return deduplicateRecentlyViewed(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Persists local recently viewed artworks.
 */
export async function saveLocalRecentlyViewed(
  userId: string | number | null | undefined,
  items: RecentlyViewedItem[]
): Promise<void> {
  try {
    const clean = deduplicateRecentlyViewed(items);
    await AsyncStorage.setItem(getRecentlyViewedStorageKey(userId), JSON.stringify(clean));
  } catch (err) {
    console.warn("[RecentlyViewed] saveLocalRecentlyViewed error:", err);
  }
}

/**
 * Fetches recently viewed artworks from Cloud Firestore via secure backend proxy.
 */
export async function getCloudRecentlyViewed(): Promise<RecentlyViewedItem[] | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/recently-viewed`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      return deduplicateRecentlyViewed(data.items);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Synchronizes recently viewed items to Cloud Firestore via secure backend proxy.
 */
export async function syncRecentlyViewedToCloud(
  items: RecentlyViewedItem[],
  userId: string | number | null | undefined
): Promise<boolean> {
  if (!userId) return true; // Guest does not sync to cloud

  const cleanItems = deduplicateRecentlyViewed(items);
  const token = await getAuthToken();

  if (!token) {
    await AsyncStorage.setItem(
      getPendingRecentlyViewedSyncKey(userId),
      JSON.stringify(cleanItems)
    );
    return false;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/recently-viewed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: cleanItems }),
    });

    if (res.ok) {
      await AsyncStorage.removeItem(getPendingRecentlyViewedSyncKey(userId));
      return true;
    } else {
      await AsyncStorage.setItem(
        getPendingRecentlyViewedSyncKey(userId),
        JSON.stringify(cleanItems)
      );
      return false;
    }
  } catch {
    await AsyncStorage.setItem(
      getPendingRecentlyViewedSyncKey(userId),
      JSON.stringify(cleanItems)
    );
    return false;
  }
}

/**
 * Flushes any pending offline recently viewed sync to Cloud Firestore.
 */
export async function flushPendingRecentlyViewedSync(
  userId: string | number | null | undefined
): Promise<void> {
  if (!userId) return;
  const pendingKey = getPendingRecentlyViewedSyncKey(userId);

  try {
    const pendingData = await AsyncStorage.getItem(pendingKey);
    if (!pendingData) return;

    const items: RecentlyViewedItem[] = JSON.parse(pendingData);
    if (Array.isArray(items) && items.length > 0) {
      await syncRecentlyViewedToCloud(items, userId);
    }
  } catch {}
}

/**
 * Records an artwork view. Moves item to index 0, deduplicates, trims to max 20,
 * writes to local cache immediately, and dispatches cloud sync.
 */
export async function recordArtworkView(
  product: WooCommerceProduct,
  userId: string | number | null | undefined
): Promise<RecentlyViewedItem[]> {
  if (!product || !product.id) return [];

  const numId = Number(product.id);
  if (isNaN(numId)) return [];

  const newItem: RecentlyViewedItem = {
    id: numId,
    name: String(product.name || "Untitled Artwork").trim(),
    price: String(product.price || product.regular_price || ""),
    imageUrl: String(product.images?.[0]?.src || ""),
    artist: String(product.categories?.[0]?.name || "Primo Art Gallery"),
    viewedAt: new Date().toISOString(),
  };

  const current = await getLocalRecentlyViewed(userId);
  // Remove any previous occurrence of this artwork
  const filtered = current.filter((item) => item.id !== numId);
  // Place at position 0 and limit to 20
  const updated = [newItem, ...filtered].slice(0, 20);

  // 1. Instant local cache update
  await saveLocalRecentlyViewed(userId, updated);

  // 2. Dispatch background cloud sync if authenticated
  if (userId) {
    void syncRecentlyViewedToCloud(updated, userId);
  }

  return updated;
}

/**
 * Merges guest recently viewed history into authenticated user's history upon login.
 */
export async function mergeGuestRecentlyViewed(
  targetUserId: string | number
): Promise<RecentlyViewedItem[]> {
  try {
    const guestRaw = await AsyncStorage.getItem(GUEST_RECENTLY_VIEWED_KEY);
    const userItems = await getLocalRecentlyViewed(targetUserId);

    if (!guestRaw) {
      return userItems;
    }

    const guestItems: RecentlyViewedItem[] = JSON.parse(guestRaw);
    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      return userItems;
    }

    // Merge: combine both lists, deduplicate by ID preserving newest viewedAt, max 20
    const merged = deduplicateRecentlyViewed([...guestItems, ...userItems]);

    // Save to user's local cache
    await saveLocalRecentlyViewed(targetUserId, merged);

    // Clear guest history
    await AsyncStorage.removeItem(GUEST_RECENTLY_VIEWED_KEY);

    // Sync to cloud
    void syncRecentlyViewedToCloud(merged, targetUserId);

    return merged;
  } catch {
    return [];
  }
}
