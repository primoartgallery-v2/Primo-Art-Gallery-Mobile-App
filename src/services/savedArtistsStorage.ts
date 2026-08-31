import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken } from "./collectorStorage";

export const SAVED_ARTISTS_STORAGE_PREFIX = "@primo_saved_artists_";
export const GUEST_SAVED_ARTISTS_KEY = "@primo_saved_artists_guest";
export const PENDING_SAVED_ARTISTS_SYNC_PREFIX = "@primo_pending_saved_artists_sync_";

import { API_BASE_URL } from "@/constants/apiConfig";

export function getSavedArtistsStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${SAVED_ARTISTS_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return GUEST_SAVED_ARTISTS_KEY;
}

export function getPendingSavedArtistsSyncKey(userId: string | number): string {
  return `${PENDING_SAVED_ARTISTS_SYNC_PREFIX}${String(userId).trim()}`;
}

/**
 * Deduplicates and sanitizes artist IDs.
 */
export function deduplicateArtistIds(rawIds: (string | number)[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const raw of rawIds) {
    if (raw === undefined || raw === null) continue;
    const str = String(raw).trim();
    if (!str || seen.has(str)) continue;
    seen.add(str);
    clean.push(str);
  }

  return clean;
}

/**
 * Retrieves local saved artist IDs.
 */
export async function getLocalSavedArtists(
  userId: string | number | null | undefined
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getSavedArtistsStorageKey(userId));
    if (!raw) return [];
    return deduplicateArtistIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Persists local saved artist IDs.
 */
export async function saveLocalSavedArtists(
  userId: string | number | null | undefined,
  artistIds: (string | number)[]
): Promise<void> {
  try {
    const clean = deduplicateArtistIds(artistIds);
    await AsyncStorage.setItem(getSavedArtistsStorageKey(userId), JSON.stringify(clean));
  } catch (err) {
    console.warn("[SavedArtists] saveLocalSavedArtists error:", err);
  }
}

/**
 * Fetches saved artist IDs from Cloud Firestore via secure backend proxy.
 */
export async function getCloudSavedArtists(): Promise<string[] | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/saved-artists`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.artistIds)) {
      return deduplicateArtistIds(data.artistIds);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Synchronizes saved artist IDs to Cloud Firestore via secure backend proxy.
 */
export async function syncSavedArtistsToCloud(
  artistIds: string[],
  userId: string | number | null | undefined
): Promise<boolean> {
  if (!userId) return true; // Guest does not sync to cloud

  const cleanIds = deduplicateArtistIds(artistIds);
  const token = await getAuthToken();

  if (!token) {
    await AsyncStorage.setItem(
      getPendingSavedArtistsSyncKey(userId),
      JSON.stringify(cleanIds)
    );
    return false;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/saved-artists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ artistIds: cleanIds }),
    });

    if (res.ok) {
      await AsyncStorage.removeItem(getPendingSavedArtistsSyncKey(userId));
      return true;
    } else {
      await AsyncStorage.setItem(
        getPendingSavedArtistsSyncKey(userId),
        JSON.stringify(cleanIds)
      );
      return false;
    }
  } catch {
    await AsyncStorage.setItem(
      getPendingSavedArtistsSyncKey(userId),
      JSON.stringify(cleanIds)
    );
    return false;
  }
}

/**
 * Flushes any pending offline saved artists sync to Cloud Firestore.
 */
export async function flushPendingSavedArtistsSync(
  userId: string | number | null | undefined
): Promise<void> {
  if (!userId) return;
  const pendingKey = getPendingSavedArtistsSyncKey(userId);

  try {
    const pendingData = await AsyncStorage.getItem(pendingKey);
    if (!pendingData) return;

    const ids: string[] = JSON.parse(pendingData);
    if (Array.isArray(ids) && ids.length > 0) {
      await syncSavedArtistsToCloud(ids, userId);
    }
  } catch {}
}

/**
 * Toggles saved status for an artist.
 * Updates local cache instantly and dispatches background cloud sync.
 */
export async function toggleSavedArtist(
  artistId: string | number,
  userId: string | number | null | undefined
): Promise<{ isSaved: boolean; savedIds: string[] }> {
  const strId = String(artistId).trim();
  if (!strId) {
    const current = await getLocalSavedArtists(userId);
    return { isSaved: false, savedIds: current };
  }

  const current = await getLocalSavedArtists(userId);
  const isCurrentlySaved = current.includes(strId);
  const updated = isCurrentlySaved
    ? current.filter((id) => id !== strId)
    : [...current, strId];

  // 1. Instant local write
  await saveLocalSavedArtists(userId, updated);

  // 2. Dispatch background cloud sync if authenticated
  if (userId) {
    void syncSavedArtistsToCloud(updated, userId);
  }

  return { isSaved: !isCurrentlySaved, savedIds: updated };
}

/**
 * Merges guest saved artists into authenticated user's profile upon login.
 */
export async function mergeGuestSavedArtists(
  targetUserId: string | number
): Promise<string[]> {
  try {
    const guestRaw = await AsyncStorage.getItem(GUEST_SAVED_ARTISTS_KEY);
    const userIds = await getLocalSavedArtists(targetUserId);

    if (!guestRaw) {
      return userIds;
    }

    const guestIds: string[] = JSON.parse(guestRaw);
    if (!Array.isArray(guestIds) || guestIds.length === 0) {
      return userIds;
    }

    // Merge: union of guest and user IDs
    const merged = deduplicateArtistIds([...guestIds, ...userIds]);

    // Save to user's local cache
    await saveLocalSavedArtists(targetUserId, merged);

    // Clear guest storage
    await AsyncStorage.removeItem(GUEST_SAVED_ARTISTS_KEY);

    // Sync to cloud
    void syncSavedArtistsToCloud(merged, targetUserId);

    return merged;
  } catch {
    return [];
  }
}
