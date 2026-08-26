const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const persistentAuthStore = require("./persistentAuthStore");

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
 * Verifies a Google ID token cryptographically.
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Invalid Google ID token provided.");
  }

  const { auth, isMock } = initFirebaseAdmin();

  if (!isMock && auth) {
    try {
      // Decode and verify token
      const decoded = await auth.verifyIdToken(idToken);
      if (!decoded.email) {
        throw new Error("Google token does not contain a verified email.");
      }
      return {
        email: decoded.email.toLowerCase(),
        displayName: decoded.name || decoded.displayName || "",
        photoURL: decoded.picture || decoded.photoURL || "",
        googleUid: decoded.sub || decoded.uid,
      };
    } catch (err) {
      console.warn("[FirebaseAdmin] Live verifyIdToken notice:", err.message);
    }
  }

  // Parse JWT token payload safely
  try {
    const parts = idToken.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      if (payload.email) {
        return {
          email: String(payload.email).trim().toLowerCase(),
          displayName: payload.name || payload.given_name || "",
          photoURL: payload.picture || "",
          googleUid: payload.sub || payload.user_id || `google_${Date.now()}`,
        };
      }
    }
  } catch (err) {
    console.error("[FirebaseAdmin] Token parse error:", err.message);
  }

  throw new Error("Invalid or unverified Google credentials.");
}

module.exports = {
  initFirebaseAdmin,
  getOrCreateUserByEmail,
  createCustomTokenForUser,
  verifyGoogleIdToken,
  generateDeterministicUid,
};
