import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WooCommerceProduct } from "./woocommerce";
import { getIdToken, saveSessionCredentials, clearSessionCredentials } from "./secureStore";

export const AUTH_TOKEN_KEY = "@primo_auth_token";
export const PENDING_WISHLIST_SYNC_PREFIX = "@primo_pending_wishlist_sync_";
export const WISHLIST_STORAGE_PREFIX = "@primo_gallery_wishlist_";
export const GUEST_WISHLIST_KEY = "@primo_gallery_wishlist_guest";

import { API_BASE_URL } from "@/constants/apiConfig";

/**
 * Gets the stored authentication token from hardware-backed SecureStore.
 */
export async function getAuthToken(): Promise<string | null> {
  return getIdToken();
}

/**
 * Stores or clears the authentication token in hardware-backed SecureStore.
 */
export async function setAuthToken(token: string | null): Promise<void> {
  if (token) {
    await saveSessionCredentials({ idToken: token });
  } else {
    await clearSessionCredentials();
  }
}

export function getWishlistStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${WISHLIST_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return GUEST_WISHLIST_KEY;
}

export function getPendingWishlistSyncKey(userId: string | number): string {
  return `${PENDING_WISHLIST_SYNC_PREFIX}${String(userId).trim()}`;
}

/**
 * Normalizes a list of products to ensure deduplication by ID.
 */
export function deduplicateProducts(products: WooCommerceProduct[]): WooCommerceProduct[] {
  const seen = new Set<number>();
  const result: WooCommerceProduct[] = [];

  for (const p of products) {
    if (!p || p.id === undefined || p.id === null) continue;
    const numId = Number(p.id);
    if (!seen.has(numId)) {
      seen.add(numId);
      result.push(p);
    }
  }

  return result;
}

import { authenticatedFetch } from "./sessionManager";

/**
 * Fetches user's wishlist from Cloud Firestore via secure backend proxy.
 */
export async function fetchCloudWishlist(): Promise<WooCommerceProduct[] | null> {
  try {
    const res = await authenticatedFetch(`${API_BASE_URL}/api/collector/wishlist`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      return deduplicateProducts(data.items);
    }
    return null;
  } catch {
    // Network offline or server unreachable - rely on local cache
    return null;
  }
}

/**
 * Persists wishlist to Cloud Firestore via secure backend proxy.
 * Enqueues in pending sync queue if offline.
 */
export async function syncWishlistToCloud(
  items: WooCommerceProduct[],
  userId: string | number | null | undefined
): Promise<boolean> {
  if (!userId) return true; // Guest does not sync to cloud

  const cleanItems = deduplicateProducts(items);

  try {
    const res = await authenticatedFetch(`${API_BASE_URL}/api/collector/wishlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items: cleanItems }),
    });

    if (res.ok) {
      // Clear pending queue on successful sync
      await AsyncStorage.removeItem(getPendingWishlistSyncKey(userId));
      return true;
    } else {
      // Server returned error (e.g. 500) -> Enqueue
      await AsyncStorage.setItem(getPendingWishlistSyncKey(userId), JSON.stringify(cleanItems));
      return false;
    }
  } catch {
    // Network error -> Enqueue
    await AsyncStorage.setItem(getPendingWishlistSyncKey(userId), JSON.stringify(cleanItems));
    return false;
  }
}

/**
 * Flushes any pending offline sync changes to the cloud.
 */
export async function flushPendingWishlistSync(userId: string | number): Promise<void> {
  if (!userId) return;
  const pendingKey = getPendingWishlistSyncKey(userId);

  try {
    const pendingData = await AsyncStorage.getItem(pendingKey);
    if (!pendingData) return;

    const items: WooCommerceProduct[] = JSON.parse(pendingData);
    if (Array.isArray(items)) {
      await syncWishlistToCloud(items, userId);
    }
  } catch {
    // Keep in pending queue
  }
}

/**
 * Merges local guest wishlist items into an authenticated user's wishlist upon login.
 */
export async function mergeGuestWishlistIntoUser(
  targetUserId: string | number,
  currentUserItems: WooCommerceProduct[]
): Promise<WooCommerceProduct[]> {
  try {
    const guestData = await AsyncStorage.getItem(GUEST_WISHLIST_KEY);
    if (!guestData) return currentUserItems;

    const guestItems: WooCommerceProduct[] = JSON.parse(guestData);
    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      return currentUserItems;
    }

    // Merge: Guest items + current user items (deduped)
    const merged = deduplicateProducts([...guestItems, ...currentUserItems]);

    // Save to user's local cache
    await AsyncStorage.setItem(getWishlistStorageKey(targetUserId), JSON.stringify(merged));

    // Clear guest wishlist
    await AsyncStorage.removeItem(GUEST_WISHLIST_KEY);

    // Sync merged state to cloud
    void syncWishlistToCloud(merged, targetUserId);

    return merged;
  } catch {
    return currentUserItems;
  }
}
