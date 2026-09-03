import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/apiConfig";
import { authenticatedFetch } from "./sessionManager";

export const COLLECTOR_ENQUIRIES_CACHE_PREFIX = "@primo_collector_enquiries_";

export type ArtworkEnquiryPayload = {
  artworkId: number;
  artworkTitle: string;
  collectorName: string;
  collectorEmail: string;
  collectorPhone?: string;
  message: string;
};

export type ArtworkEnquiryResult = {
  success: boolean;
  enquiryId?: string;
  message?: string;
  error?: string;
  rateLimited?: boolean;
};

export type CollectorEnquiryItem = {
  enquiryId: string;
  artworkId: number;
  artworkTitle: string;
  collectorUid: string | null;
  collectorName: string;
  collectorEmail: string;
  collectorPhone?: string | null;
  message: string;
  status: string;
  createdAt: string;
  source?: string;
};

export type CollectorEnquiriesResult = {
  success: boolean;
  enquiries: CollectorEnquiryItem[];
  error?: string;
  isOffline?: boolean;
  sessionExpired?: boolean;
};

/**
 * Returns the storage key for a user's non-sensitive local enquiry display cache.
 */
export function getEnquiriesCacheKey(userId: string | number | null | undefined): string | null {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${COLLECTOR_ENQUIRIES_CACHE_PREFIX}${String(userId).trim()}`;
  }
  return null;
}

/**
 * Retrieves non-sensitive cached enquiries strictly scoped to the specified user UID.
 */
export async function getStoredEnquiries(userId: string | number | null | undefined): Promise<CollectorEnquiryItem[]> {
  const key = getEnquiriesCacheKey(userId);
  if (!key) return [];

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists non-sensitive cached enquiries strictly for the specified user UID.
 */
export async function saveStoredEnquiries(
  userId: string | number | null | undefined,
  enquiries: CollectorEnquiryItem[]
): Promise<void> {
  const key = getEnquiriesCacheKey(userId);
  if (!key || !Array.isArray(enquiries)) return;

  try {
    await AsyncStorage.setItem(key, JSON.stringify(enquiries));
  } catch (err) {
    if (__DEV__) {
      console.warn("[EnquiryService] saveStoredEnquiries notice:", err);
    }
  }
}

/**
 * Securely clears a user's local enquiry cache on logout.
 */
export async function clearStoredEnquiries(userId: string | number | null | undefined): Promise<void> {
  const key = getEnquiriesCacheKey(userId);
  if (!key) return;

  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    if (__DEV__) {
      console.warn("[EnquiryService] clearStoredEnquiries notice:", err);
    }
  }
}

/**
 * Retrieves all acquisition enquiries submitted by the authenticated collector.
 * Uses hardware-backed ID token, user-scoped offline cache, and silent 401 retry recovery.
 */
export async function getCollectorEnquiries(userId?: string | number | null): Promise<CollectorEnquiriesResult> {
  // 1. Instantly load user-scoped local cache if userId is known
  const localCached = userId ? await getStoredEnquiries(userId) : [];

  try {
    const res = await authenticatedFetch(`${API_BASE_URL}/api/collector/enquiries`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (res.status === 401) {
      return {
        success: false,
        enquiries: localCached,
        sessionExpired: true,
        error: "Your session has expired. Please sign in again.",
      };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // On temporary server errors, preserve local cached data without raising fatal UI sync error
      return {
        success: true,
        enquiries: localCached,
        isOffline: true,
        error: data.error || `Server responded with status ${res.status}`,
      };
    }

    const data = await res.json();
    const serverEnquiries: CollectorEnquiryItem[] = Array.isArray(data.enquiries) ? data.enquiries : [];

    // Update user-scoped local cache
    if (userId) {
      void saveStoredEnquiries(userId, serverEnquiries);
    }

    return {
      success: true,
      enquiries: serverEnquiries,
    };
  } catch (netErr: any) {
    if (__DEV__) {
      console.warn("[EnquiryService] getCollectorEnquiries network notice:", netErr?.message);
    }
    // Offline / Render cold-start: Return cached enquiries gracefully
    return {
      success: true,
      enquiries: localCached,
      isOffline: true,
    };
  }
}

/**
 * Submits an artwork acquisition enquiry to the Render backend proxy.
 * Automatically injects valid Bearer token and optimistically updates local cache.
 */
export async function submitArtworkEnquiry(
  payload: ArtworkEnquiryPayload,
  userId?: string | number | null
): Promise<ArtworkEnquiryResult> {
  try {
    const res = await authenticatedFetch(`${API_BASE_URL}/api/enquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      return {
        success: false,
        rateLimited: true,
        error: data.error || "Enquiry limit exceeded. Maximum 5 enquiries allowed per hour.",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Failed to submit enquiry. Please try again.",
      };
    }

    // Optimistically prepend to local cache for instant UI feedback
    if (userId && data.enquiryId) {
      try {
        const current = await getStoredEnquiries(userId);
        const optimisticItem: CollectorEnquiryItem = {
          enquiryId: data.enquiryId,
          artworkId: payload.artworkId,
          artworkTitle: payload.artworkTitle,
          collectorUid: String(userId),
          collectorName: payload.collectorName,
          collectorEmail: payload.collectorEmail,
          collectorPhone: payload.collectorPhone || null,
          message: payload.message,
          status: "Under Curatorial Review",
          createdAt: new Date().toISOString(),
        };
        const updated = [optimisticItem, ...current.filter((e) => e.enquiryId !== data.enquiryId)];
        void saveStoredEnquiries(userId, updated);
      } catch {}
    }

    return {
      success: true,
      enquiryId: data.enquiryId,
      message: data.message,
    };
  } catch (err: any) {
    if (__DEV__) {
      console.warn("[EnquiryService] submitArtworkEnquiry network notice:", err?.message);
    }
    return {
      success: false,
      error: "Unable to connect to gallery service. Please check your internet connection.",
    };
  }
}
