import { API_BASE_URL } from "@/constants/apiConfig";
import {
  clearSessionCredentials,
  getIdToken,
  getRefreshToken,
  getTokenExpiry,
  saveSessionCredentials,
} from "./secureStore";

type SessionExpiredListener = (reason?: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Registers a listener invoked when the user session has irrevocably expired.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/**
 * Dispatches session expired event to registered listeners and wipes SecureStore credentials.
 */
export async function dispatchSessionExpired(reason: string = "Your session has expired. Please sign in again."): Promise<void> {
  await clearSessionCredentials();
  for (const listener of sessionExpiredListeners) {
    try {
      listener(reason);
    } catch (err) {
      if (__DEV__) {
        console.warn("[SessionManager] SessionExpiredListener notice:", err);
      }
    }
  }
}

/**
 * Exchanges a Firebase Custom Token for authoritative Firebase ID and Refresh tokens via backend proxy.
 */
export async function exchangeCustomTokenForSession(customToken: string): Promise<{
  success: boolean;
  idToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  if (!customToken || typeof customToken !== "string" || customToken.trim() === "") {
    return { success: false, error: "Custom token is required for session exchange." };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/session-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ customToken: customToken.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success || !data.idToken) {
      return {
        success: false,
        error: data.error || `Session token exchange failed (HTTP ${res.status}).`,
      };
    }

    await saveSessionCredentials({
      idToken: data.idToken,
      refreshToken: data.refreshToken || null,
      expiresInSeconds: data.expiresIn || 3600,
    });

    return {
      success: true,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network error during session token exchange.",
    };
  }
}

/**
 * Refreshes an expired Firebase ID token using the securely stored Refresh Token.
 */
export async function refreshSessionToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken || refreshToken.trim() === "") {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refreshToken: refreshToken.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success || !data.idToken) {
      if (res.status === 400 || res.status === 401) {
        // Refresh token is revoked, invalid, or expired
        await dispatchSessionExpired("Your session has expired. Please sign in again.");
      }
      return null;
    }

    await saveSessionCredentials({
      idToken: data.idToken,
      refreshToken: data.refreshToken || refreshToken,
      expiresInSeconds: data.expiresIn || 3600,
    });

    return data.idToken;
  } catch (err) {
    if (__DEV__) {
      console.warn("[SessionManager] Token refresh network notice:", err);
    }
    return null;
  }
}

/**
 * Returns a valid, non-expired Firebase ID Token, performing proactive refresh if within 5 min of expiry.
 */
export async function getValidAuthToken(): Promise<string | null> {
  const currentToken = await getIdToken();
  if (!currentToken) return null;

  const expiry = await getTokenExpiry();
  const now = Date.now();

  // If token is expiring within 5 minutes (300,000 ms) or already expired, attempt refresh
  if (expiry && now + 300000 >= expiry) {
    const refreshed = await refreshSessionToken();
    if (refreshed) {
      return refreshed;
    }
    // If refresh failed but token not yet expired, return current token until hard expiry
    if (now < expiry) {
      return currentToken;
    }
    return null;
  }

  return currentToken;
}

/**
 * Executes an authenticated HTTP request with automatic token injection and single 401 retry recovery.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<Response> {
  const token = await getValidAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized with single retry after refreshing session token
  if (response.status === 401 && !isRetry) {
    const existingRefreshToken = await getRefreshToken();

    // Trigger session expired ONLY when:
    // 1. A previously valid authenticated session actually existed, AND
    // 2. An ID token was being used (token is non-null), AND
    // 3. A valid refresh token was previously available, AND
    // 4. The refresh attempt fails
    if (token && existingRefreshToken && existingRefreshToken.trim().length > 0) {
      const newToken = await refreshSessionToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        return await fetch(url, { ...options, headers });
      } else {
        // Genuine irrevocable session expiration for a previously authenticated user
        void dispatchSessionExpired();
      }
    }
  }

  return response;
}
