import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseAuth, getFirebaseAuthModule } from "./firebase";
import { getAuthToken, setAuthToken } from "./collectorStorage";
import { mergeGuestRecentlyViewed } from "./recentlyViewedStorage";
import { mergeGuestSavedArtists } from "./savedArtistsStorage";
import { syncGuestAddressesToCloud, syncPendingAddressesToCloud } from "./address";

// Storage keys
export const AUTH_USER_KEY = "@primo_auth_user";
export const LEGACY_AUTH_BACKUP_KEY = "@primo_legacy_auth_backup";
export const LEGACY_MIGRATION_COMPLETED_KEY = "@primo_legacy_migration_completed";
export const LEGACY_UNCLAIMED_BACKUP_KEY = "@primo_legacy_unclaimed_backup";

export const LEGACY_WISHLIST_GLOBAL_KEY = "@primo_gallery_wishlist_v1";
export const LEGACY_ADDRESSES_GLOBAL_KEY = "@primo_user_addresses";

import { API_BASE_URL } from "@/constants/apiConfig";

export type PrimoCollectorUser = {
  id: string | number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  avatar_url?: string;
  date_created?: string;
  auth_provider?: "email_otp" | "google";
};

// Aliased for 100% backward compatibility with existing components
export type WooCommerceCustomer = PrimoCollectorUser;

export type RegisterCustomerParams = {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  password?: string; // Legacy optional
};

export type UpdateProfileParams = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
};

/**
 * Sends a 6-digit OTP code to the collector's email address via the secure backend proxy.
 */
export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; message: string; expiresInSeconds: number }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Unable to connect to gallery authentication service. Please try again.");
    }

    if (!res.ok) {
      throw new Error(data.error || "Failed to send verification code. Please try again.");
    }

    return data;
  } catch (err: any) {
    console.error("[AuthService] sendEmailOtp error:", err);
    if (err.message?.includes("Network request failed") || err.message?.includes("Failed to fetch")) {
      throw new Error("Unable to connect to gallery server. Please ensure you are connected to internet and try again.");
    }
    throw err;
  }
}

export type VerifyOtpRegistrationOptions = {
  password?: string;
  fullName?: string;
  phone?: string;
};

/**
 * Verifies the 6-digit OTP and authenticates with a Firebase Custom Token.
 * Optionally completes registration if password / fullName / phone are provided.
 */
export async function verifyEmailOtp(
  email: string,
  otp: string,
  options?: VerifyOtpRegistrationOptions
): Promise<PrimoCollectorUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  let user: PrimoCollectorUser;
  let customToken: string | null = null;

  const payload: Record<string, any> = {
    email: cleanEmail,
    otp: cleanOtp,
  };

  if (options?.password && options.password.length >= 8) {
    payload.password = options.password;
  }
  if (options?.fullName && options.fullName.trim()) {
    payload.fullName = options.fullName.trim();
  }
  if (options?.phone && options.phone.trim()) {
    payload.phone = options.phone.trim();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Unable to verify code with server. Please try again.");
    }

    if (!res.ok) {
      const error = new Error(data.error || "Verification failed.");
      (error as any).locked = data.locked;
      (error as any).remainingAttempts = data.remainingAttempts;
      (error as any).remainingMinutes = data.remainingMinutes;
      throw error;
    }

    user = data.user;
    customToken = data.customToken;
  } catch (err: any) {
    if (err.locked || err.remainingAttempts !== undefined) {
      throw err;
    }

    if (err.message?.includes("Network request failed") || err.message?.includes("Failed to fetch")) {
      throw new Error("Unable to connect to server. Please check your internet connection.");
    }
    throw err;
  }

  // Sign into client Firebase Auth if customToken was provided
  if (customToken) {
    try {
      const auth = getFirebaseAuth();
      const fbAuthModule = getFirebaseAuthModule();
      if (auth && fbAuthModule?.signInWithCustomToken) {
        await fbAuthModule.signInWithCustomToken(auth, customToken);
      }
    } catch (fbErr: any) {
      console.warn("[AuthService] Client Firebase custom token sign-in notice:", fbErr?.message);
    }
  }

  // Save active user session
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  await setAuthToken(customToken);

  // Run non-destructive legacy data migration and guest merges
  await checkAndMigrateLegacyData(user.id, user.email);
  void mergeGuestRecentlyViewed(user.id);
  void mergeGuestSavedArtists(user.id);
  void syncGuestAddressesToCloud(user.id);
  void syncPendingAddressesToCloud(user.id);

  return user;
}

/**
 * Authenticates with Email + Password (instant login).
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<PrimoCollectorUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error("Please enter your email address.");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  let user: PrimoCollectorUser;
  let customToken: string | null = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Authentication response error. Please try again.");
    }

    if (!res.ok) {
      const error = new Error(data.error || "Authentication failed.");
      (error as any).isOtpOnlyUser = data.isOtpOnlyUser;
      throw error;
    }

    user = data.user;
    customToken = data.customToken;
  } catch (err: any) {
    if (err.isOtpOnlyUser) {
      throw err;
    }
    if (err.message?.includes("Network request failed") || err.message?.includes("Failed to fetch")) {
      throw new Error("Unable to connect to server. Please check your internet connection.");
    }
    throw err;
  }

  // Sign into client Firebase Auth if customToken was provided
  if (customToken) {
    try {
      const auth = getFirebaseAuth();
      const fbAuthModule = getFirebaseAuthModule();
      if (auth && fbAuthModule?.signInWithCustomToken) {
        await fbAuthModule.signInWithCustomToken(auth, customToken);
      }
    } catch (fbErr: any) {
      console.warn("[AuthService] Client Firebase custom token sign-in notice:", fbErr?.message);
    }
  }

  // Save active user session
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  await setAuthToken(customToken);

  // Run non-destructive legacy data migration and guest merges
  await checkAndMigrateLegacyData(user.id, user.email);
  void mergeGuestRecentlyViewed(user.id);
  void mergeGuestSavedArtists(user.id);
  void syncGuestAddressesToCloud(user.id);
  void syncPendingAddressesToCloud(user.id);

  return user;
}

/**
 * Resets user password using 6-digit OTP and authenticates immediately.
 */
export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<PrimoCollectorUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  if (!cleanEmail) {
    throw new Error("Please enter your email address.");
  }
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error("Verification code must be exactly 6 digits.");
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  let user: PrimoCollectorUser;
  let customToken: string | null = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, newPassword }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Password reset response error. Please try again.");
    }

    if (!res.ok) {
      const error = new Error(data.error || "Failed to reset password.");
      (error as any).locked = data.locked;
      (error as any).remainingAttempts = data.remainingAttempts;
      (error as any).remainingMinutes = data.remainingMinutes;
      throw error;
    }

    user = data.user;
    customToken = data.customToken;
  } catch (err: any) {
    if (err.locked || err.remainingAttempts !== undefined) {
      throw err;
    }
    if (err.message?.includes("Network request failed") || err.message?.includes("Failed to fetch")) {
      throw new Error("Unable to connect to server. Please check your internet connection.");
    }
    throw err;
  }

  // Sign into client Firebase Auth if customToken was provided
  if (customToken) {
    try {
      const auth = getFirebaseAuth();
      const fbAuthModule = getFirebaseAuthModule();
      if (auth && fbAuthModule?.signInWithCustomToken) {
        await fbAuthModule.signInWithCustomToken(auth, customToken);
      }
    } catch (fbErr: any) {
      console.warn("[AuthService] Client Firebase custom token sign-in notice:", fbErr?.message);
    }
  }

  // Save active user session
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  await setAuthToken(customToken);

  // Run non-destructive legacy data migration and guest merges
  await checkAndMigrateLegacyData(user.id, user.email);
  void mergeGuestRecentlyViewed(user.id);
  void mergeGuestSavedArtists(user.id);
  void syncGuestAddressesToCloud(user.id);
  void syncPendingAddressesToCloud(user.id);

  return user;
}

/**
 * Authenticates using a Google ID token verified server-side.
 */
export async function signInWithGoogle(
  idToken: string
): Promise<PrimoCollectorUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/google-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Google authentication failed.");
  }

  const user: PrimoCollectorUser = data.user;
  const customToken: string = data.customToken;

  if (customToken) {
    try {
      const auth = getFirebaseAuth();
      const fbAuthModule = getFirebaseAuthModule();
      if (auth && fbAuthModule?.signInWithCustomToken) {
        await fbAuthModule.signInWithCustomToken(auth, customToken);
      }
    } catch (fbErr: any) {
      console.warn("[AuthService] Firebase Google sign-in notice:", fbErr?.message);
    }
  }

  // Save active user session
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  await setAuthToken(customToken);

  // Run non-destructive legacy data migration and guest merges
  await checkAndMigrateLegacyData(user.id, user.email);
  void mergeGuestRecentlyViewed(user.id);
  void mergeGuestSavedArtists(user.id);
  void syncGuestAddressesToCloud(user.id);
  void syncPendingAddressesToCloud(user.id);

  return user;
}

/**
 * Fetches the currently authenticated collector session.
 */
export async function getStoredUser(): Promise<PrimoCollectorUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Updates profile details (Name, Phone, Avatar) and persists them locally and in Cloud Firestore.
 */
export async function updateStoredUserProfile(
  params: UpdateProfileParams
): Promise<PrimoCollectorUser> {
  const current = await getStoredUser();
  if (!current) {
    throw new Error("No active user session found.");
  }

  const updated: PrimoCollectorUser = {
    ...current,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    email: params.email.trim().toLowerCase(),
    avatar_url: params.avatarUrl !== undefined ? params.avatarUrl : current.avatar_url,
    billing: {
      ...current.billing,
      first_name: params.firstName.trim(),
      last_name: params.lastName.trim(),
      email: params.email.trim().toLowerCase(),
      phone: params.phone.trim(),
    },
  };

  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));

  // Sync profile customizations to Cloud Firestore in background
  void syncProfileToCloud({
    firstName: updated.first_name,
    lastName: updated.last_name,
    email: updated.email,
    phone: updated.billing?.phone || "",
    avatarUrl: updated.avatar_url || "avatar_1",
  });

  return updated;
}

/**
 * Fetches collector profile customizations from Cloud Firestore.
 */
export async function getCloudProfile(): Promise<UpdateProfileParams | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/profile`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.profile) {
      return data.profile;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists collector profile customizations to Cloud Firestore.
 */
export async function syncProfileToCloud(profile: UpdateProfileParams): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/collector/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profile }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Clears active user session on logout.
 */
export async function logoutUser(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    const fbAuthModule = getFirebaseAuthModule();
    if (auth && fbAuthModule?.signOut) {
      await fbAuthModule.signOut(auth).catch(() => {});
    }
  } catch {}
  await AsyncStorage.removeItem(AUTH_USER_KEY);
  await setAuthToken(null);
}

/**
 * Non-destructive Legacy Migration Engine.
 * Migrates legacy global wishlist and addresses ONLY if the authenticated user
 * matches the legacy session. Preserves existing UID-scoped data without destructive overwrite.
 */
export async function checkAndMigrateLegacyData(
  canonicalUid: string | number,
  authenticatedEmail: string
): Promise<void> {
  try {
    const isCompleted = await AsyncStorage.getItem(LEGACY_MIGRATION_COMPLETED_KEY);
    if (isCompleted === "true") {
      return;
    }

    const cleanEmail = authenticatedEmail.trim().toLowerCase();
    const uidStr = String(canonicalUid);

    // 1. Check if there was an active legacy session
    let legacyEmail: string | null = null;
    const legacyUserRaw = await AsyncStorage.getItem(AUTH_USER_KEY);
    const legacyBackupRaw = await AsyncStorage.getItem(LEGACY_AUTH_BACKUP_KEY);

    if (legacyBackupRaw) {
      try {
        const b = JSON.parse(legacyBackupRaw);
        legacyEmail = b.email?.toLowerCase();
      } catch {}
    } else if (legacyUserRaw) {
      try {
        const u = JSON.parse(legacyUserRaw);
        legacyEmail = u.email?.toLowerCase();
        // Archive legacy user session
        await AsyncStorage.setItem(LEGACY_AUTH_BACKUP_KEY, legacyUserRaw);
      } catch {}
    }

    const legacyWishlistRaw = await AsyncStorage.getItem(LEGACY_WISHLIST_GLOBAL_KEY);
    const legacyAddressesRaw = await AsyncStorage.getItem(LEGACY_ADDRESSES_GLOBAL_KEY);

    // If no legacy global data exists at all, mark migration completed
    if (!legacyWishlistRaw && !legacyAddressesRaw) {
      await AsyncStorage.setItem(LEGACY_MIGRATION_COMPLETED_KEY, "true");
      return;
    }

    // Check if the authenticated user matches the legacy session
    const isMatchingLegacyUser = legacyEmail && legacyEmail === cleanEmail;

    if (!isMatchingLegacyUser) {
      // Unrelated new user login:
      // Preserve legacy data in unclaimed backup and do NOT inject into new user's profile.
      // Migration remains pending for the rightful owner.
      if (!legacyBackupRaw && (legacyWishlistRaw || legacyAddressesRaw)) {
        await AsyncStorage.setItem(
          LEGACY_UNCLAIMED_BACKUP_KEY,
          JSON.stringify({
            legacyEmail,
            wishlist: legacyWishlistRaw ? JSON.parse(legacyWishlistRaw) : [],
            addresses: legacyAddressesRaw ? JSON.parse(legacyAddressesRaw) : [],
            archivedAt: new Date().toISOString(),
          })
        );
      }
      return;
    }

    // Matching legacy user! Non-destructively merge legacy data into UID-scoped namespace:
    const uidWishlistKey = `@primo_gallery_wishlist_${uidStr}`;
    const uidAddressesKey = `@primo_user_addresses_${uidStr}`;

    // A. Merge Wishlist non-destructively
    if (legacyWishlistRaw) {
      try {
        const legacyItems = JSON.parse(legacyWishlistRaw);
        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          const existingUidRaw = await AsyncStorage.getItem(uidWishlistKey);
          const existingUidItems = existingUidRaw ? JSON.parse(existingUidRaw) : [];

          // Combine and deduplicate by item.id
          const mergedWishlist = [...existingUidItems];
          for (const item of legacyItems) {
            if (!mergedWishlist.some((existing) => existing.id === item.id)) {
              mergedWishlist.push(item);
            }
          }
          await AsyncStorage.setItem(uidWishlistKey, JSON.stringify(mergedWishlist));
        }
      } catch (err) {
        console.warn("[LegacyMigration] Wishlist merge notice:", err);
      }
    }

    // B. Merge Addresses non-destructively
    if (legacyAddressesRaw) {
      try {
        const legacyAddresses = JSON.parse(legacyAddressesRaw);
        if (Array.isArray(legacyAddresses) && legacyAddresses.length > 0) {
          const existingUidRaw = await AsyncStorage.getItem(uidAddressesKey);
          const existingUidAddresses = existingUidRaw ? JSON.parse(existingUidRaw) : [];

          // Combine and deduplicate by address.id
          const mergedAddresses = [...existingUidAddresses];
          for (const addr of legacyAddresses) {
            if (!mergedAddresses.some((existing) => existing.id === addr.id)) {
              mergedAddresses.push(addr);
            }
          }
          await AsyncStorage.setItem(uidAddressesKey, JSON.stringify(mergedAddresses));
        }
      } catch (err) {
        console.warn("[LegacyMigration] Address merge notice:", err);
      }
    }

    // Mark migration completed and clean up legacy global keys safely
    await AsyncStorage.setItem(LEGACY_MIGRATION_COMPLETED_KEY, "true");
    await AsyncStorage.removeItem(LEGACY_WISHLIST_GLOBAL_KEY);
    await AsyncStorage.removeItem(LEGACY_ADDRESSES_GLOBAL_KEY);

    console.log(`[LegacyMigration] Successfully migrated legacy data for: ${cleanEmail} -> ${uidStr}`);
  } catch (err) {
    console.error("[LegacyMigration] Migration execution error:", err);
  }
}

// Backward-compatible stubs for existing components
export async function loginCustomer(email: string, pass: string): Promise<PrimoCollectorUser> {
  // Graceful fallback for legacy login calls
  return verifyEmailOtp(email, pass);
}

export async function registerCustomer(params: RegisterCustomerParams): Promise<PrimoCollectorUser> {
  return verifyEmailOtp(params.email, "000000");
}

export async function sendPasswordReset(email: string): Promise<boolean> {
  await sendEmailOtp(email);
  return true;
}
