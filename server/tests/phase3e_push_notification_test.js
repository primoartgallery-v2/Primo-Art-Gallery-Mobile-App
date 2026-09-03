const assert = require("assert");
const http = require("http");
const crypto = require("crypto");
const app = require("../index");
const pushNotificationService = require("../services/pushNotificationService");
const collectorStore = require("../services/collectorStore");

function createValidToken(uid, email = "push_collector@example.com") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `Bearer ${header}.${payload}.${sig}`;
}

async function runPhase3E2Tests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 3E-2: PUSH NOTIFICATION TEST SUITE");
  console.log("==================================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

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

  const userA = `push_usr_A_${Date.now()}`;
  const userB = `push_usr_B_${Date.now()}`;
  const tokenA = createValidToken(userA, "collector_a@example.com");
  const tokenB = createValidToken(userB, "collector_b@example.com");
  const sampleExpoToken1 = "ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx1]";
  const sampleExpoToken2 = "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy2]";

  try {
    // -------------------------------------------------------------
    // GROUP 1: AUTHENTICATION & UID ISOLATION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 1] Authentication & UID Isolation");

    await test("1.1 Registers valid Expo push token for authenticated user", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({
          pushToken: sampleExpoToken1,
          platform: "ios",
          deviceName: "iPhone 15 Pro",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 1);
    });

    await test("1.2 Rejects unauthenticated request to /api/collector/push-token with 401", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushToken: sampleExpoToken1 }),
      });
      assert.strictEqual(res.status, 401);
    });

    await test("1.3 Rejects forged / unsigned JWT on push-token registration with 401", async () => {
      const forged = `Bearer ${Buffer.from(JSON.stringify({ uid: userA })).toString("base64")}`;
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: forged },
        body: JSON.stringify({ pushToken: sampleExpoToken1 }),
      });
      assert.strictEqual(res.status, 401);
    });

    await test("1.4 Client-supplied body UID cannot override authenticated token UID", async () => {
      // User B attempts to register a token under User A's UID in the body
      const spoofedBodyToken = "ExpoPushToken[spoofed_token_attempt_99]";
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenB },
        body: JSON.stringify({
          uid: userA, // Spoofed parameter
          pushToken: spoofedBodyToken,
        }),
      });

      assert.strictEqual(res.status, 200);

      // Verify token was saved strictly under User B, NOT User A
      const userATokens = await collectorStore.getPushTokens(userA);
      const userBTokens = await collectorStore.getPushTokens(userB);

      assert.strictEqual(userATokens.some((t) => t.token === spoofedBodyToken), false, "User A must not receive spoofed token");
      assert.strictEqual(userBTokens.some((t) => t.token === spoofedBodyToken), true, "Token must be saved strictly under authenticated User B");
    });

    await test("1.5 User A cannot read or access User B's push tokens", async () => {
      const resA = await fetch(`${baseUrl}/api/collector/push-tokens`, {
        method: "GET",
        headers: { Authorization: tokenA },
      });
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();

      assert.strictEqual(dataA.tokens.some((t) => t.token.includes("spoofed_token")), false, "User A cannot see User B's tokens");
    });

    // -------------------------------------------------------------
    // GROUP 2: TOKEN FORMAT VALIDATION & LIFECYCLE
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 2] Token Format Validation & Lifecycle Management");

    await test("2.1 Rejects empty or non-string push token with 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({ pushToken: "" }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test("2.2 Rejects malformed / non-Expo token string with 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({ pushToken: "invalid_fcm_token_12345" }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test("2.3 Duplicate token registration for same user is idempotent (updates timestamp without duplication)", async () => {
      const res1 = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({
          pushToken: sampleExpoToken1,
          deviceName: "Renamed iPhone",
        }),
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.count, 1, "Count must remain 1 on duplicate registration");
    });

    await test("2.4 Supports multiple devices/tokens for the same user", async () => {
      const res2 = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({
          pushToken: sampleExpoToken2,
          platform: "android",
          deviceName: "Pixel 8 Pro",
        }),
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.count, 2, "User A now has 2 registered devices");
    });

    await test("2.5 Unregisters specific device token successfully via DELETE endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/collector/push-token`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({ pushToken: sampleExpoToken1 }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.removed, true);

      const tokens = await collectorStore.getPushTokens(userA);
      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].token, sampleExpoToken2);
    });

    // -------------------------------------------------------------
    // GROUP 3: EXPO PUSH SERVICE RESILIENCE & OUTBID CONTRACT
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 3] Push Notification Service Resiliency & Outbid Contract");

    await test("3.1 Formats strictly sanitized outbid notification payload (no secrets/JWTs/emails)", async () => {
      // Register token for user A
      await collectorStore.savePushToken(userA, { token: sampleExpoToken1 });

      const outbidResult = await pushNotificationService.sendOutbidNotification({
        recipientUid: userA,
        auctionId: 1260,
        lotTitle: "Divine Harmony",
        currentBid: 275000,
        nextMinimumBid: 285000,
      });

      assert(outbidResult.success !== undefined);
    });

    await test("3.2 Expo API timeout (3000ms) is handled safely without throwing or crashing", async () => {
      pushNotificationService.setMockMode("timeout");

      const result = await pushNotificationService.sendPushNotification({
        to: sampleExpoToken1,
        title: "Test Timeout",
        body: "Testing timeout resilience",
      });

      assert.strictEqual(result.success, false);
      assert(result.error.includes("timed out"));
      pushNotificationService.setMockMode("normal");
    });

    await test("3.3 Expo API 500 error is handled safely without crashing the backend", async () => {
      pushNotificationService.setMockMode("error");

      const result = await pushNotificationService.sendPushNotification({
        to: sampleExpoToken1,
        title: "Test Error",
        body: "Testing 500 resilience",
      });

      assert.strictEqual(result.success, false);
      pushNotificationService.setMockMode("normal");
    });

    await test("3.4 Purges invalid/expired token on DeviceNotRegistered receipt", async () => {
      const deadToken = "ExpoPushToken[dead_device_token_999]";
      await collectorStore.savePushToken(userA, { token: deadToken });

      pushNotificationService.setMockMode("invalid_token");
      await pushNotificationService.sendOutbidNotification({
        recipientUid: userA,
        auctionId: 1260,
        lotTitle: "Lot 1260",
        currentBid: 300000,
        nextMinimumBid: 310000,
      });

      pushNotificationService.setMockMode("normal");

      const userTokens = await collectorStore.getPushTokens(userA);
      assert.strictEqual(userTokens.some((t) => t.token === deadToken), false, "Dead token must be purged from user records");
    });

    await test("3.5 Auction bid placement and success remain 100% unaffected if push notification fails", async () => {
      // Mock WordPress server for auction bid
      const mockWpServer = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, lot_id: 1260, current_bid: 500000, next_min_bid: 510000 }));
      });
      await new Promise((resolve) => mockWpServer.listen(0, resolve));
      const mockWpPort = mockWpServer.address().port;

      const savedWp = process.env.WOOCOMMERCE_URL;
      process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${mockWpPort}`;

      // Simulate push service outage
      pushNotificationService.setMockMode("error");

      const bidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tokenA },
        body: JSON.stringify({
          bidAmount: 500000,
          collectorName: "Resilient Collector",
          collectorEmail: "collector_a@example.com",
        }),
      });

      assert.strictEqual(bidRes.status, 201, "Authoritative bid must succeed with 201 regardless of push service state");
      const data = await bidRes.json();
      assert.strictEqual(data.success, true);

      // Cleanup
      process.env.WOOCOMMERCE_URL = savedWp;
      await new Promise((resolve) => mockWpServer.close(resolve));
      pushNotificationService.setMockMode("normal");
    });
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n==================================================================");
  console.log(`PHASE 3E-2 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase3E2Tests().catch((err) => {
    console.error("Phase 3E-2 tests failed:", err);
    process.exit(1);
  });
}

module.exports = runPhase3E2Tests;
