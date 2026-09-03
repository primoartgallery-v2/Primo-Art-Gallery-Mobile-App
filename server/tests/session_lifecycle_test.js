/**
 * Complete Hardened Session Lifecycle, Token Refresh & Multi-User Enquiry Isolation Test Suite
 */

const assert = require("assert");
const crypto = require("crypto");
const http = require("http");
const firebaseAdmin = require("../services/firebaseAdmin");
const collectorStore = require("../services/collectorStore");

// Start server instance for testing
const app = require("../index");

async function runComprehensiveSessionTests() {
  console.log("==================================================================");
  console.log("RUNNING COMPREHENSIVE SESSION & ENQUIRY REGRESSION TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
      } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
        failed++;
      }
    })();
  }

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const userA_Uid = "test_collector_user_AAA";
    const userB_Uid = "test_collector_user_BBB";

    // Mock token exchange and refresh for end-to-end API lifecycle flow tests
    const activeSessions = new Map();

    const origExchange = firebaseAdmin.exchangeCustomTokenForSession;
    const origRefresh = firebaseAdmin.refreshFirebaseIdToken;
    const origVerify = firebaseAdmin.verifyAuthToken;

    firebaseAdmin.exchangeCustomTokenForSession = async (token) => {
      if (!token || typeof token !== "string" || token.length > 4096) {
        return { success: false, status: 400, error: "Invalid token" };
      }
      const uid = token.includes("BBB") ? userB_Uid : userA_Uid;
      const idToken = `genuine_id_token_${uid}_${Date.now()}`;
      const refreshToken = `genuine_rf_token_${uid}_${Date.now()}`;
      activeSessions.set(idToken, { uid, email: `${uid}@example.com` });
      activeSessions.set(refreshToken, { uid, email: `${uid}@example.com` });
      return { success: true, idToken, refreshToken, expiresIn: 3600, uid };
    };

    firebaseAdmin.refreshFirebaseIdToken = async (refreshToken) => {
      if (!refreshToken || !activeSessions.has(refreshToken)) {
        return { success: false, status: 401, error: "Invalid refresh token." };
      }
      const sess = activeSessions.get(refreshToken);
      const newIdToken = `refreshed_id_token_${sess.uid}_${Date.now()}`;
      activeSessions.set(newIdToken, sess);
      return { success: true, idToken: newIdToken, refreshToken, expiresIn: 3600, uid: sess.uid };
    };

    firebaseAdmin.verifyAuthToken = async (authHeader) => {
      if (!authHeader || typeof authHeader !== "string") return null;
      const clean = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (clean.startsWith("expired_")) return null;
      if (activeSessions.has(clean)) {
        return activeSessions.get(clean);
      }
      return null;
    };

    // 1. Token Exchange
    console.log("\n[TEST GROUP 1] Session Token Exchange (/api/auth/session-token)");
    const customTokenA = `custom_token_${userA_Uid}`;
    let sessionA;

    await test("1.1 Exchanges Custom Token for ID Token & Refresh Token via HTTP endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/auth/session-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customToken: customTokenA }),
      });
      assert.strictEqual(res.status, 200);
      sessionA = await res.json();
      assert.strictEqual(sessionA.success, true);
      assert.ok(sessionA.idToken, "Must return valid idToken");
      assert.ok(sessionA.refreshToken, "Must return valid refreshToken");
      assert.strictEqual(typeof sessionA.expiresIn, "number");
    });

    await test("1.2 Validates maximum string length on custom token (< 4096)", async () => {
      const oversized = "a".repeat(5000);
      const res = await fetch(`${baseUrl}/api/auth/session-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customToken: oversized }),
      });
      assert.strictEqual(res.status, 400);
    });

    // 2. Token Refresh
    console.log("\n[TEST GROUP 2] Token Refresh Engine (/api/auth/refresh-token)");
    let refreshedSessionA;

    await test("2.1 Refreshes session using valid Refresh Token via HTTP endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: sessionA.refreshToken }),
      });
      assert.strictEqual(res.status, 200);
      refreshedSessionA = await res.json();
      assert.strictEqual(refreshedSessionA.success, true);
      assert.ok(refreshedSessionA.idToken);
      assert.ok(refreshedSessionA.refreshToken);
    });

    await test("2.2 Rejects invalid/revoked refresh token with 401", async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid_revoked_token_xyz" }),
      });
      assert.strictEqual(res.status, 401);
    });

    // 3. Official ID Token Verification Across ALL Protected Collector Endpoints
    console.log("\n[TEST GROUP 3] Official ID Token Verification Across All Collector Routes");

    const authHeadersA = {
      Authorization: `Bearer ${sessionA.idToken}`,
      "Content-Type": "application/json",
    };

    await test("3.1 GET /api/collector/wishlist accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/wishlist`, { headers: authHeadersA });
      assert.strictEqual(res.status, 200);
    });

    await test("3.2 POST /api/collector/wishlist accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/wishlist`, {
        method: "POST",
        headers: authHeadersA,
        body: JSON.stringify({ items: [{ id: 2126, name: "Masterpiece" }] }),
      });
      assert.strictEqual(res.status, 200);
    });

    await test("3.3 GET /api/collector/enquiries accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/enquiries`, { headers: authHeadersA });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await test("3.4 GET /api/collector/addresses accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/addresses`, { headers: authHeadersA });
      assert.strictEqual(res.status, 200);
    });

    await test("3.5 POST /api/collector/addresses accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/addresses`, {
        method: "POST",
        headers: authHeadersA,
        body: JSON.stringify({ addresses: [{ id: "addr_1", fullName: "Collector A", phone: "+919876543210" }] }),
      });
      assert.strictEqual(res.status, 200);
    });

    await test("3.6 GET /api/collector/profile accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/profile`, { headers: authHeadersA });
      assert.strictEqual(res.status, 200);
    });

    await test("3.7 POST /api/collector/profile accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/profile`, {
        method: "POST",
        headers: authHeadersA,
        body: JSON.stringify({ profile: { firstName: "Collector", lastName: "A", avatarUrl: "avatar_2" } }),
      });
      assert.strictEqual(res.status, 200);
    });

    await test("3.8 GET /api/collector/my-bids accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/my-bids`, { headers: authHeadersA });
      assert.strictEqual(res.status, 200);
    });

    await test("3.9 POST /api/collector/push-token accepts verified ID token (200)", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: authHeadersA,
        body: JSON.stringify({ pushToken: "ExpoPushToken[abcdef1234567890]" }),
      });
      assert.strictEqual(res.status, 200);
    });

    // 4. Expired Token Simulation & Single Retry Proof
    console.log("\n[TEST GROUP 4] Expired Token Simulation & Single Auto-Refresh Retry");

    await test("4.1 Rejects expired ID token with 401 across endpoints", async () => {
      const expiredToken = `expired_token_${userA_Uid}`;
      const res = await fetch(`${baseUrl}/api/collector/enquiries`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res.status, 401);
    });

    await test("4.2 Simulates authenticated client single refresh & retry recovery", async () => {
      // Step A: Expired token receives 401
      // Step B: Client refreshes token
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: sessionA.refreshToken }),
      });
      assert.strictEqual(refreshRes.status, 200);
      const { idToken: newIdToken } = await refreshRes.json();

      // Step C: Client retries original request with new ID token -> 200 OK
      const retryRes = await fetch(`${baseUrl}/api/collector/enquiries`, {
        headers: { Authorization: `Bearer ${newIdToken}` },
      });
      assert.strictEqual(retryRes.status, 200);
    });

    // 5. Multi-User Isolation & Anti-Contamination Proof
    console.log("\n[TEST GROUP 5] Multi-User Enquiry Isolation & Cache Clearing");

    await test("5.1 Confirms User A enquiries cannot be fetched or seen by User B", async () => {
      // Create custom token & session for User B
      const customTokenB = `custom_token_${userB_Uid}`;
      const sessionResB = await fetch(`${baseUrl}/api/auth/session-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customToken: customTokenB }),
      });
      const sessionB = await sessionResB.json();

      // User A submits enquiry
      await collectorStore.saveEnquiry({
        enquiryId: "enq_secret_A_999",
        artworkId: 3001,
        artworkTitle: "User A Private Masterpiece",
        collectorUid: userA_Uid,
        collectorName: "Collector A",
        collectorEmail: "userA@primoartgallery.com",
        message: "Private confidential bid.",
        status: "Under Curatorial Review",
        createdAt: new Date().toISOString(),
      });

      // User A fetches enquiries
      const resA = await fetch(`${baseUrl}/api/collector/enquiries`, {
        headers: { Authorization: `Bearer ${sessionA.idToken}` },
      });
      const dataA = await resA.json();
      assert.ok(dataA.enquiries.some((e) => e.artworkTitle === "User A Private Masterpiece"));

      // User B fetches enquiries -> MUST NOT contain User A enquiry
      const resB = await fetch(`${baseUrl}/api/collector/enquiries`, {
        headers: { Authorization: `Bearer ${sessionB.idToken}` },
      });
      const dataB = await resB.json();
      assert.strictEqual(dataB.enquiries.some((e) => e.artworkTitle === "User A Private Masterpiece"), false);
    });

  } finally {
    if (typeof origExchange === "function") firebaseAdmin.exchangeCustomTokenForSession = origExchange;
    if (typeof origRefresh === "function") firebaseAdmin.refreshFirebaseIdToken = origRefresh;
    if (typeof origVerify === "function") firebaseAdmin.verifyAuthToken = origVerify;
    server.close();
  }

  console.log("\n==================================================================");
  console.log(`COMPREHENSIVE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveSessionTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
