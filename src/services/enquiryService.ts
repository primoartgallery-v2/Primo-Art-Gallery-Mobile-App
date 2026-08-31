import { getAuthToken } from "./collectorStorage";

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

import { API_BASE_URL } from "@/constants/apiConfig";

/**
 * Submits an artwork acquisition enquiry to the Render backend proxy.
 * Includes Bearer token if collector is authenticated.
 */
export async function submitArtworkEnquiry(
  payload: ArtworkEnquiryPayload
): Promise<ArtworkEnquiryResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/enquiries`, {
      method: "POST",
      headers,
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

    return {
      success: true,
      enquiryId: data.enquiryId,
      message: data.message,
    };
  } catch {
    return {
      success: false,
      error: "Unable to connect to gallery service. Please check your internet connection.",
    };
  }
}
