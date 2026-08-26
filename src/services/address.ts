import AsyncStorage from "@react-native-async-storage/async-storage";

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
 * null -> @primo_user_addresses_guest
 * Firebase UID -> @primo_user_addresses_<uid>
 */
export function getAddressStorageKey(userId: string | null): string {
  if (userId && typeof userId === "string" && userId.trim().length > 0) {
    return `@primo_user_addresses_${userId.trim()}`;
  }
  return "@primo_user_addresses_guest";
}

/**
 * Fetch all stored addresses from UID-scoped AsyncStorage namespace.
 */
export async function getStoredAddresses(userId: string | null): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      // If guest has no addresses, provide sample default
      if (userId === null) {
        await AsyncStorage.setItem(key, JSON.stringify(DEFAULT_SAMPLE_ADDRESSES));
        return DEFAULT_SAMPLE_ADDRESSES;
      }
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return userId === null ? DEFAULT_SAMPLE_ADDRESSES : [];
  }
}

/**
 * Save or update an address in UID-scoped AsyncStorage namespace.
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
  userId: string | null
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const id = addressData.id || `addr_${Date.now()}`;
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

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("[AddressService] Failed to save address:", err);
    return getStoredAddresses(userId);
  }
}

/**
 * Delete an address by ID in UID-scoped AsyncStorage namespace.
 */
export async function deleteAddress(
  addressId: string,
  userId: string | null
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const filtered = existing.filter((a) => a.id !== addressId);

    // If deleted address was default and others remain, make first default
    if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
      filtered[0].isDefault = true;
    }

    await AsyncStorage.setItem(key, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.warn("[AddressService] Failed to delete address:", err);
    return getStoredAddresses(userId);
  }
}

/**
 * Mark a specific address as default in UID-scoped AsyncStorage namespace.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string | null
): Promise<UserAddress[]> {
  const key = getAddressStorageKey(userId);
  try {
    const existing = await getStoredAddresses(userId);
    const updated = existing.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("[AddressService] Failed to set default address:", err);
    return getStoredAddresses(userId);
  }
}
