const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const persistentAuthStore = require("./persistentAuthStore");
const collectorStore = require("./collectorStore");

let adminApp = null;
let authInstance = null;
let firestoreInstance = null;

function initFirebaseAdmin() {
  if (adminApp) {
    return { auth: authInstance, firestore: firestoreInstance, isMock: false };
  }

  try {
    const admin = require("firebase-admin");
    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    }

    if (adminApp) {
      authInstance = admin.auth(adminApp);
      try {
        firestoreInstance = admin.firestore(adminApp);
        persistentAuthStore.setFirestore(firestoreInstance);
        collectorStore.setFirestore(firestoreInstance);
      } catch {
        // Optional Firestore
      }
      console.log("[FirebaseAdmin] Successfully initialized live Firebase Admin SDK.");
      return { auth: authInstance, firestore: firestoreInstance, isMock: false };
    }
  } catch (err) {
    console.warn("[FirebaseAdmin] Live Firebase Admin initialization notice:", err.message);
  }

  console.log("[FirebaseAdmin] Using deterministic Identity Authority engine.");
  return { auth: null, firestore: null, isMock: true };
}

// In-memory / persistent mock user directory for deterministic local development and testing
const mockUserStorePath = path.join(__dirname, "..", "data", "mock_users.json");

function readMockUsers() {
  try {
    if (!fs.existsSync(path.dirname(mockUserStorePath))) {
      fs.mkdirSync(path.dirname(mockUserStorePath), { recursive: true });
    }
    if (!fs.existsSync(mockUserStorePath)) {
      fs.writeFileSync(mockUserStorePath, JSON.stringify({}), "utf8");
    }
    return JSON.parse(fs.readFileSync(mockUserStorePath, "utf8"));
  } catch {
    return {};
  }
}

function writeMockUsers(users) {
  try {
    fs.writeFileSync(mockUserStorePath, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("[FirebaseAdmin] Mock user write notice:", err.message);
  }
}

function generateDeterministicUid(email) {
  const clean = String(email).trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(`primo_uid_${clean}`).digest("hex");
  return `primo_usr_${hash.substring(0, 20)}`;
}

function isValidHttpUrl(string) {
  if (!string || typeof string !== "string" || string.trim() === "") return false;
  try {
    const parsed = new URL(string.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Gets or creates a canonical Firebase user by verified email.
 */
async function getOrCreateUserByEmail(email, extraData = {}) {
  const { auth, isMock } = initFirebaseAdmin();
  const cleanEmail = String(email).trim().toLowerCase();

  if (!isMock && auth) {
    console.log(`[FirebaseAdmin] getOrCreateUserByEmail START (project: ${process.env.FIREBASE_PROJECT_ID || "unknown"})`);
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      console.log(`[FirebaseAdmin] getUserByEmail SUCCESS (uid: ${existingUser.uid})`);
      if (!existingUser.emailVerified) {
        await auth.updateUser(existingUser.uid, { emailVerified: true });
      }
      return {
        uid: existingUser.uid,
        email: existingUser.email,
        displayName: existingUser.displayName || extraData.displayName || cleanEmail.split("@")[0],
        photoURL: existingUser.photoURL || (isValidHttpUrl(extraData.photoURL) ? extraData.photoURL.trim() : null),
        emailVerified: true,
        createdAt: existingUser.metadata?.creationTime || new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`[FirebaseAdmin] getUserByEmail ERROR: name=${err.name}, code=${err.code}, message=${err.message}`);
      if (err.code === "auth/user-not-found") {
        console.log(`[FirebaseAdmin] createUser START`);
        try {
          const createUserData = {
            email: cleanEmail,
            emailVerified: true,
          };

          const displayName = String(extraData.displayName || cleanEmail.split("@")[0] || "").trim();
          if (displayName) {
            createUserData.displayName = displayName;
          }

          if (isValidHttpUrl(extraData.photoURL)) {
            createUserData.photoURL = extraData.photoURL.trim();
          }

          const newUser = await auth.createUser(createUserData);
          console.log(`[FirebaseAdmin] createUser SUCCESS (uid: ${newUser.uid})`);
          return {
            uid: newUser.uid,
            email: newUser.email,
            displayName: newUser.displayName || displayName,
            photoURL: newUser.photoURL || (isValidHttpUrl(extraData.photoURL) ? extraData.photoURL.trim() : null),
            emailVerified: true,
            createdAt: newUser.metadata?.creationTime || new Date().toISOString(),
          };
        } catch (createErr) {
          console.error(`[FirebaseAdmin] createUser ERROR: name=${createErr.name}, code=${createErr.code}, message=${createErr.message}`);
          throw createErr;
        }
      }
      throw err;
    }
  }

  // Deterministic local Identity Engine
  const users = readMockUsers();
  if (users[cleanEmail]) {
    const existing = users[cleanEmail];
    existing.emailVerified = true;
    if (extraData.displayName && !existing.displayName) existing.displayName = extraData.displayName;
    if (extraData.photoURL && !existing.photoURL) existing.photoURL = extraData.photoURL;
    writeMockUsers(users);
    return existing;
  }

  const uid = generateDeterministicUid(cleanEmail);
  const newUser = {
    uid,
    email: cleanEmail,
    displayName: extraData.displayName || cleanEmail.split("@")[0],
    photoURL: extraData.photoURL || null,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  users[cleanEmail] = newUser;
  writeMockUsers(users);
  return newUser;
}

/**
 * Creates a Firebase Custom Token for a canonical UID using official Firebase Admin SDK.
 */
async function createCustomTokenForUser(uid, claims = {}) {
  const { auth, isMock } = initFirebaseAdmin();

  if (!isMock && auth) {
    return await auth.createCustomToken(uid, claims);
  }

  throw new Error("Firebase Admin SDK uninitialized: cannot create custom token.");
}

/**
 * Verifies a Google ID token cryptographically using Firebase Admin SDK.
 * Fails closed immediately on verification failure without unverified payload decoding.
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Invalid Google ID token provided.");
  }

  const { auth, isMock } = initFirebaseAdmin();

  if (!isMock && auth) {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded || !decoded.email) {
      throw new Error("Google token does not contain a verified email.");
    }
    return {
      email: decoded.email.toLowerCase(),
      displayName: decoded.name || decoded.displayName || "",
      photoURL: decoded.picture || decoded.photoURL || "",
      googleUid: decoded.sub || decoded.uid,
    };
  }

  throw new Error("Google authentication is unavailable: Firebase Admin SDK uninitialized.");
}

/**
 * Sets or updates a user's password securely in Firebase Authentication.
 * In local/mock development mode, uses memory-hard scrypt KDF for offline development.
 */
async function setUserPassword(uid, password) {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const { auth, isMock } = initFirebaseAdmin();

  // PRODUCTION PATH: Firebase Authentication is the ONLY canonical password store
  if (!isMock && auth) {
    try {
      await auth.updateUser(uid, { password });
      return { success: true };
    } catch (err) {
      console.error("[FirebaseAdmin] Live updateUser password error:", err.message);
      throw err;
    }
  }

  // LOCAL / MOCK DEVELOPMENT FALLBACK ONLY (Never executed in production)
  const users = readMockUsers();
  let userEmail = null;

  for (const [email, user] of Object.entries(users)) {
    if (user.uid === uid) {
      userEmail = email;
      break;
    }
  }

  if (userEmail && users[userEmail]) {
    const salt = crypto.randomBytes(32).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    users[userEmail].scryptHash = derivedKey.toString("hex");
    users[userEmail].scryptSalt = salt;
    users[userEmail].passwordUpdatedAt = new Date().toISOString();
    writeMockUsers(users);
    return { success: true };
  }

  return { success: true };
}

/**
 * Verifies email and password using official Firebase Identity Toolkit REST API.
 * In local/mock development mode, uses memory-hard scrypt fallback for offline testing.
 */
async function verifyPassword(email, password) {
  if (!email || !password || typeof password !== "string" || password.length < 8) {
    return { success: false, error: "Email and password (minimum 8 characters) are required." };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const { isMock } = initFirebaseAdmin();
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY;

  // PRODUCTION PATH: Firebase Authentication / Google Cloud Identity Toolkit
  if (!isMock || firebaseApiKey) {
    if (!firebaseApiKey) {
      console.error("[FirebaseAdmin] FIREBASE_WEB_API_KEY missing in live production environment.");
      return { success: false, error: "Authentication service temporarily unavailable." };
    }

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();
      if (response.ok && data.localId) {
        return {
          success: true,
          uid: data.localId,
          email: data.email || cleanEmail,
          displayName: data.displayName || "",
          photoURL: data.profilePicture || "",
        };
      }

      const errorCode = data.error?.message;
      if (errorCode === "EMAIL_NOT_FOUND") {
        return { success: false, error: "No account found with this email. Please sign up." };
      }
      if (errorCode === "INVALID_PASSWORD" || errorCode === "INVALID_LOGIN_CREDENTIALS") {
        return { success: false, error: "Incorrect password. Please try again." };
      }
      if (errorCode === "USER_DISABLED") {
        return { success: false, error: "This account has been disabled." };
      }

      return { success: false, error: data.error?.message || "Invalid email or password." };
    } catch (err) {
      console.error("[FirebaseAdmin] Live Firebase Identity Toolkit fetch error:", err.message);
      return { success: false, error: "Unable to verify credentials with authentication server." };
    }
  }

  // LOCAL / MOCK DEVELOPMENT FALLBACK ONLY (Offline development when Firebase is unconfigured)
  const users = readMockUsers();
  const user = users[cleanEmail];

  if (!user) {
    return { success: false, error: "No account found with this email. Please sign up." };
  }

  if (!user.scryptHash || !user.scryptSalt) {
    return {
      success: false,
      error: "This account was created with OTP and has no password yet. Please sign in with OTP or reset password.",
      isOtpOnlyUser: true,
    };
  }

  try {
    const derivedKey = crypto.scryptSync(password, user.scryptSalt, 64, { N: 16384, r: 8, p: 1 });
    const match = crypto.timingSafeEqual(
      Buffer.from(derivedKey.toString("hex"), "hex"),
      Buffer.from(user.scryptHash, "hex")
    );

    if (!match) {
      return { success: false, error: "Incorrect password. Please try again." };
    }

    return {
      success: true,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
    };
  } catch (err) {
    console.error("[FirebaseAdmin] Mock scrypt verification error:", err.message);
    return { success: false, error: "Authentication verification failed." };
  }
}

/**
 * Retrieves the raw Service Account private key PEM string if available.
 * Never logs or exposes the key.
 */
function getServiceAccountPrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
      if (serviceAccount && serviceAccount.private_key) {
        return serviceAccount.private_key.replace(/\\n/g, "\n");
      }
    } catch {}
  }
  return null;
}

/**
 * Retrieves the Service Account client email if available.
 */
function getServiceAccountClientEmail() {
  if (process.env.FIREBASE_CLIENT_EMAIL) {
    return process.env.FIREBASE_CLIENT_EMAIL.trim();
  }
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
      if (serviceAccount && serviceAccount.client_email) {
        return serviceAccount.client_email.trim();
      }
    } catch {}
  }
  return null;
}

/**
 * Verifies an incoming Bearer auth token from the mobile client.
 * Strictly verifies genuine Firebase ID tokens using the official Firebase Admin SDK verifyIdToken().
 * Rejects Firebase Custom Tokens, fabricated HS256 tokens, and expired/tampered tokens.
 */
async function verifyAuthToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) return null;

  const { auth, isMock } = initFirebaseAdmin();

  // If live Firebase Admin is not active, fail closed immediately
  if (isMock || !auth) {
    return null;
  }

  try {
    const decoded = await auth.verifyIdToken(cleanToken, true);
    if (decoded && (decoded.uid || decoded.sub)) {
      return {
        uid: decoded.uid || decoded.sub,
        email: decoded.email || "",
        claims: decoded,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Exchanges a Firebase Custom Token for authoritative Firebase ID and Refresh Tokens
 * via Google Identity Toolkit REST API.
 * Fails closed with 503 if Google service is unreachable, or 401 on invalid token.
 * Never mints fake/mock tokens.
 */
async function exchangeCustomTokenForSession(customToken) {
  if (!customToken || typeof customToken !== "string" || customToken.trim() === "") {
    return { success: false, status: 400, code: "INVALID_ARGUMENT", error: "A valid custom token is required." };
  }

  const cleanToken = customToken.trim();
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

  if (!firebaseApiKey) {
    return {
      success: false,
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      error: "Authentication service is currently unavailable. Please try again later.",
    };
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanToken,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();
    if (response.ok && data.idToken) {
      return {
        success: true,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: parseInt(data.expiresIn || "3600", 10),
        uid: data.localId,
      };
    }

    return {
      success: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Invalid or expired custom token.",
    };
  } catch (err) {
    return {
      success: false,
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      error: "Authentication service is currently unavailable. Please try again later.",
    };
  }
}

/**
 * Refreshes an expired Firebase ID Token using the Refresh Token via Google Secure Token API.
 * Fails closed with 503 if Google service is unreachable, or 401 on invalid token.
 * Never accepts or mints fake/mock refresh tokens.
 */
async function refreshFirebaseIdToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim() === "") {
    return { success: false, status: 400, code: "INVALID_ARGUMENT", error: "A valid refresh token is required." };
  }

  const cleanRefreshToken = refreshToken.trim();
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

  if (!firebaseApiKey) {
    return {
      success: false,
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      error: "Authentication service is currently unavailable. Please try again later.",
    };
  }

  try {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(cleanRefreshToken)}`,
      }
    );

    const data = await response.json();
    if (response.ok && data.id_token) {
      return {
        success: true,
        idToken: data.id_token,
        refreshToken: data.refresh_token || cleanRefreshToken,
        expiresIn: parseInt(data.expires_in || "3600", 10),
        uid: data.user_id,
      };
    }

    return {
      success: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Invalid or expired session refresh token.",
    };
  } catch (err) {
    return {
      success: false,
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      error: "Authentication service is currently unavailable. Please try again later.",
    };
  }
}

module.exports = {
  initFirebaseAdmin,
  getOrCreateUserByEmail,
  createCustomTokenForUser,
  exchangeCustomTokenForSession,
  refreshFirebaseIdToken,
  verifyGoogleIdToken,
  generateDeterministicUid,
  setUserPassword,
  verifyPassword,
  verifyAuthToken,
};

