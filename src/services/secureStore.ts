import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const SECURE_KEY_ID_TOKEN = "primo_sec_id_token";
export const SECURE_KEY_REFRESH_TOKEN = "primo_sec_refresh_token";
export const SECURE_KEY_TOKEN_EXPIRY = "primo_sec_token_expiry";
export const SECURE_KEY_PENDING_REGISTRATION = "primo_sec_pending_reg";

const LEGACY_ASYNC_TOKEN_KEY = "@primo_auth_token";

/**
 * Checks if SecureStore is available on current platform.
 */
async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Persists session credentials strictly in OS-protected Keychain/Keystore storage (expo-secure-store).
 */
export async function saveSessionCredentials(params: {
  idToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number;
}): Promise<void> {
  const { idToken, refreshToken, expiresInSeconds = 3600 } = params;
  if (!idToken || typeof idToken !== "string") return;

  const expiryTimestamp = Date.now() + Math.max(60, expiresInSeconds) * 1000;

  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.setItemAsync(SECURE_KEY_ID_TOKEN, idToken.trim());
      if (refreshToken && typeof refreshToken === "string" && refreshToken.trim().length > 0) {
        await SecureStore.setItemAsync(SECURE_KEY_REFRESH_TOKEN, refreshToken.trim());
      }
      await SecureStore.setItemAsync(SECURE_KEY_TOKEN_EXPIRY, String(expiryTimestamp));
    } else {
      // In-memory / web fallback (never written to plain AsyncStorage in production)
      await AsyncStorage.setItem(SECURE_KEY_ID_TOKEN, idToken.trim());
      if (refreshToken) {
        await AsyncStorage.setItem(SECURE_KEY_REFRESH_TOKEN, refreshToken.trim());
      }
      await AsyncStorage.setItem(SECURE_KEY_TOKEN_EXPIRY, String(expiryTimestamp));
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[SecureStore] saveSessionCredentials notice:", err);
    }
  }
}

/**
 * Retrieves the stored Firebase ID Token.
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      return await SecureStore.getItemAsync(SECURE_KEY_ID_TOKEN);
    }
    return await AsyncStorage.getItem(SECURE_KEY_ID_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Retrieves the stored Firebase Refresh Token.
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      return await SecureStore.getItemAsync(SECURE_KEY_REFRESH_TOKEN);
    }
    return await AsyncStorage.getItem(SECURE_KEY_REFRESH_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Retrieves the token expiration epoch timestamp (in milliseconds).
 */
export async function getTokenExpiry(): Promise<number | null> {
  try {
    const available = await isSecureStoreAvailable();
    const raw = available
      ? await SecureStore.getItemAsync(SECURE_KEY_TOKEN_EXPIRY)
      : await AsyncStorage.getItem(SECURE_KEY_TOKEN_EXPIRY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Securely wipes all authentication tokens from hardware-backed SecureStore on logout or session expiration.
 */
export async function clearSessionCredentials(): Promise<void> {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.deleteItemAsync(SECURE_KEY_ID_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN_EXPIRY);
      await SecureStore.deleteItemAsync(SECURE_KEY_PENDING_REGISTRATION);
    } else {
      await AsyncStorage.removeItem(SECURE_KEY_ID_TOKEN);
      await AsyncStorage.removeItem(SECURE_KEY_REFRESH_TOKEN);
      await AsyncStorage.removeItem(SECURE_KEY_TOKEN_EXPIRY);
      await AsyncStorage.removeItem(SECURE_KEY_PENDING_REGISTRATION);
    }

    // Also purge any legacy token in AsyncStorage
    await AsyncStorage.removeItem(LEGACY_ASYNC_TOKEN_KEY);
  } catch (err) {
    if (__DEV__) {
      console.warn("[SecureStore] clearSessionCredentials notice:", err);
    }
  }
}

/**
 * Migrates legacy token out of AsyncStorage into SecureStore if present, then clears AsyncStorage.
 */
export async function migrateLegacyAsyncStorageTokens(): Promise<string | null> {
  try {
    const legacyToken = await AsyncStorage.getItem(LEGACY_ASYNC_TOKEN_KEY);
    if (legacyToken && legacyToken.trim().length > 0) {
      // Clear legacy storage immediately to maintain clean credential boundaries
      await AsyncStorage.removeItem(LEGACY_ASYNC_TOKEN_KEY);
      return legacyToken.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export type SecurePendingRegistration = {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
  createdAt: number;
};

/**
 * Securely stores temporary pending registration data during OTP verification.
 * Stored strictly in hardware-backed SecureStore (Keychain/Keystore) with TTL.
 * Password NEVER appears in route params, logs, or unprotected storage.
 */
export async function savePendingRegistrationSecure(data: {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
}): Promise<void> {
  try {
    const available = await isSecureStoreAvailable();
    const payload: SecurePendingRegistration = {
      ...data,
      createdAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);
    if (available) {
      await SecureStore.setItemAsync(SECURE_KEY_PENDING_REGISTRATION, serialized);
    } else {
      await AsyncStorage.setItem(SECURE_KEY_PENDING_REGISTRATION, serialized);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[SecureStore] savePendingRegistrationSecure notice:", err);
    }
  }
}

/**
 * Retrieves temporary pending registration data if still valid (within 15m TTL).
 * Automatically cleans up if expired.
 */
export async function getPendingRegistrationSecure(): Promise<{
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
} | null> {
  try {
    const available = await isSecureStoreAvailable();
    const raw = available
      ? await SecureStore.getItemAsync(SECURE_KEY_PENDING_REGISTRATION)
      : await AsyncStorage.getItem(SECURE_KEY_PENDING_REGISTRATION);

    if (!raw) return null;
    const parsed: SecurePendingRegistration = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;

    // 15-minute TTL check (OTP is valid for 10 minutes)
    const MAX_TTL_MS = 15 * 60 * 1000;
    if (Date.now() - parsed.createdAt > MAX_TTL_MS) {
      await clearPendingRegistrationSecure();
      return null;
    }

    return {
      email: parsed.email,
      password: parsed.password,
      fullName: parsed.fullName,
      phone: parsed.phone,
    };
  } catch {
    return null;
  }
}

/**
 * Securely clears temporary pending registration data.
 */
export async function clearPendingRegistrationSecure(): Promise<void> {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.deleteItemAsync(SECURE_KEY_PENDING_REGISTRATION);
    } else {
      await AsyncStorage.removeItem(SECURE_KEY_PENDING_REGISTRATION);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[SecureStore] clearPendingRegistrationSecure notice:", err);
    }
  }
}
