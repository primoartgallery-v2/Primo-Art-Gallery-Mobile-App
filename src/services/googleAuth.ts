import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  type: "success" | "cancel" | "error" | "unconfigured";
  idToken?: string;
  errorMessage?: string;
}

/**
 * Initiates the Google OAuth 2.0 flow to obtain an authoritative ID token.
 */
export async function promptGoogleAuth(): Promise<GoogleAuthResult> {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  if (
    !clientId ||
    clientId.trim().length === 0 ||
    clientId.includes("your_google_client_id")
  ) {
    return {
      type: "unconfigured",
      errorMessage:
        "Google Sign-In requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to be configured. Please sign in via instant Email OTP or Password in the meantime.",
    };
  }

  try {
    const redirectUri = Linking.createURL("google-auth");
    const nonce =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=id_token&` +
      `scope=${encodeURIComponent("openid email profile")}&` +
      `nonce=${encodeURIComponent(nonce)}&` +
      `prompt=select_account`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === "success" && result.url) {
      let idToken: string | null = null;

      // Extract from hash fragment (#id_token=...)
      if (result.url.includes("#")) {
        const hash = result.url.split("#")[1];
        const hashParams = new URLSearchParams(hash);
        idToken = hashParams.get("id_token");
      }

      // Fallback to query parameters (?id_token=...)
      if (!idToken) {
        const parsed = Linking.parse(result.url);
        if (parsed.queryParams?.id_token) {
          idToken = String(parsed.queryParams.id_token);
        }
      }

      if (idToken) {
        return { type: "success", idToken };
      }

      return {
        type: "error",
        errorMessage: "Google did not return a valid identity token.",
      };
    }

    if (result.type === "cancel" || result.type === "dismiss") {
      return { type: "cancel" };
    }

    return {
      type: "error",
      errorMessage: "Google sign-in was dismissed or could not be completed.",
    };
  } catch (err: any) {
    return {
      type: "error",
      errorMessage:
        err.message || "An unexpected error occurred during Google sign-in.",
    };
  }
}
