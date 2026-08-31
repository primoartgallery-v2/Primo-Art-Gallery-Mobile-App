/**
 * Centralized API Configuration for Primo Art Gallery Mobile Application.
 *
 * Ensures all client services resolve the backend proxy through one authoritative source
 * with a guaranteed production Render fallback (zero local LAN IP fallbacks in production).
 */

export const DEFAULT_PRODUCTION_API_URL = "https://primo-art-gallery-mobile-app.onrender.com";

/**
 * Normalizes and validates the API base URL.
 * - Strips trailing `/api` or `/` so services can consistently format endpoints as `${API_BASE_URL}/api/...`.
 * - Validates protocol (must start with http:// or https://).
 * - Defaults securely to the production Render proxy if env is missing or malformed.
 */
export function resolveApiBaseUrl(envUrl?: string): string {
  const candidate = (envUrl ?? process.env.EXPO_PUBLIC_API_URL)?.trim();

  if (candidate && /^https?:\/\//i.test(candidate)) {
    return candidate.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  }

  return DEFAULT_PRODUCTION_API_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl();

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  defaultProductionUrl: DEFAULT_PRODUCTION_API_URL,
} as const;
