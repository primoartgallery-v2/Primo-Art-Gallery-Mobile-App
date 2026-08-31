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

/**
 * Gets or creates a canonical Firebase user by verified email.
 */
async function getOrCreateUserByEmail(email, extraData = {}) {
  const { auth, isMock } = initFirebaseAdmin();
  const cleanEmail = String(email).trim().toLowerCase();

  if (!isMock && auth) {
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      if (!existingUser.emailVerified) {
        await auth.updateUser(existingUser.uid, { emailVerified: true });
      }
      return {
        uid: existingUser.uid,
        email: existingUser.email,
        displayName: existingUser.displayName || extraData.displayName || cleanEmail.split("@")[0],
        photoURL: existingUser.photoURL || extraData.photoURL || null,
        emailVerified: true,
        createdAt: existingUser.metadata?.creationTime || new Date().toISOString(),
      };
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        const newUser = await auth.createUser({
          email: cleanEmail,
          emailVerified: true,
          displayName: extraData.displayName || cleanEmail.split("@")[0],
          photoURL: extraData.photoURL || null,
        });
        return {
          uid: newUser.uid,
          email: newUser.email,
          displayName: newUser.displayName,
          photoURL: newUser.photoURL,
          emailVerified: true,
          createdAt: newUser.metadata?.creationTime || new Date().toISOString(),
        };
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
 * Creates a Firebase Custom Token for a canonical UID.
 */
async function createCustomTokenForUser(uid, claims = {}) {
  const { auth, isMock } = initFirebaseAdmin();

  if (!isMock && auth) {
    return auth.createCustomToken(uid, claims);
  }

  // Deterministic custom token structure for offline/development
  const payload = {
    uid,
    claims: { ...claims, authMethod: claims.authMethod || "primo_secure_otp" },
    iss: "primo-gallery-auth-authority",
    sub: uid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
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

  // PRODUCTION / LIVE FIREBASE PATH: Cryptographic verification is strictly required
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

  // Fail closed in production if Firebase Admin is not initialized
  if (process.env.NODE_ENV === "production") {
    throw new Error("Google authentication is unavailable in production: Firebase Admin SDK uninitialized.");
  }

  // ISOLATED LOCAL DEVELOPMENT / TEST MOCK ONLY (NODE_ENV !== 'production' && isMock === true)
  // Used exclusively for offline unit testing when Firebase credentials are not mounted.
  try {
    const parts = idToken.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      if (payload && payload.email) {
        return {
          email: String(payload.email).trim().toLowerCase(),
          displayName: payload.name || payload.given_name || "",
          photoURL: payload.picture || "",
          googleUid: payload.sub || payload.user_id || `google_${Date.now()}`,
        };
      }
    }
  } catch (err) {
    console.error("[FirebaseAdmin] Mock token parse error:", err.message);
  }

  throw new Error("Invalid or unverified Google credentials.");
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
 * Verifies an incoming Bearer auth token from the mobile client.
 * Derives canonical authenticated UID without trusting client parameters.
 */
async function verifyAuthToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) return null;

  const { auth, isMock } = initFirebaseAdmin();

  // Try live Firebase verifyIdToken if active
  if (!isMock && auth) {
    try {
      const decoded = await auth.verifyIdToken(cleanToken);
      if (decoded && (decoded.uid || decoded.sub)) {
        return {
          uid: decoded.uid || decoded.sub,
          email: decoded.email || "",
          claims: decoded,
        };
      }
    } catch {
      // If not standard ID token, try JWT custom token fallback below
    }
  }

  // Verify HMAC / deterministic JWT for local/custom token
  try {
    const parts = cleanToken.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    if (!headerB64 || !payloadB64 || !signature) return null;

    const expectedSig = crypto
      .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        return null; // Expired
      }
      if (!payload || (!payload.uid && !payload.sub)) {
        return null;
      }
      return {
        uid: payload.uid || payload.sub,
        email: payload.email || "",
        claims: payload.claims || {},
      };
    }

    return null;
  } catch {
    return null;
  }

  return null;
}

module.exports = {
  initFirebaseAdmin,
  getOrCreateUserByEmail,
  createCustomTokenForUser,
  verifyGoogleIdToken,
  generateDeterministicUid,
  setUserPassword,
  verifyPassword,
  verifyAuthToken,
};

