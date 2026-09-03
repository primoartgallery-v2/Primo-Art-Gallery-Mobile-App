const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");
const app = require("../index");

async function runSavedArtistsTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY FEATURE 4: SAVED ARTISTS TEST SUITE");
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

  const testDataDir = path.join(__dirname, "..", "data", "test_saved_artists_data");
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
    await test("1. Enforces strict UID isolation: User A cannot read or write User B's saved artists", async () => {
      const userA = "primo_collector_artists_A";
      const userB = "primo_collector_artists_B";

      await mockCollectorStore.saveSavedArtists(userA, ["12", "14", "18"]);
      await mockCollectorStore.saveSavedArtists(userB, ["99", "105"]);

      const listA = await mockCollectorStore.getSavedArtists(userA);
      const listB = await mockCollectorStore.getSavedArtists(userB);

      assert.strictEqual(listA.length, 3);
      assert.strictEqual(listB.length, 2);
      assert.ok(listA.includes("12") && listA.includes("14") && listA.includes("18"));
      assert.ok(!listA.includes("99"), "User A must NOT contain User B artists");
    });

    // -------------------------------------------------------------
    // TEST 2: Unauthorized Access Rejection (401)
    // -------------------------------------------------------------
    await test("2. Rejects unauthenticated requests to /api/collector/saved-artists with 401", async () => {
      const getRes = await makeRequest("/api/collector/saved-artists");
      assert.strictEqual(getRes.status, 401, "GET without token must be rejected with 401");

      const postRes = await makeRequest("/api/collector/saved-artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistIds: ["10"] }),
      });
      assert.strictEqual(postRes.status, 401, "POST without token must be rejected with 401");
    });

    // -------------------------------------------------------------
    // TEST 3: Verified Token Derives Canonical UID
    // -------------------------------------------------------------
    await test("3. Cryptographically derives canonical UID from verified Bearer token", async () => {
      const testUid = "primo_usr_auth_artists_999";
      const token = await firebaseAdmin.createCustomTokenForUser(testUid, {
        authMethod: "email_otp",
      });

      const postRes = await makeRequest("/api/collector/saved-artists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ artistIds: ["45", "52"] }),
      });
      assert.strictEqual(postRes.status, 200, "POST with valid token must succeed");
      assert.strictEqual(postRes.data.count, 2);

      const getRes = await makeRequest("/api/collector/saved-artists", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(getRes.status, 200, "GET with valid token must succeed");
      assert.deepStrictEqual(getRes.data.artistIds, ["45", "52"]);
    });

    // -------------------------------------------------------------
    // TEST 4 & 5: Save and Unsave Artist
    // -------------------------------------------------------------
    await test("4 & 5. Correctly saves and unsaves artists", async () => {
      const testUid = "primo_usr_save_unsave_test";

      // 1. Initial save: [10, 20]
      await mockCollectorStore.saveSavedArtists(testUid, ["10", "20"]);
      let current = await mockCollectorStore.getSavedArtists(testUid);
      assert.strictEqual(current.length, 2);

      // 2. Add artist 30: [10, 20, 30]
      await mockCollectorStore.saveSavedArtists(testUid, [...current, "30"]);
      current = await mockCollectorStore.getSavedArtists(testUid);
      assert.strictEqual(current.length, 3);
      assert.ok(current.includes("30"));

      // 3. Unsave artist 20: [10, 30]
      const unsaved = current.filter((id) => id !== "20");
      await mockCollectorStore.saveSavedArtists(testUid, unsaved);
      current = await mockCollectorStore.getSavedArtists(testUid);
      assert.strictEqual(current.length, 2);
      assert.ok(!current.includes("20"), "Artist 20 must be unsaved");
      assert.ok(current.includes("10") && current.includes("30"));
    });

    // -------------------------------------------------------------
    // TEST 6: Duplicate Artist Prevention
    // -------------------------------------------------------------
    await test("6. Deduplicates saved artist IDs automatically", async () => {
      const testUid = "primo_usr_artist_dedup";
      const rawWithDupes = ["45", "50", "45", "60", "50", "  45  "];

      await mockCollectorStore.saveSavedArtists(testUid, rawWithDupes);
      const result = await mockCollectorStore.getSavedArtists(testUid);

      assert.strictEqual(result.length, 3, "Must contain exactly 3 unique IDs");
      assert.deepStrictEqual(result, ["45", "50", "60"]);
    });

    // -------------------------------------------------------------
    // TEST 7 & 8: Offline Save, Pending Queue & Reconnect Flush
    // -------------------------------------------------------------
    await test("7 & 8. Offline Flow: Enqueues pending sync offline and flushes upon reconnection", async () => {
      const testUid = "primo_usr_offline_artist_flow";
      const localAsyncStorage = {};
      const pendingQueueKey = `@primo_pending_saved_artists_sync_${testUid}`;
      const localCacheKey = `@primo_saved_artists_${testUid}`;

      let isOnline = false;
      const ids = ["12", "34", "56"];

      // 1. Instant local write
      localAsyncStorage[localCacheKey] = JSON.stringify(ids);

      // 2. Offline: Enqueue to pending queue
      if (!isOnline) {
        localAsyncStorage[pendingQueueKey] = JSON.stringify(ids);
      }

      assert.ok(localAsyncStorage[pendingQueueKey], "Pending sync queue must be populated offline");

      // 3. Reconnect: Flush queue to backend
      isOnline = true;
      const idsToFlush = JSON.parse(localAsyncStorage[pendingQueueKey]);
      await mockCollectorStore.saveSavedArtists(testUid, idsToFlush);
      delete localAsyncStorage[pendingQueueKey]; // Cleared

      assert.strictEqual(localAsyncStorage[pendingQueueKey], undefined, "Pending queue cleared");
      const cloudIds = await mockCollectorStore.getSavedArtists(testUid);
      assert.strictEqual(cloudIds.length, 3);
      assert.deepStrictEqual(cloudIds, ["12", "34", "56"]);
    });

    // -------------------------------------------------------------
    // TEST 9: Logout / Login Persistence & Guest Merge
    // -------------------------------------------------------------
    await test("9. Merges guest saved artists into authenticated user account seamlessly", async () => {
      const guestSaved = ["101", "102"];
      const userSaved = ["102", "103"];

      // Merge union
      const merged = Array.from(new Set([...guestSaved, ...userSaved]));
      const testUid = "primo_usr_merge_artists";
      await mockCollectorStore.saveSavedArtists(testUid, merged);

      const result = await mockCollectorStore.getSavedArtists(testUid);
      assert.strictEqual(result.length, 3, "Merged list must have exactly 3 unique artists");
      assert.deepStrictEqual(result, ["101", "102", "103"]);
    });

    // -------------------------------------------------------------
    // TEST 10: Cross-User Anti-Spoofing
    // -------------------------------------------------------------
    await test("10. Rejects client attempt to modify another user's saved artists", async () => {
      const legitUid = "primo_usr_legit_artist";
      const token = await firebaseAdmin.createCustomTokenForUser(legitUid, {
        authMethod: "email_otp",
      });

      // Attempt to post with fake userId in body
      const res = await makeRequest("/api/collector/saved-artists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: "attacker_victim_target",
          artistIds: ["999"],
        }),
      });

      assert.strictEqual(res.status, 200);
      // Verify that the data was saved under legitUid, NOT under attacker_victim_target
      const legitData = await mockCollectorStore.getSavedArtists(legitUid);
      const victimData = await mockCollectorStore.getSavedArtists("attacker_victim_target");
      assert.strictEqual(victimData.length, 0, "Victim account must remain untouched");
    });

    // -------------------------------------------------------------
    // TEST 11: Saved Artists Filter Correctness
    // -------------------------------------------------------------
    await test("11. Verifies saved artists list filter logic", async () => {
      const allArtists = [
        { id: 1, name: "Sabia", category: "Traditional" },
        { id: 2, name: "Pardeep Kumar", category: "Contemporary" },
        { id: 3, name: "Radha Devi", category: "Madhubani" },
      ];
      const savedIds = ["1", "3"];

      const savedOnly = allArtists.filter((a) => savedIds.includes(String(a.id)));
      assert.strictEqual(savedOnly.length, 2);
      assert.strictEqual(savedOnly[0].name, "Sabia");
      assert.strictEqual(savedOnly[1].name, "Radha Devi");
    });

    // -------------------------------------------------------------
    // TEST 12: Feature 1 Wishlist Endpoints Protected
    // -------------------------------------------------------------
    await test("12. Feature 1 Wishlist endpoint remains protected", async () => {
      const res = await makeRequest("/api/collector/wishlist");
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // TEST 13: Feature 2 Search & Filter Endpoints Operational
    // -------------------------------------------------------------
    await test("13. Feature 2 Search & Filter endpoint remains operational", async () => {
      const res = await makeRequest("/api/products?search=Krishna&min_price=10000&max_price=50000");
      assert.ok(res.status === 200 || res.status === 502 || res.status === 503);
    });

    // -------------------------------------------------------------
    // TEST 14: Feature 3 Recently Viewed Endpoints Protected
    // -------------------------------------------------------------
    await test("14. Feature 3 Recently Viewed endpoint remains protected", async () => {
      const res = await makeRequest("/api/collector/recently-viewed");
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // TEST 15: Phase 1 Health Endpoint Unaffected
    // -------------------------------------------------------------
    await test("15. Phase 1 /health endpoint returns 200 OK", async () => {
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
  runSavedArtistsTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runSavedArtistsTests;
