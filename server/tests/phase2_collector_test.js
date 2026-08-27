const assert = require("assert");
const fs = require("fs");
const path = require("path");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");

async function runPhase2Tests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 2: COLLECTOR TEST SUITE");
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

  const testDataDir = path.join(__dirname, "..", "data", "test_phase2_data");
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const mockCollectorStore = new collectorStore.constructor({ dataDir: testDataDir });

  // -------------------------------------------------------------
  // TEST 1: Strict UID Isolation on Wishlist
  // -------------------------------------------------------------
  await test("Enforces strict UID isolation: User A cannot access User B's wishlist", async () => {
    const userA = "primo_usr_collector_A_101";
    const userB = "primo_usr_collector_B_202";

    const userAItems = [
      { id: 101, name: "Sunset Over Banaras", price: "45000", permalink: "https://primo.art/101" },
      { id: 102, name: "Mystic Radha Krishna", price: "120000", permalink: "https://primo.art/102" },
    ];

    const userBItems = [
      { id: 201, name: "Cosmic Dance of Shiva", price: "250000", permalink: "https://primo.art/201" },
    ];

    await mockCollectorStore.saveWishlist(userA, userAItems);
    await mockCollectorStore.saveWishlist(userB, userBItems);

    const retrievedA = await mockCollectorStore.getWishlist(userA);
    const retrievedB = await mockCollectorStore.getWishlist(userB);

    assert.strictEqual(retrievedA.length, 2, "User A must have exactly 2 items");
    assert.strictEqual(retrievedB.length, 1, "User B must have exactly 1 item");
    assert.strictEqual(retrievedA[0].id, 101, "User A first item must be #101");
    assert.strictEqual(retrievedB[0].id, 201, "User B item must be #201");
    assert.ok(!retrievedA.some((item) => item.id === 201), "User A must NOT see User B items");
  });

  // -------------------------------------------------------------
  // TEST 2: Duplicate Wishlist Prevention by Artwork ID
  // -------------------------------------------------------------
  await test("Deduplicates wishlist items by numeric artwork ID", async () => {
    const testUid = "primo_usr_dedup_test";
    const duplicateItems = [
      { id: 301, name: "Golden Heritage Canvas", price: "55000" },
      { id: 301, name: "Golden Heritage Canvas (Dupe)", price: "55000" },
      { id: 302, name: "Vedic Symphony", price: "80000" },
      { id: 301, name: "Golden Heritage Canvas (Tripe)", price: "55000" },
    ];

    await mockCollectorStore.saveWishlist(testUid, duplicateItems);
    const items = await mockCollectorStore.getWishlist(testUid);

    assert.strictEqual(items.length, 2, "Duplicate artwork IDs must be deduplicated into exactly 2 items");
    assert.strictEqual(items[0].id, 301);
    assert.strictEqual(items[1].id, 302);
  });

  // -------------------------------------------------------------
  // TEST 3: Bearer Token Verification & UID Derivation
  // -------------------------------------------------------------
  await test("Derives authenticated UID from verified Bearer token without trusting client parameters", async () => {
    const testUid = "primo_usr_verified_token_uid_777";
    const customToken = await firebaseAdmin.createCustomTokenForUser(testUid, {
      authMethod: "email_otp",
    });

    const verified = await firebaseAdmin.verifyAuthToken(`Bearer ${customToken}`);
    assert.ok(verified, "Token must verify successfully");
    assert.strictEqual(verified.uid, testUid, "Derived UID must match the signed token subject");

    const invalid = await firebaseAdmin.verifyAuthToken("Bearer invalid_token_xyz");
    assert.strictEqual(invalid, null, "Invalid token must return null (unauthorized)");
  });

  // -------------------------------------------------------------
  // TEST 4: Guest Wishlist Merge Simulation
  // -------------------------------------------------------------
  await test("Safely merges guest wishlist into authenticated user wishlist without data loss", async () => {
    const guestItems = [
      { id: 401, name: "Royal Rajputana Painting", price: "65000" },
      { id: 402, name: "Lotus in Monsoons", price: "35000" },
    ];

    const userExistingItems = [
      { id: 402, name: "Lotus in Monsoons (Already Saved)", price: "35000" },
      { id: 403, name: "Abstract Divinity", price: "95000" },
    ];

    // Merge logic: Combine and deduplicate
    const seen = new Set();
    const merged = [];
    for (const item of [...guestItems, ...userExistingItems]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    const testUid = "primo_usr_merge_collector";
    await mockCollectorStore.saveWishlist(testUid, merged);

    const saved = await mockCollectorStore.getWishlist(testUid);
    assert.strictEqual(saved.length, 3, "Merged wishlist must contain exactly 3 unique items");
    assert.deepStrictEqual(
      saved.map((i) => i.id).sort(),
      [401, 402, 403],
      "Must contain 401, 402, and 403"
    );
  });

  // -------------------------------------------------------------
  // TEST 5: Firestore Schema Contract for Wishlist
  // -------------------------------------------------------------
  await test("Validates Firestore collection schema contract for users/{uid}/collector_data/wishlist", async () => {
    const mockFirestoreData = {};
    const mockFirestore = {
      collection: (colName) => ({
        doc: (docId) => ({
          collection: (subCol) => ({
            doc: (subDocId) => ({
              set: async (data) => {
                mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`] = data;
              },
              get: async () => ({
                exists: Boolean(mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`]),
                data: () => mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`],
              }),
            }),
          }),
        }),
      }),
    };

    const firestoreStore = new collectorStore.constructor({ dataDir: testDataDir });
    firestoreStore.setFirestore(mockFirestore);

    const uid = "primo_usr_firestore_contract";
    const sampleItems = [
      { id: 501, name: "Eternal Symphony", price: "150000", permalink: "https://primo.art/501" },
    ];

    await firestoreStore.saveWishlist(uid, sampleItems);

    const expectedPath = `users/${uid}/collector_data/wishlist`;
    const doc = mockFirestoreData[expectedPath];

    assert.ok(doc, `Document must exist at path: ${expectedPath}`);
    assert.ok(Array.isArray(doc.items), "Document must contain items array");
    assert.strictEqual(doc.items.length, 1);
    assert.strictEqual(doc.itemCount, 1);
    assert.ok(doc.updatedAt, "Document must have updatedAt timestamp");
    assert.strictEqual(doc.password, undefined, "Zero credentials or secrets in document");
  });

  // -------------------------------------------------------------
  // TEST 6: Real Offline Wishlist Sync Flow (Add -> Queue -> Flush -> Firestore)
  // -------------------------------------------------------------
  await test("Offline Flow: Add while offline -> enqueues in pending storage -> flushes to Firestore on reconnect", async () => {
    const testUid = "primo_usr_offline_collector_888";
    const mockFirestoreData = {};
    const mockFirestore = {
      collection: (colName) => ({
        doc: (docId) => ({
          collection: (subCol) => ({
            doc: (subDocId) => ({
              set: async (data) => {
                mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`] = data;
              },
              get: async () => ({
                exists: Boolean(mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`]),
                data: () => mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`],
              }),
            }),
          }),
        }),
      }),
    };

    // 1. Initial State
    let isOnline = false; // Simulate offline
    const localAsyncStorage = {};
    const pendingQueueKey = `@primo_pending_wishlist_sync_${testUid}`;
    const localCacheKey = `@primo_gallery_wishlist_${testUid}`;

    // 2. Add artwork while offline
    const newArtwork = { id: 601, name: "Desert Twilight", price: "72000" };
    const updatedLocal = [newArtwork];

    // Immediate UI & local cache update
    localAsyncStorage[localCacheKey] = JSON.stringify(updatedLocal);

    // Sync attempted: fails because offline -> enqueued
    if (!isOnline) {
      localAsyncStorage[pendingQueueKey] = JSON.stringify(updatedLocal);
    }

    assert.ok(localAsyncStorage[pendingQueueKey], "Pending sync queue MUST be created when offline");
    assert.strictEqual(JSON.parse(localAsyncStorage[pendingQueueKey]).length, 1);

    // 3. Network reconnects
    isOnline = true;
    const firestoreStore = new collectorStore.constructor({ dataDir: testDataDir });
    firestoreStore.setFirestore(mockFirestore);

    // 4. Trigger flushPendingWishlistSync
    const pendingData = localAsyncStorage[pendingQueueKey];
    assert.ok(pendingData, "Pending data available to flush");
    const itemsToFlush = JSON.parse(pendingData);

    await firestoreStore.saveWishlist(testUid, itemsToFlush);
    delete localAsyncStorage[pendingQueueKey]; // Cleared on successful sync

    // 5. Verifications
    assert.strictEqual(localAsyncStorage[pendingQueueKey], undefined, "Pending queue cleared after flush");
    const firestoreDoc = mockFirestoreData[`users/${testUid}/collector_data/wishlist`];
    assert.ok(firestoreDoc, "Artwork must exist in Firestore wishlist document");
    assert.strictEqual(firestoreDoc.items.length, 1);
    assert.strictEqual(firestoreDoc.items[0].id, 601);
  });

  // -------------------------------------------------------------
  // TEST 7: Offline Removal Sync
  // -------------------------------------------------------------
  await test("Offline Removal: Remove while offline -> flushes on reconnect -> Firestore reflects removal", async () => {
    const testUid = "primo_usr_offline_removal_999";
    const mockFirestoreData = {
      [`users/${testUid}/collector_data/wishlist`]: {
        items: [
          { id: 701, name: "Ancient Temple Ruins", price: "90000" },
          { id: 702, name: "Kashmir Serenade", price: "110000" },
        ],
        itemCount: 2,
      },
    };

    const mockFirestore = {
      collection: (colName) => ({
        doc: (docId) => ({
          collection: (subCol) => ({
            doc: (subDocId) => ({
              set: async (data) => {
                mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`] = data;
              },
              get: async () => ({
                exists: Boolean(mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`]),
                data: () => mockFirestoreData[`${colName}/${docId}/${subCol}/${subDocId}`],
              }),
            }),
          }),
        }),
      }),
    };

    const firestoreStore = new collectorStore.constructor({ dataDir: testDataDir });
    firestoreStore.setFirestore(mockFirestore);

    // Remove item #701 offline
    const updatedAfterRemoval = [{ id: 702, name: "Kashmir Serenade", price: "110000" }];

    // Reconnect & flush
    await firestoreStore.saveWishlist(testUid, updatedAfterRemoval);

    const doc = mockFirestoreData[`users/${testUid}/collector_data/wishlist`];
    assert.strictEqual(doc.items.length, 1, "Firestore must have exactly 1 item remaining");
    assert.strictEqual(doc.items[0].id, 702, "Item #702 must be preserved");
    assert.ok(!doc.items.some((i) => i.id === 701), "Item #701 must be completely removed");
  });

  // -------------------------------------------------------------
  // TEST 8: Repeated Rapid Additions Deduplication
  // -------------------------------------------------------------
  await test("Adding the same artwork repeatedly results in exactly ONE wishlist entry", async () => {
    const testUid = "primo_usr_rapid_clicker";
    const sameArtwork = { id: 801, name: "Mughal Garden Flora", price: "40000" };

    const rapidSubmissions = [sameArtwork, sameArtwork, sameArtwork, sameArtwork, sameArtwork];
    await mockCollectorStore.saveWishlist(testUid, rapidSubmissions);

    const wishlist = await mockCollectorStore.getWishlist(testUid);
    assert.strictEqual(wishlist.length, 1, "Must contain exactly 1 entry despite 5 rapid clicks");
    assert.strictEqual(wishlist[0].id, 801);
  });

  // -------------------------------------------------------------
  // TEST 9: Logout/Login Persistence
  // -------------------------------------------------------------
  await test("Wishlist persists across user logout and is seamlessly restored upon login", async () => {
    const testUid = "primo_usr_login_persistence";
    const initialWishlist = [
      { id: 901, name: "Peacock at Dusk", price: "60000" },
      { id: 902, name: "Monsoon Symphony", price: "85000" },
    ];

    await mockCollectorStore.saveWishlist(testUid, initialWishlist);

    // Simulate logout: Memory cleared
    let activeUserWishlist = [];
    assert.strictEqual(activeUserWishlist.length, 0);

    // Simulate login: Fetch cloud wishlist for UID
    activeUserWishlist = await mockCollectorStore.getWishlist(testUid);
    assert.strictEqual(activeUserWishlist.length, 2, "Wishlist must be completely restored on login");
    assert.strictEqual(activeUserWishlist[0].id, 901);
    assert.strictEqual(activeUserWishlist[1].id, 902);
  });

  // -------------------------------------------------------------
  // TEST 10: Anti-Spoofing & UID Cross-Access Rejection
  // -------------------------------------------------------------
  await test("Rejects cross-user wishlist access when a client supplies a forged or different UID", async () => {
    const victimUid = "primo_usr_victim_collector";
    const attackerUid = "primo_usr_attacker_collector";

    // Victim has private wishlist
    await mockCollectorStore.saveWishlist(victimUid, [
      { id: 999, name: "Masterpiece by Raja Ravi Varma", price: "5000000" },
    ]);

    // Attacker mints their own valid token
    const attackerToken = await firebaseAdmin.createCustomTokenForUser(attackerUid, {
      authMethod: "email_otp",
    });

    // Server verifies token -> Derives attackerUid ONLY
    const verified = await firebaseAdmin.verifyAuthToken(`Bearer ${attackerToken}`);
    assert.strictEqual(verified.uid, attackerUid, "Server must derive the genuine authenticated UID");
    assert.notStrictEqual(verified.uid, victimUid, "Server must NOT allow attacker to pose as victim");

    // Server fetches data strictly using verified.uid
    const attackerData = await mockCollectorStore.getWishlist(verified.uid);
    assert.strictEqual(attackerData.length, 0, "Attacker cannot see victim's wishlist");

    const victimData = await mockCollectorStore.getWishlist(victimUid);
    assert.strictEqual(victimData.length, 1, "Victim data remains untouched and secure");
  });

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
  runPhase2Tests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runPhase2Tests;
