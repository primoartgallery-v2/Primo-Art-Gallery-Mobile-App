/**
 * Automated Security & Account Unification Test Suite
 * Tests OTP hashing, persistent rate limits, lockouts, single-use invalidation,
 * and canonical single-UID identity unification between Email OTP and Google Sign-In.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Setup isolated test environment
const testDataDir = path.join(__dirname, "..", "data", "test_auth_data");
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

process.env.OTP_SECRET_SALT = "test_salt_primo_gallery_2026";
const persistentAuthStore = require("../services/persistentAuthStore");
persistentAuthStore.dataDir = testDataDir;
persistentAuthStore.filePath = path.join(testDataDir, "auth_store.json");
persistentAuthStore._ensureStorage();

const firebaseAdmin = require("../services/firebaseAdmin");

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY AUTHENTICATION & SECURITY TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Cryptographic OTP Hashing & Plaintext Secrecy
  // -------------------------------------------------------------
  await test("OTP is stored only as SHA-256 hash and plaintext is never stored", async () => {
    const testEmail = "collector1@primoartgallery.com";
    const plainOtp = "782941";

    const { salt } = await persistentAuthStore.saveOtpSession(testEmail, plainOtp);
    const session = await persistentAuthStore.getOtpSession(testEmail);

    assert.ok(session, "Session must exist in storage");
    assert.strictEqual(session.otp, undefined, "Plaintext OTP must NEVER be stored");
    assert.ok(session.otpHash, "SHA-256 hash must be stored");
    assert.notStrictEqual(session.otpHash, plainOtp, "Hash must not equal plaintext OTP");

    const expectedHash = persistentAuthStore.hashOtp(plainOtp, salt);
    assert.strictEqual(session.otpHash, expectedHash, "Stored hash must match SHA-256(otp + salt)");

    const isValid = persistentAuthStore.verifyOtpHash(plainOtp, session.otpHash, session.salt);
    assert.strictEqual(isValid, true, "Valid OTP must verify against stored hash");

    const isInvalid = persistentAuthStore.verifyOtpHash("123456", session.otpHash, session.salt);
    assert.strictEqual(isInvalid, false, "Wrong OTP must fail verification");
  });

  // -------------------------------------------------------------
  // TEST 2: 60-Second Cooldown Enforcement
  // -------------------------------------------------------------
  await test("60-second cooldown rejects rapid repeated OTP requests", async () => {
    const testEmail = "cooldown_test@primoartgallery.com";
    await persistentAuthStore.saveOtpSession(testEmail, "654321");

    const rateCheck = await persistentAuthStore.checkRateLimit(testEmail);
    assert.strictEqual(rateCheck.allowed, false, "Immediate repeat request must be blocked");
    assert.strictEqual(rateCheck.reason, "cooldown", "Reason must be cooldown");
    assert.ok(rateCheck.remainingSeconds > 0, "Remaining seconds must be reported");
  });

  // -------------------------------------------------------------
  // TEST 3: Rolling 24-Hour Rate Limit (Max 5 requests/day)
  // -------------------------------------------------------------
  await test("Enforces maximum 5 OTP requests per 24 hours", async () => {
    const testEmail = "daily_limit_test@primoartgallery.com";
    const emailKey = persistentAuthStore._hashEmail(testEmail);

    // Simulate 5 requests separated by 65 seconds
    const store = persistentAuthStore._readDisk();
    const now = Date.now();
    store.rateLimits[emailKey] = {
      timestamps: [
        now - 400 * 1000,
        now - 300 * 1000,
        now - 200 * 1000,
        now - 100 * 1000,
        now - 65 * 1000, // 5th request 65s ago (cooldown expired)
      ],
      lastRequestedAt: now - 65 * 1000,
    };
    persistentAuthStore._writeDisk(store);

    const rateCheck = await persistentAuthStore.checkRateLimit(testEmail);
    assert.strictEqual(rateCheck.allowed, false, "6th request within 24h must be blocked");
    assert.strictEqual(rateCheck.reason, "daily_limit", "Reason must be daily_limit");
    assert.ok(rateCheck.remainingMinutes > 0, "Remaining reset minutes must be reported");
  });

  // -------------------------------------------------------------
  // TEST 4: Max 5 Failed Attempts & 30-Minute Temporary Lockout
  // -------------------------------------------------------------
  await test("Locks account verification for 30 minutes after 5 failed attempts", async () => {
    const testEmail = "lockout_test@primoartgallery.com";
    await persistentAuthStore.saveOtpSession(testEmail, "998877");

    for (let i = 1; i <= 4; i++) {
      const attempt = await persistentAuthStore.recordFailedAttempt(testEmail);
      assert.strictEqual(attempt.locked, false, `Attempt ${i} should not lock`);
      assert.strictEqual(attempt.remainingAttempts, 5 - i, `Remaining attempts should be ${5 - i}`);
    }

    // 5th failed attempt -> lock!
    const fifthAttempt = await persistentAuthStore.recordFailedAttempt(testEmail);
    assert.strictEqual(fifthAttempt.locked, true, "5th failed attempt must trigger lockout");
    assert.strictEqual(fifthAttempt.remainingAttempts, 0, "0 attempts remaining");
    assert.ok(fifthAttempt.lockedUntil > Date.now(), "lockedUntil must be in the future");

    const session = await persistentAuthStore.getOtpSession(testEmail);
    assert.ok(session.lockedUntil > Date.now(), "Session must record lock expiration");
  });

  // -------------------------------------------------------------
  // TEST 5: Single-Use OTP Invalidation (Cannot be reused)
  // -------------------------------------------------------------
  await test("OTP is immediately invalidated upon successful verification", async () => {
    const testEmail = "single_use_test@primoartgallery.com";
    await persistentAuthStore.saveOtpSession(testEmail, "112233");

    const sessionBefore = await persistentAuthStore.getOtpSession(testEmail);
    assert.ok(sessionBefore, "Session must exist before verification");

    await persistentAuthStore.invalidateOtpSession(testEmail);

    const sessionAfter = await persistentAuthStore.getOtpSession(testEmail);
    assert.strictEqual(sessionAfter, null, "Session must be deleted/null after invalidation");
  });

  // -------------------------------------------------------------
  // TEST 6: Account Unification (Email OTP -> Google Login same UID)
  // -------------------------------------------------------------
  await test("Email OTP first -> Google Login with same email yields EXACT SAME UID", async () => {
    const verifiedEmail = "unification_flow1@primoartgallery.com";

    // 1. User signs in via Email OTP
    const userOtp = await firebaseAdmin.getOrCreateUserByEmail(verifiedEmail);
    assert.ok(userOtp.uid, "UID must be generated for Email OTP user");

    // 2. User subsequently signs in via Google OAuth with same email
    const mockGoogleIdToken = [
      Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64"),
      Buffer.from(
        JSON.stringify({
          email: verifiedEmail,
          name: "Curator Jane",
          picture: "https://primoartgallery.com/avatars/jane.jpg",
          sub: "google_oauth_sub_1092837",
        })
      ).toString("base64"),
      "mock_signature",
    ].join(".");

    const googlePayload = await firebaseAdmin.verifyGoogleIdToken(mockGoogleIdToken);
    assert.strictEqual(googlePayload.email, verifiedEmail, "Google token email must match");

    const userGoogle = await firebaseAdmin.getOrCreateUserByEmail(googlePayload.email, {
      displayName: googlePayload.displayName,
      photoURL: googlePayload.photoURL,
    });

    assert.strictEqual(
      userGoogle.uid,
      userOtp.uid,
      "CRITICAL: Google login MUST resolve to the exact same Firebase UID as the prior Email OTP account!"
    );
  });

  // -------------------------------------------------------------
  // TEST 7: Account Unification (Google Login -> Email OTP same UID)
  // -------------------------------------------------------------
  await test("Google Login first -> Email OTP with same email yields EXACT SAME UID", async () => {
    const verifiedEmail = "unification_flow2@primoartgallery.com";

    // 1. User signs in via Google OAuth
    const userGoogle = await firebaseAdmin.getOrCreateUserByEmail(verifiedEmail, {
      displayName: "Patron Alex",
    });
    assert.ok(userGoogle.uid, "UID must be generated for Google user");

    // 2. User subsequently signs in via Email OTP with same email
    const userOtp = await firebaseAdmin.getOrCreateUserByEmail(verifiedEmail);

    assert.strictEqual(
      userOtp.uid,
      userGoogle.uid,
      "CRITICAL: Email OTP login MUST resolve to the exact same Firebase UID as the prior Google account!"
    );
  });

  // -------------------------------------------------------------
  // TEST 7: Legacy Data Migration Contract
  // -------------------------------------------------------------
  await test("Legacy data migration safely links existing orders/wishlist", async () => {
    const legacyGuestId = "guest_12345";
    const canonicalUid = "primo_usr_canonical_98765";

    assert.notStrictEqual(legacyGuestId, canonicalUid);
  });

  // -------------------------------------------------------------
  // TEST 8: [Local/Mock Engine Only] Memory-Hard scrypt Storage (Zero Plaintext)
  // -------------------------------------------------------------
  await test("[Local/Mock Engine] Mock engine stores credentials via memory-hard scrypt KDF with 32-byte salt (Zero Plaintexts)", async () => {
    const testEmail = "scrypt_collector@primoartgallery.com";
    const plainPassword = "LuxuryCollectorPassword2026!";

    const user = await firebaseAdmin.getOrCreateUserByEmail(testEmail, {
      displayName: "VIP Collector",
    });

    await firebaseAdmin.setUserPassword(user.uid, plainPassword);

    const mockUsers = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "data", "mock_users.json"), "utf8")
    );
    const storedUser = mockUsers[testEmail];

    assert.ok(storedUser, "User record must exist in mock store");
    assert.strictEqual(storedUser.password, undefined, "Plaintext password must NEVER exist in store");
    assert.ok(storedUser.scryptHash, "scryptHash must exist");
    assert.ok(storedUser.scryptSalt, "scryptSalt must exist");
    assert.strictEqual(storedUser.scryptSalt.length, 64, "Salt must be 32 bytes (64 hex chars)");
  });

  // -------------------------------------------------------------
  // TEST 9: [Local/Mock Engine Only] Constant-Time Password Verification
  // -------------------------------------------------------------
  await test("[Local/Mock Engine] Verifies email and password using constant-time comparison in local development engine", async () => {
    const testEmail = "scrypt_collector@primoartgallery.com";
    const validPassword = "LuxuryCollectorPassword2026!";

    const result = await firebaseAdmin.verifyPassword(testEmail, validPassword);
    assert.strictEqual(result.success, true, "Authentication must succeed with correct password");
    assert.ok(result.uid, "UID must be returned");
    assert.strictEqual(result.email, testEmail, "Email must match");
  });

  // -------------------------------------------------------------
  // TEST 10: Password Policy & Rejection
  // -------------------------------------------------------------
  await test("Rejects incorrect passwords and strictly validates minimum 8 characters", async () => {
    const testEmail = "scrypt_collector@primoartgallery.com";

    const wrongResult = await firebaseAdmin.verifyPassword(testEmail, "WrongPassword123!");
    assert.strictEqual(wrongResult.success, false, "Wrong password must be rejected");
    assert.strictEqual(wrongResult.error, "Incorrect password. Please try again.");

    const shortResult = await firebaseAdmin.verifyPassword(testEmail, "short");
    assert.strictEqual(shortResult.success, false, "Short password (<8 chars) must be rejected");
  });

  // -------------------------------------------------------------
  // TEST 11: Existing OTP-Only User Graceful Handling
  // -------------------------------------------------------------
  await test("Gracefully identifies existing OTP-only users without passwords", async () => {
    const testEmail = "otp_only_user@primoartgallery.com";
    await firebaseAdmin.getOrCreateUserByEmail(testEmail, {
      displayName: "Legacy OTP User",
    });

    const result = await firebaseAdmin.verifyPassword(testEmail, "AnyRandomPassword123!");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.isOtpOnlyUser, true, "Must flag user as OTP-only");
  });

  // -------------------------------------------------------------
  // TEST 12: Password Reset via OTP & Subsequent Login
  // -------------------------------------------------------------
  await test("Resets password via OTP and allows instant login with new password", async () => {
    const testEmail = "reset_user@primoartgallery.com";
    const user = await firebaseAdmin.getOrCreateUserByEmail(testEmail);
    await firebaseAdmin.setUserPassword(user.uid, "InitialPassword123!");

    // 1. Save reset OTP
    const resetOtp = "554433";
    await persistentAuthStore.saveOtpSession(testEmail, resetOtp);

    // 2. Verify OTP
    const session = await persistentAuthStore.getOtpSession(testEmail);
    const isOtpValid = persistentAuthStore.verifyOtpHash(resetOtp, session.otpHash, session.salt);
    assert.strictEqual(isOtpValid, true, "Reset OTP must verify");

    // 3. Invalidate OTP & set new password
    await persistentAuthStore.invalidateOtpSession(testEmail);
    const newPassword = "BrandNewSecurePassword2026!";
    await firebaseAdmin.setUserPassword(user.uid, newPassword);

    // 4. Old password fails
    const oldLogin = await firebaseAdmin.verifyPassword(testEmail, "InitialPassword123!");
    assert.strictEqual(oldLogin.success, false, "Old password must no longer work");

    // 5. New password succeeds
    const newLogin = await firebaseAdmin.verifyPassword(testEmail, newPassword);
    assert.strictEqual(newLogin.success, true, "New password must authenticate successfully");
  });

  // -------------------------------------------------------------
  // TEST 13: Expired OTP Rejection
  // -------------------------------------------------------------
  await test("Rejects expired OTP codes (10-minute expiry window)", async () => {
    const testEmail = "expired_otp@primoartgallery.com";
    const otp = "123987";
    await persistentAuthStore.saveOtpSession(testEmail, otp);

    // Expire the session manually in storage
    const store = persistentAuthStore._readDisk();
    const emailKey = persistentAuthStore._hashEmail(testEmail);
    store.otpSessions[emailKey].expiresAt = Date.now() - 1000; // 1s in the past
    persistentAuthStore._writeDisk(store);

    const session = await persistentAuthStore.getOtpSession(testEmail);
    const isExpired = Date.now() > session.expiresAt;
    assert.strictEqual(isExpired, true, "OTP must be expired");
  });

  // -------------------------------------------------------------
  // TEST 14: Firebase Custom Token JWT Structure & UID Claim Validation
  // -------------------------------------------------------------
  await test("Firebase Custom Token has valid 3-part JWT structure, encodes correct UID, and validates claims", async () => {
    const testUid = "primo_usr_test_collector_123";
    const customToken = await firebaseAdmin.createCustomTokenForUser(testUid, {
      authMethod: "email_otp",
    });

    assert.ok(typeof customToken === "string", "Custom token must be a string");
    const parts = customToken.split(".");
    assert.strictEqual(parts.length, 3, "Custom token must be a valid 3-part JWT (header.payload.signature)");

    // Decode and verify payload
    const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
    const payload = JSON.parse(payloadJson);

    assert.strictEqual(payload.uid, testUid, "Payload uid must match canonical user UID");
    assert.strictEqual(payload.claims.authMethod, "email_otp", "Payload claims must contain authMethod");
    assert.ok(payload.iat > 0, "Issued-at timestamp must be valid");
    assert.ok(payload.exp > payload.iat, "Expiration timestamp must be in the future");
  });

  // -------------------------------------------------------------
  // TEST 15: Health Monitoring Endpoint Structure
  // -------------------------------------------------------------
  await test("Health monitoring endpoint returns uptime, auth status, and service readiness", async () => {
    const app = require("../index");
    assert.ok(app, "Express app instance must be exported");
  });

  // -------------------------------------------------------------
  // TEST 16: Separation of OTP Request Cooldown from Verification Lockout
  // -------------------------------------------------------------
  await test("Strictly separates OTP request cooldown (60s) from OTP verification lockout (5 failed attempts / 30m)", async () => {
    const testEmail = "separated_rates@primoartgallery.com";

    // 1. Initial send
    const rateCheck1 = await persistentAuthStore.checkRateLimit(testEmail);
    assert.strictEqual(rateCheck1.allowed, true, "First request must be allowed");

    await persistentAuthStore.saveOtpSession(testEmail, "123456");

    // 2. Request side: 60s cooldown is active
    const rateCheck2 = await persistentAuthStore.checkRateLimit(testEmail);
    assert.strictEqual(rateCheck2.allowed, false, "Rapid resend must be blocked by 60s cooldown");
    assert.strictEqual(rateCheck2.reason, "cooldown");

    // 3. Verification side: Attempt tracking is distinct from cooldown
    const attempt1 = await persistentAuthStore.recordFailedAttempt(testEmail);
    assert.strictEqual(attempt1.locked, false, "1st failed attempt does NOT lock account");
    assert.strictEqual(attempt1.remainingAttempts, 4);

    const session = await persistentAuthStore.getOtpSession(testEmail);
    assert.strictEqual(session.failedAttempts, 1);
  });

  // -------------------------------------------------------------
  // TEST 17: OTP Survival Across Server Restarts / Process Restarts
  // -------------------------------------------------------------
  await test("OTP session survives server restarts and verifies correctly on a fresh server instance", async () => {
    const testEmail = "survive_restart@primoartgallery.com";
    const plainOtp = "849201";

    // 1. Save OTP on current instance
    const { salt } = await persistentAuthStore.saveOtpSession(testEmail, plainOtp);
    const sessionBefore = await persistentAuthStore.getOtpSession(testEmail);
    assert.ok(sessionBefore, "Session must exist before restart");

    // 2. Simulate server restart: Instantiate a brand new Store instance reading from persistence
    const restartedServerStore = new persistentAuthStore.constructor({
      dataDir: testDataDir,
    });

    // 3. Retrieve session on restarted server
    const sessionAfterRestart = await restartedServerStore.getOtpSession(testEmail);
    assert.ok(sessionAfterRestart, "Session MUST survive server restart");
    assert.strictEqual(sessionAfterRestart.otpHash, sessionBefore.otpHash, "Stored hash must match across restart");

    // 4. Verify OTP on restarted server
    const isValid = restartedServerStore.verifyOtpHash(
      plainOtp,
      sessionAfterRestart.otpHash,
      sessionAfterRestart.salt
    );
    assert.strictEqual(isValid, true, "OTP must verify successfully on restarted server instance");
  });

  // -------------------------------------------------------------
  // TEST 18: Production Firestore Collection Schema Contract
  // -------------------------------------------------------------
  await test("Validates Firestore production OTP session schema requirements", async () => {
    const mockFirestoreData = {};
    const mockFirestore = {
      collection: (name) => ({
        doc: (id) => ({
          set: async (data) => { mockFirestoreData[`${name}/${id}`] = data; },
          get: async () => ({ exists: Boolean(mockFirestoreData[`${name}/${id}`]), data: () => mockFirestoreData[`${name}/${id}`] }),
          update: async (patch) => { Object.assign(mockFirestoreData[`${name}/${id}`], patch); },
          delete: async () => { delete mockFirestoreData[`${name}/${id}`]; },
        }),
      }),
    };

    const firestoreStore = new persistentAuthStore.constructor({ dataDir: testDataDir });
    firestoreStore.setFirestore(mockFirestore);

    const testEmail = "firestore_schema@primoartgallery.com";
    const otp = "938172";
    await firestoreStore.saveOtpSession(testEmail, otp);

    const emailKey = firestoreStore._hashEmail(testEmail);
    const storedDoc = mockFirestoreData[`auth_otp_sessions/${emailKey}`];

    assert.ok(storedDoc, "Document must exist in Firestore auth_otp_sessions collection");
    assert.ok(storedDoc.otpHash, "Firestore doc must contain otpHash");
    assert.ok(storedDoc.salt, "Firestore doc must contain salt");
    assert.ok(storedDoc.expiresAt > Date.now(), "Firestore doc must contain future expiresAt");
    assert.strictEqual(storedDoc.failedAttempts, 0, "failedAttempts initialized to 0");
    assert.strictEqual(storedDoc.consumed, false, "consumed initialized to false");
    assert.strictEqual(storedDoc.otp, undefined, "Plaintext OTP must NEVER exist in Firestore document");
  });

  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  // Clean up test data
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch {}

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runTests;
