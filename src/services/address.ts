import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/apiConfig";
import { getAuthToken } from "./collectorStorage";

export type UserAddress = {
  id: string;
  title: string; // e.g. "Home", "Office", "Studio", "Gallery"
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
};

export const PENDING_ADDRESSES_SYNC_PREFIX = "@primo_pending_addresses_sync_";
export const ADDRESSES_STORAGE_PREFIX = "@primo_user_addresses_";
export const GUEST_ADDRESSES_KEY = "@primo_user_addresses_guest";

const DEFAULT_SAMPLE_ADDRESSES: UserAddress[] = [
  {
    id: "addr_1",
    title: "Home",
    fullName: "Atul Pandey",
    phone: "+91 98765 43210",
    addressLine1: "Flat 402, Royal Palms Residency",
    addressLine2: "Near City Center",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    country: "India",
    isDefault: true,
  },
];

/**
 * Resolves the explicit storage namespace for addresses.
 * null/undefined -> @primo_user_addresses_guest
 * Firebase UID -> @primo_user_addresses_<uid>
 */
export function getAddressStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `${ADDRESSES_STORAGE_PREFIX}${String(userId).trim()}`;
  }
  return GUEST_ADDRESSES_KEY;
}

export function getPendingAddressesSyncKey(userId: string | number): string {
  return `${PENDING_ADDRESSES_SYNC_PREFIX}${String(userId).trim()}`;
}

/**
 * Normalizes and deduplicates addresses by ID, enforcing the default address invariant.
 */
export function deduplicateAddresses(addresses: UserAddress[]): UserAddress[] {
  const seen = new Set<string>();
  const result: UserAddress[] = [];
  let hasDefault = false;

  for (const a of addresses) {
    if (!a || !a.id) continue;
    const strId = String(a.id).trim();
    if (!strId || seen.has(strId)) continue;
    seen.add(strId);

    const isDefault = Boolean(a.isDefault);
    if (isDefault && !hasDefault) {
      hasDefault = true;
    }

    result.push({
      id: strId,
      title: a.title ? a.title.trim() : "Home",
      fullName: a.fullName ? a.fullName.trim() : "",
      phone: a.phone ? a.phone.trim() : "",
      addressLine1: a.addressLine1 ? a.addressLine1.trim() : "",
      addressLine2: a.addressLine2 ? a.addressLine2.trim() : "",
      city: a.city ? a.city.trim() : "",
      state: a.state ? a.state.trim() : "",
      pincode: a.pincode ? a.pincode.trim() : "",
      country: a.country ? a.country.trim() : "India",
      isDefault: isDefault && hasDefault,
    });
  }

  // If addresses exist but none was default, make first default
  if (result.length > 0 && !result.some((a) => a.isDefault)) {
    result[0].isDefault = true;
  }

  return result;
}

/**
 * Fetch all stored addresses from UID-scoped AsyncStorage namespace.
 */
export async function getStoredAddresses(userId: string | number | null | undefined): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      if (userId === null || userId === undefined) {
        await AsyncStorage.setItem(key, JSON.stringify(DEFAULT_SAMPLE_ADDRESSES));
        return DEFAULT_SAMPLE_ADDRESSES;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? deduplicateAddresses(parsed) : [];
  } catch {
    return (userId === null || userId === undefined) ? DEFAULT_SAMPLE_ADDRESSES : [];
  }
}

/**
 * Fetches user's addresses from Cloud Firestore via secure backend proxy.
 */
export async function getCloudAddresses(): Promise<UserAddress[] | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/addresses`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.addresses)) {
      return deduplicateAddresses(data.addresses);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists addresses to Cloud Firestore via secure backend proxy with offline queueing.
 */
export async function syncAddressesToCloud(
  userId: string | number | null | undefined,
  addresses: UserAddress[]
): Promise<boolean> {
  if (!userId) return true;

  const token = await getAuthToken();
  const cleanAddresses = deduplicateAddresses(addresses);

  if (!token) {
    try {
      const pendingKey = getPendingAddressesSyncKey(userId);
      await AsyncStorage.setItem(pendingKey, JSON.stringify(cleanAddresses));
    } catch {}
    return false;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ addresses: cleanAddresses }),
    });

    if (res.ok) {
      const pendingKey = getPendingAddressesSyncKey(userId);
      await AsyncStorage.removeItem(pendingKey).catch(() => {});
      return true;
    } else {
      const pendingKey = getPendingAddressesSyncKey(userId);
      await AsyncStorage.setItem(pendingKey, JSON.stringify(cleanAddresses)).catch(() => {});
      return false;
    }
  } catch {
    const pendingKey = getPendingAddressesSyncKey(userId);
    await AsyncStorage.setItem(pendingKey, JSON.stringify(cleanAddresses)).catch(() => {});
    return false;
  }
}

/**
 * Flushes any pending offline address mutations to Cloud Firestore.
 */
export async function syncPendingAddressesToCloud(userId: string | number): Promise<boolean> {
  if (!userId) return true;
  try {
    const pendingKey = getPendingAddressesSyncKey(userId);
    const raw = await AsyncStorage.getItem(pendingKey);
    if (!raw) return true;

    const pendingAddresses: UserAddress[] = JSON.parse(raw);
    if (!Array.isArray(pendingAddresses)) {
      await AsyncStorage.removeItem(pendingKey);
      return true;
    }

    return await syncAddressesToCloud(userId, pendingAddresses);
  } catch {
    return false;
  }
}

/**
 * Merges guest addresses into the authenticated user's address book on login.
 */
export async function syncGuestAddressesToCloud(userId: string | number): Promise<UserAddress[]> {
  if (!userId) return [];

  try {
    const guestRaw = await AsyncStorage.getItem(GUEST_ADDRESSES_KEY);
    const guestAddresses: UserAddress[] = guestRaw ? JSON.parse(guestRaw) : [];

    const userKey = getAddressStorageKey(userId);
    const userRaw = await AsyncStorage.getItem(userKey);
    const userAddresses: UserAddress[] = userRaw ? JSON.parse(userRaw) : [];

    // Filter out default sample address if merging real user addresses
    const filteredGuest = guestAddresses.filter((a) => a.id !== "addr_1" || userAddresses.length === 0);

    const merged = deduplicateAddresses([...userAddresses, ...filteredGuest]);
    await AsyncStorage.setItem(userKey, JSON.stringify(merged));
    await AsyncStorage.removeItem(GUEST_ADDRESSES_KEY).catch(() => {});

    // Try cloud sync in background
    void syncAddressesToCloud(userId, merged);

    return merged;
  } catch {
    return getStoredAddresses(userId);
  }
}

/**
 * Save or update an address in UID-scoped storage and sync to Cloud Firestore.
 */
export async function saveAddress(
  addressData: Partial<UserAddress> & {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  },
  userId: string | number | null | undefined
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const id = addressData.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isFirstAddress = existing.length === 0;
    const shouldBeDefault = addressData.isDefault || isFirstAddress;

    let updated: UserAddress[];

    const newEntry: UserAddress = {
      id,
      title: addressData.title || "Home",
      fullName: addressData.fullName.trim(),
      phone: addressData.phone.trim(),
      addressLine1: addressData.addressLine1.trim(),
      addressLine2: addressData.addressLine2?.trim() || "",
      city: addressData.city.trim(),
      state: addressData.state.trim(),
      pincode: addressData.pincode.trim(),
      country: addressData.country || "India",
      isDefault: shouldBeDefault,
    };

    if (addressData.id) {
      // Edit existing
      updated = existing.map((a) => {
        if (a.id === id) {
          return newEntry;
        }
        return shouldBeDefault ? { ...a, isDefault: false } : a;
      });
    } else {
      // Add new
      if (shouldBeDefault) {
        updated = existing.map((a) => ({ ...a, isDefault: false }));
        updated.push(newEntry);
      } else {
        updated = [...existing, newEntry];
      }
    }

    const clean = deduplicateAddresses(updated);
    await AsyncStorage.setItem(key, JSON.stringify(clean));

    if (userId) {
      void syncAddressesToCloud(userId, clean);
    }

    return clean;
  } catch (err) {
    console.warn("[AddressService] Failed to save address:", err);
    return getStoredAddresses(userId);
  }
}

/**
 * Delete an address by ID in UID-scoped storage and sync to Cloud Firestore.
 */
export async function deleteAddress(
  addressId: string,
  userId: string | number | null | undefined
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const filtered = existing.filter((a) => a.id !== addressId);

    const clean = deduplicateAddresses(filtered);
    await AsyncStorage.setItem(key, JSON.stringify(clean));

    if (userId) {
      void syncAddressesToCloud(userId, clean);
    }

    return clean;
  } catch (err) {
    console.warn("[AddressService] Failed to delete address:", err);
    return getStoredAddresses(userId);
  }
}

/**
 * Mark a specific address as default in UID-scoped storage and sync to Cloud Firestore.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string | number | null | undefined
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const updated = existing.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));

    const clean = deduplicateAddresses(updated);
    await AsyncStorage.setItem(key, JSON.stringify(clean));

    if (userId) {
      void syncAddressesToCloud(userId, clean);
    }

    return clean;
  } catch (err) {
    console.warn("[AddressService] Failed to set default address:", err);
    return getStoredAddresses(userId);
  }
}
