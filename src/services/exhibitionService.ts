import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/apiConfig";
import { getAuthToken } from "./collectorStorage";

export type ExhibitionVipPass = {
  passId: string;
  rsvpId: string;
  exhibitionId: number;
  exhibitionTitle: string;
  exhibitionDates: string;
  exhibitionTimings: string;
  exhibitionVenue: string;
  collectorName: string;
  collectorEmail: string;
  guestCount: number;
  status: string;
  qrCodeData: string;
  issuedAt: string;
};

export type ExhibitionRsvpPayload = {
  exhibitionId: number;
  exhibitionTitle?: string;
  exhibitionDates?: string;
  exhibitionTimings?: string;
  exhibitionVenue?: string;
  collectorName: string;
  collectorEmail: string;
  collectorPhone?: string;
  guestCount: number;
  message?: string;
};

export type ExhibitionRsvpResponse = {
  success: boolean;
  rsvpId: string;
  passId: string;
  pass: ExhibitionVipPass;
  message: string;
};

export const PASSES_STORAGE_PREFIX = "@primo_exhibition_passes_";
export const GUEST_PASSES_STORAGE_KEY = "@primo_exhibition_passes_guest";

export function getPassesStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${PASSES_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return GUEST_PASSES_STORAGE_KEY;
}

/**
 * Retrieves cached VIP exhibition passes from AsyncStorage.
 */
export async function getLocalExhibitionPasses(
  userId: string | number | null | undefined
): Promise<ExhibitionVipPass[]> {
  try {
    const key = getPassesStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[ExhibitionService] Failed to load local passes:", err);
    return [];
  }
}

/**
 * Persists an exhibition VIP pass to local cache.
 */
export async function saveLocalExhibitionPass(
  userId: string | number | null | undefined,
  pass: ExhibitionVipPass
): Promise<void> {
  try {
    const key = getPassesStorageKey(userId);
    const existing = await getLocalExhibitionPasses(userId);
    const deduped = [pass, ...existing.filter((p) => p.passId !== pass.passId)];
    await AsyncStorage.setItem(key, JSON.stringify(deduped));
  } catch (err) {
    console.warn("[ExhibitionService] Failed to save local pass:", err);
  }
}

/**
 * Submits an Exhibition VIP RSVP to the secure backend proxy.
 */
export async function submitExhibitionRsvp(
  payload: ExhibitionRsvpPayload
): Promise<ExhibitionRsvpResponse> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/exhibitions/rsvp`, {
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
          ? "You have reached the maximum allowed RSVP requests. Please wait a while."
          : "Unable to complete exhibition RSVP.");
      throw new Error(errorMsg);
    }

    return data as ExhibitionRsvpResponse;
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
 * Retrieves cloud-synced VIP exhibition passes for the authenticated collector.
 */
export async function getCloudExhibitionPasses(): Promise<ExhibitionVipPass[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/exhibition-passes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data.passes) ? data.passes : [];
  } catch (err) {
    console.warn("[ExhibitionService] Cloud passes fetch notice:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
