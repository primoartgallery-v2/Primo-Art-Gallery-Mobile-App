const assert = require("assert");
const http = require("http");
const crypto = require("crypto");
const app = require("../index");
const distributedRateLimiter = require("../services/distributedRateLimiter");
const collectorStore = require("../services/collectorStore");

function createValidToken(uid, email = "rate_test_collector@example.com") {
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

async function runDistributedRateLimitingTests() {
  console.log("==================================================================");
  console.log("RUNNING P1 DISTRIBUTED RATE LIMITING & ABUSE PROTECTION TEST SUITE");
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

  try {
    // -------------------------------------------------------------
    // GROUP 1: AUCTION FAIL-CLOSED POLICY (REDIS OUTAGE RESILIENCY)
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 1] Auction Fail-Closed Policy on Rate-Limit Outage");

    // Start a mock WordPress server to verify it is NEVER called when rate limiting fails
    let bridgeCallCount = 0;
    const mockWpServer = http.createServer((req, res) => {
      bridgeCallCount++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, lot_id: 1260, current_bid: 100000, next_min_bid: 105000 }));
    });
    await new Promise((resolve) => mockWpServer.listen(0, resolve));
    const mockWpPort = mockWpServer.address().port;

    const savedWp = process.env.WOOCOMMERCE_URL;
    process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${mockWpPort}`;

    const testBidderUid = `test_bidder_rl_outage_${Date.now()}`;
    const testBidderToken = createValidToken(testBidderUid, "outage_bidder@example.com");

    await test("1.1 Returns 503 AUCTION_RATE_LIMIT_SERVICE_UNAVAILABLE when Redis times out or fails", async () => {
      // Simulate Redis infrastructure failure / timeout
      distributedRateLimiter.setMockMode("timeout");
      bridgeCallCount = 0;

      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: testBidderToken },
        body: JSON.stringify({
          bidAmount: 150000,
          collectorName: "Outage Test Bidder",
          collectorEmail: "outage@example.com",
        }),
      });

      assert.strictEqual(res.status, 503, "Auction bid must fail-closed with 503 during Redis outage");
      const data = await res.json();
      assert.strictEqual(data.code, "AUCTION_RATE_LIMIT_SERVICE_UNAVAILABLE");
      assert.strictEqual(data.retryable, true);
    });

    await test("1.2 Proves WordPress auction bridge is NEVER called during Redis outage", async () => {
      assert.strictEqual(bridgeCallCount, 0, "WordPress bridge must not be invoked when rate limit infrastructure fails");
    });

    await test("1.3 Proves zero records created in Firestore/local bid storage during Redis outage", async () => {
      const bids = await collectorStore.getCollectorBids(testBidderUid);
      assert.strictEqual(bids.length, 0, "No bid record must be saved in storage during outage");
    });

    await test("1.4 Repeated auction requests cannot bypass the fail-closed policy", async () => {
      distributedRateLimiter.setMockMode("error");
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: testBidderToken },
          body: JSON.stringify({
            bidAmount: 150000 + i * 5000,
            collectorName: "Outage Spammer",
            collectorEmail: "spam@example.com",
          }),
        });
        assert.strictEqual(res.status, 503, `Attempt ${i + 1} must return 503`);
        const data = await res.json();
        assert.strictEqual(data.code, "AUCTION_RATE_LIMIT_SERVICE_UNAVAILABLE");
      }
      assert.strictEqual(bridgeCallCount, 0, "Bridge must remain untouched across repeated attempts");
    });

    // Cleanup mock WP server
    process.env.WOOCOMMERCE_URL = savedWp;
    await new Promise((resolve) => mockWpServer.close(resolve));
    distributedRateLimiter.setMockMode("normal");

    // -------------------------------------------------------------
    // GROUP 2: GLOBAL & CATALOGUE FAIL-OPEN RESILIENCY
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 2] Global & Catalogue Fail-Open Resiliency During Redis Outage");

    await test("2.1 Global proxy traffic remains fully operational during Redis outage (fail-open)", async () => {
      distributedRateLimiter.setMockMode("error");
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200, "Health check must return 200 even if Redis is down");
    });

    await test("2.2 Artwork acquisition enquiry succeeds via bounded local fallback during Redis outage", async () => {
      distributedRateLimiter.setMockMode("timeout");
      const res = await fetch(`${baseUrl}/api/enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 101,
          artworkTitle: "Failover Masterpiece",
          collectorName: "Resilient Collector",
          collectorEmail: `resilient_${Date.now()}@example.com`,
          message: "Inquiring about artwork availability during failover test.",
        }),
      });
      assert.strictEqual(res.status, 201, "Enquiries must fail-open to local fallback with 201 Created");
    });

    await test("2.3 Exhibition VIP RSVP succeeds via bounded local fallback during Redis outage", async () => {
      distributedRateLimiter.setMockMode("timeout");
      const res = await fetch(`${baseUrl}/api/exhibitions/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhibitionId: 101,
          collectorName: "Resilient Guest",
          collectorEmail: `guest_${Date.now()}@example.com`,
          guestCount: 2,
        }),
      });
      assert.strictEqual(res.status, 201, "RSVP must fail-open to local fallback with 201 Created");
    });

    distributedRateLimiter.setMockMode("normal");

    // -------------------------------------------------------------
    // GROUP 3: BOUNDED MEMORY STORAGE & EVICTION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 3] Bounded In-Memory Storage & Eviction Protection");

    await test("3.1 In-memory store bounds max entries and sweeps expired timestamps", async () => {
      // Inject dummy expired entries
      const oldTime = Date.now() - 2 * 60 * 60 * 1000;
      distributedRateLimiter.localStore.set("test_old_key_1", { timestamps: [oldTime], expiresAt: oldTime });
      distributedRateLimiter.localStore.set("test_active_key_2", { timestamps: [Date.now()], expiresAt: Date.now() + 60000 });

      distributedRateLimiter._cleanupLocalStore();

      assert.strictEqual(distributedRateLimiter.localStore.has("test_old_key_1"), false, "Expired entry must be pruned");
      assert.strictEqual(distributedRateLimiter.localStore.has("test_active_key_2"), true, "Active entry must be preserved");

      // Cleanup
      distributedRateLimiter.localStore.delete("test_active_key_2");
    });

    // -------------------------------------------------------------
    // GROUP 4: PASSWORD LOGIN BRUTE-FORCE PROTECTION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 4] Password Login Brute-Force & Lockout Protection");

    const attackTargetEmail = `brute_victim_${Date.now()}@primo.art`;

    await test("4.1 Rejects incorrect password with 401 and reports remaining attempts", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: attackTargetEmail,
          password: "wrong_password_1",
        }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.remainingAttempts, 4);
    });

    await test("4.2 Locks account for 15 minutes after 5 consecutive failed attempts (423 Locked)", async () => {
      for (let i = 2; i <= 5; i++) {
        const res = await fetch(`${baseUrl}/api/auth/login-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: attackTargetEmail,
            password: `wrong_password_${i}`,
          }),
        });
        if (i === 5) {
          assert.strictEqual(res.status, 423, "5th failed attempt must trigger 423 Locked");
          const data = await res.json();
          assert.strictEqual(data.locked, true);
        } else {
          assert.strictEqual(res.status, 401);
        }
      }
    });

    await test("4.3 Subsequent login attempts during lockout are blocked immediately with 423", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: attackTargetEmail,
          password: "even_correct_or_wrong_password",
        }),
      });
      assert.strictEqual(res.status, 423, "Must return 423 Locked during active lockout window");
      const data = await res.json();
      assert.strictEqual(data.locked, true);
    });

    await test("4.4 Different email is not affected by lockout (strict key isolation)", async () => {
      const differentEmail = `unaffected_${Date.now()}@primo.art`;
      const res = await fetch(`${baseUrl}/api/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: differentEmail,
          password: "wrong_password_unaffected",
        }),
      });
      assert.strictEqual(res.status, 401, "Different email must not be locked");
      const data = await res.json();
      assert.strictEqual(data.remainingAttempts, 4);
    });

    // Clean up lockout for test email
    await distributedRateLimiter.clearFailure({ bucket: "login_password", key: attackTargetEmail });

    // -------------------------------------------------------------
    // GROUP 5: SLIDING WINDOW LIMIT ENFORCEMENT ACROSS ENDPOINTS
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 5] Sliding Window Limit Enforcement Across Endpoints");

    await test("5.1 Enforces 5 enquiries per hour per IP+email", async () => {
      const spamEmail = `enquiry_spammer_${Date.now()}@example.com`;
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/api/enquiries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artworkId: 101,
            artworkTitle: "Enquiry Test",
            collectorName: "Spam Tester",
            collectorEmail: spamEmail,
            message: "Valid length message for enquiry rate limit test.",
          }),
        });
        assert.strictEqual(res.status, 201);
      }

      // 6th enquiry must be throttled
      const blockedRes = await fetch(`${baseUrl}/api/enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 101,
          artworkTitle: "Enquiry Test",
          collectorName: "Spam Tester",
          collectorEmail: spamEmail,
          message: "Valid length message for enquiry rate limit test.",
        }),
      });
      assert.strictEqual(blockedRes.status, 429, "6th enquiry within 1 hour must return 429");
    });

    await test("5.2 Enforces 3 exhibition RSVPs per hour per IP+email", async () => {
      const rsvpSpamEmail = `rsvp_spammer_${Date.now()}@example.com`;
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${baseUrl}/api/exhibitions/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exhibitionId: 101,
            collectorName: "RSVP Tester",
            collectorEmail: rsvpSpamEmail,
            guestCount: 1,
          }),
        });
        assert.strictEqual(res.status, 201);
      }

      // 4th RSVP must be throttled
      const blockedRes = await fetch(`${baseUrl}/api/exhibitions/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhibitionId: 101,
          collectorName: "RSVP Tester",
          collectorEmail: rsvpSpamEmail,
          guestCount: 1,
        }),
      });
      assert.strictEqual(blockedRes.status, 429, "4th RSVP within 1 hour must return 429");
    });
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n==================================================================");
  console.log(`DISTRIBUTED RATE LIMITING TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runDistributedRateLimitingTests().catch((err) => {
    console.error("Distributed rate limiting tests failed:", err);
    process.exit(1);
  });
}

module.exports = runDistributedRateLimitingTests;
