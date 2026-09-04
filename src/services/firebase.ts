// Default public Firebase Client configuration
export const FIREBASE_CLIENT_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "primo-art-gallery.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "primo-art-gallery",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "primo-art-gallery.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1029384756:web:primoartgallery2026",
};

/**
 * Initializes and returns the Firebase Auth client instance.
 * Standalone proxy mode handles auth server-side with custom tokens.
 */
export function getFirebaseAuth(): any {
  return null;
}

export function getFirebaseAuthModule(): any {
  return null;
}

export function isFirebaseConfigured(): boolean {
  return (
    Boolean(FIREBASE_CLIENT_CONFIG.apiKey) &&
    !FIREBASE_CLIENT_CONFIG.apiKey.includes("DEMO_KEY")
  );
}
