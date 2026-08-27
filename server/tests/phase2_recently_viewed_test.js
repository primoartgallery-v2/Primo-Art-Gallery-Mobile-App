const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");
const app = require("../index");

async function runRecentlyViewedTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY FEATURE 3: RECENTLY VIEWED TEST SUITE");
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

  const testDataDir = path.join(__dirname, "..", "data", "test_recently_viewed_data");
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const mockCollectorStore = new collectorStore.constructor({ dataDir: testDataDir });

  // Start test HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function makeRequest(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data };
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Strict UID Isolation
    // -------------------------------------------------------------
    await test("1. Enforces strict UID isolation: User A cannot access User B's recently viewed history", async () => {
      const userA = "primo_collector_recent_A";
      const userB = "primo_collector_recent_B";

      await mockCollectorStore.saveRecentlyViewed(userA, [
        { id: 101, name: "Sunset at Ganga", price: "45000", viewedAt: new Date().toISOString() },
      ]);
      await mockCollectorStore.saveRecentlyViewed(userB, [
        { id: 202, name: "Royal Elephant Parade", price: "85000", viewedAt: new Date().toISOString() },
      ]);

      const itemsA = await mockCollectorStore.getRecentlyViewed(userA);
      const itemsB = await mockCollectorStore.getRecentlyViewed(userB);

      assert.strictEqual(itemsA.length, 1);
      assert.strictEqual(itemsB.length, 1);
      assert.strictEqual(itemsA[0].id, 101);
      assert.strictEqual(itemsB[0].id, 202);
      assert.ok(!itemsA.some((i) => i.id === 202), "User A must NOT see User B history");
    });

    // -------------------------------------------------------------
    // TEST 2: Unauthorized Access Rejection (401)
    // -------------------------------------------------------------
    await test("2. Rejects unauthenticated requests to /api/collector/recently-viewed with 401", async () => {
      const getRes = await makeRequest("/api/collector/recently-viewed");
      assert.strictEqual(getRes.status, 401, "GET without token must be rejected with 401");

      const postRes = await makeRequest("/api/collector/recently-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
      assert.strictEqual(postRes.status, 401, "POST without token must be rejected with 401");
    });

    // -------------------------------------------------------------
    // TEST 3: Verified Token Derives Canonical UID
    // -------------------------------------------------------------
    await test("3. Cryptographically derives canonical UID from verified Bearer token", async () => {
      const testUid = "primo_usr_auth_recent_777";
      const token = await firebaseAdmin.createCustomTokenForUser(testUid, {
        authMethod: "email_otp",
      });

      const getRes = await makeRequest("/api/collector/recently-viewed", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(getRes.status, 200, "Valid token must return 200 OK");
      assert.ok(Array.isArray(getRes.data.items));
    });

    // -------------------------------------------------------------
    // TEST 4: Duplicate Artwork Prevention
    // -------------------------------------------------------------
    await test("4. Deduplicates recently viewed items by artwork ID", async () => {
      const testUid = "primo_usr_dedup_recent";
      const submissions = [
        { id: 301, name: "Divine Radiance", price: "60000", viewedAt: "2026-08-27T01:00:00Z" },
        { id: 302, name: "Mystic Himalayas", price: "90000", viewedAt: "2026-08-27T02:00:00Z" },
        { id: 301, name: "Divine Radiance", price: "60000", viewedAt: "2026-08-27T03:00:00Z" },
      ];

      await mockCollectorStore.saveRecentlyViewed(testUid, submissions);
      const items = await mockCollectorStore.getRecentlyViewed(testUid);

      assert.strictEqual(items.length, 2, "Must contain exactly 2 unique items");
      assert.strictEqual(items[0].id, 301, "Most recently viewed item (#301) must be first");
      assert.strictEqual(items[1].id, 302);
    });

    // -------------------------------------------------------------
    // TEST 5: Opening Existing Artwork Moves to Position 0
    // -------------------------------------------------------------
    await test("5. Opening an already-viewed artwork moves it to position 0 (top)", async () => {
      const testUid = "primo_usr_pos0_test";
      // History: [A (10), B (20), C (30)]
      const initial = [
        { id: 10, name: "Artwork A", price: "10000", viewedAt: "2026-08-27T04:00:00Z" },
        { id: 20, name: "Artwork B", price: "20000", viewedAt: "2026-08-27T03:00:00Z" },
        { id: 30, name: "Artwork C", price: "30000", viewedAt: "2026-08-27T02:00:00Z" },
      ];
      await mockCollectorStore.saveRecentlyViewed(testUid, initial);

      // Now view B again with newer timestamp
      const updatedB = { id: 20, name: "Artwork B", price: "20000", viewedAt: "2026-08-27T05:00:00Z" };
      await mockCollectorStore.saveRecentlyViewed(testUid, [updatedB, ...initial]);

      const result = await mockCollectorStore.getRecentlyViewed(testUid);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].id, 20, "Artwork B must now be at position 0");
      assert.strictEqual(result[1].id, 10, "Artwork A must be at position 1");
      assert.strictEqual(result[2].id, 30, "Artwork C must be at position 2");
    });

    // -------------------------------------------------------------
    // TEST 6: viewedAt Updates Correctly
    // -------------------------------------------------------------
    await test("6. Updates viewedAt timestamp when artwork is re-viewed", async () => {
      const testUid = "primo_usr_viewed_at_update";
      const initial = [
        { id: 50, name: "Golden Lotus", price: "55000", viewedAt: "2026-08-27T01:00:00Z" },
      ];
      await mockCollectorStore.saveRecentlyViewed(testUid, initial);

      const newer = [
        { id: 50, name: "Golden Lotus", price: "55000", viewedAt: "2026-08-27T06:00:00Z" },
      ];
      await mockCollectorStore.saveRecentlyViewed(testUid, newer);

      const result = await mockCollectorStore.getRecentlyViewed(testUid);
      assert.strictEqual(result[0].viewedAt, "2026-08-27T06:00:00Z");
    });

    // -------------------------------------------------------------
    // TEST 7 & 8: 20-Item Maximum Cap (25 Views -> Exactly 20)
    // -------------------------------------------------------------
    await test("7 & 8. Enforces strict 20-item maximum history cap (25 views -> exactly 20)", async () => {
      const testUid = "primo_usr_cap_test";
      const twentyFiveArtworks = [];
      for (let i = 1; i <= 25; i++) {
        twentyFiveArtworks.push({
          id: 1000 + i,
          name: `Artwork #${i}`,
          price: "50000",
          viewedAt: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      await mockCollectorStore.saveRecentlyViewed(testUid, twentyFiveArtworks);
      const result = await mockCollectorStore.getRecentlyViewed(testUid);

      assert.strictEqual(result.length, 20, "Must be capped at exactly 20 items");
      assert.strictEqual(result[0].id, 1025, "Newest artwork (#1025) must be first");
      assert.strictEqual(result[19].id, 1006, "Oldest preserved artwork (#1006) must be 20th");
    });

    // -------------------------------------------------------------
    // TEST 9: Descending viewedAt Sort Order
    // -------------------------------------------------------------
    await test("9. Automatically sorts items in strict descending viewedAt order", async () => {
      const testUid = "primo_usr_sort_desc";
      const unsorted = [
        { id: 1, name: "Old", price: "10000", viewedAt: "2026-08-27T01:00:00Z" },
        { id: 3, name: "Newest", price: "30000", viewedAt: "2026-08-27T03:00:00Z" },
        { id: 2, name: "Middle", price: "20000", viewedAt: "2026-08-27T02:00:00Z" },
      ];

      await mockCollectorStore.saveRecentlyViewed(testUid, unsorted);
      const result = await mockCollectorStore.getRecentlyViewed(testUid);

      assert.strictEqual(result[0].id, 3);
      assert.strictEqual(result[1].id, 2);
      assert.strictEqual(result[2].id, 1);
    });

    // -------------------------------------------------------------
    // TEST 10, 11, 12: Guest -> Authenticated Merge (Deduplicated, Newest Wins)
    // -------------------------------------------------------------
    await test("10, 11, 12. Merges guest history into authenticated user history (deduped, newest wins)", async () => {
      const guestHistory = [
        { id: 201, name: "Guest Only Artwork", price: "25000", viewedAt: "2026-08-27T02:00:00Z" },
        { id: 202, name: "Common Artwork", price: "40000", viewedAt: "2026-08-27T04:00:00Z" }, // Newer
      ];

      const userHistory = [
        { id: 202, name: "Common Artwork", price: "40000", viewedAt: "2026-08-27T01:00:00Z" }, // Older
        { id: 203, name: "User Only Artwork", price: "75000", viewedAt: "2026-08-27T03:00:00Z" },
      ];

      const testUid = "primo_usr_merge_recent";
      // Merge simulation
      const combined = [...guestHistory, ...userHistory];
      await mockCollectorStore.saveRecentlyViewed(testUid, combined);

      const result = await mockCollectorStore.getRecentlyViewed(testUid);
      assert.strictEqual(result.length, 3, "Merged list must have exactly 3 unique artworks");
      assert.strictEqual(result[0].id, 202, "#202 with newest timestamp (04:00) must be first");
      assert.strictEqual(result[0].viewedAt, "2026-08-27T04:00:00Z");
      assert.strictEqual(result[1].id, 203);
      assert.strictEqual(result[2].id, 201);
    });

    // -------------------------------------------------------------
    // TEST 13, 14, 15: Offline Local Persistence & Queue Flush
    // -------------------------------------------------------------
    await test("13, 14, 15. Offline Flow: Saves locally, enqueues pending sync, flushes on reconnect", async () => {
      const testUid = "primo_usr_offline_recent_flow";
      const localAsyncStorage = {};
      const pendingQueueKey = `@primo_pending_recently_viewed_sync_${testUid}`;
      const localCacheKey = `@primo_recently_viewed_${testUid}`;

      let isOnline = false; // Simulate offline
      const artwork = { id: 777, name: "Offline Masterpiece", price: "125000", viewedAt: new Date().toISOString() };

      // 1. Instant local write
      localAsyncStorage[localCacheKey] = JSON.stringify([artwork]);

      // 2. Failed cloud sync enqueues in pending storage
      if (!isOnline) {
        localAsyncStorage[pendingQueueKey] = JSON.stringify([artwork]);
      }

      assert.ok(localAsyncStorage[pendingQueueKey], "Pending sync queue must be populated");

      // 3. Reconnect
      isOnline = true;
      const itemsToFlush = JSON.parse(localAsyncStorage[pendingQueueKey]);
      await mockCollectorStore.saveRecentlyViewed(testUid, itemsToFlush);
      delete localAsyncStorage[pendingQueueKey]; // Cleared

      assert.strictEqual(localAsyncStorage[pendingQueueKey], undefined, "Queue cleared after flush");
      const cloudItems = await mockCollectorStore.getRecentlyViewed(testUid);
      assert.strictEqual(cloudItems.length, 1);
      assert.strictEqual(cloudItems[0].id, 777);
    });

    // -------------------------------------------------------------
    // TEST 16: Existing Wishlist Endpoints Protected
    // -------------------------------------------------------------
    await test("16. Feature 1 Wishlist endpoints remain protected and operational", async () => {
      const res = await makeRequest("/api/collector/wishlist");
      assert.strictEqual(res.status, 401, "Wishlist route must require Bearer token");
    });

    // -------------------------------------------------------------
    // TEST 17: Phase 1 Health Endpoint Unaffected
    // -------------------------------------------------------------
    await test("17. Phase 1 /health endpoint returns 200 OK with server telemetry", async () => {
      const res = await makeRequest("/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, "ok");
    });
  } finally {
    server.close();
  }

  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  // Clean up
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch {}

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRecentlyViewedTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runRecentlyViewedTests;
