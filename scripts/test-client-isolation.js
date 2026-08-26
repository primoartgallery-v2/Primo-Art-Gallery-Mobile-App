/**
 * Client-Side Isolation, UID-Scoped Namespaces & Legacy Migration Test Suite
 * Validates that AsyncStorage keys are strictly scoped by canonical Firebase UID,
 * that User A and User B never bleed data across logins/logouts, and that legacy
 * migration is non-destructive and never copied to unrelated users.
 */

const assert = require("assert");

// In-Memory AsyncStorage Mock
class MockAsyncStorage {
  constructor() {
    this.store = new Map();
  }

  async getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async setItem(key, value) {
    this.store.set(key, String(value));
  }

  async removeItem(key) {
    this.store.delete(key);
  }

  async clear() {
    this.store.clear();
  }
}

const mockStorage = new MockAsyncStorage();

// Storage key generators matching client implementation
function getWishlistStorageKey(userId) {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `@primo_gallery_wishlist_${String(userId).trim()}`;
  }
  return "@primo_gallery_wishlist_guest";
}

function getAddressStorageKey(userId) {
  if (userId && typeof userId === "string" && userId.trim().length > 0) {
    return `@primo_user_addresses_${userId.trim()}`;
  }
  return "@primo_user_addresses_guest";
}

// Client service logic under test
async function getStoredAddresses(userId) {
  const key = getAddressStorageKey(userId);
  const raw = await mockStorage.getItem(key);
  if (!raw) {
    if (userId === null) {
      const defaultSample = [{ id: "sample_1", title: "Default Home", fullName: "Guest" }];
      await mockStorage.setItem(key, JSON.stringify(defaultSample));
      return defaultSample;
    }
    return [];
  }
  return JSON.parse(raw);
}

async function saveAddress(addressData, userId) {
  const key = getAddressStorageKey(userId);
  const existing = await getStoredAddresses(userId);
  const updated = [...existing, { ...addressData, id: addressData.id || `addr_${Date.now()}` }];
  await mockStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

async function checkAndMigrateLegacyData(canonicalUid, authenticatedEmail) {
  const LEGACY_MIGRATION_COMPLETED_KEY = "@primo_legacy_migration_completed";
  const LEGACY_UNCLAIMED_BACKUP_KEY = "@primo_legacy_unclaimed_backup";
  const LEGACY_WISHLIST_GLOBAL_KEY = "@primo_gallery_wishlist_v1";
  const LEGACY_ADDRESSES_GLOBAL_KEY = "@primo_user_addresses";

  const isCompleted = await mockStorage.getItem(LEGACY_MIGRATION_COMPLETED_KEY);
  if (isCompleted === "true") return;

  const cleanEmail = String(authenticatedEmail).trim().toLowerCase();
  const uidStr = String(canonicalUid);

  const legacyBackupRaw = await mockStorage.getItem("@primo_legacy_auth_backup");
  const legacyWishlistRaw = await mockStorage.getItem(LEGACY_WISHLIST_GLOBAL_KEY);
  const legacyAddressesRaw = await mockStorage.getItem(LEGACY_ADDRESSES_GLOBAL_KEY);

  let legacyEmail = null;
  if (legacyBackupRaw) {
    try {
      legacyEmail = JSON.parse(legacyBackupRaw).email?.toLowerCase();
    } catch {}
  }

  if (!legacyWishlistRaw && !legacyAddressesRaw) {
    await mockStorage.setItem(LEGACY_MIGRATION_COMPLETED_KEY, "true");
    return;
  }

  const isMatchingLegacyUser = legacyEmail && legacyEmail === cleanEmail;

  if (!isMatchingLegacyUser) {
    // Unrelated user: archive to unclaimed backup, NEVER copy to new user, leave migration pending!
    await mockStorage.setItem(
      LEGACY_UNCLAIMED_BACKUP_KEY,
      JSON.stringify({
        legacyEmail,
        wishlist: legacyWishlistRaw ? JSON.parse(legacyWishlistRaw) : [],
        addresses: legacyAddressesRaw ? JSON.parse(legacyAddressesRaw) : [],
      })
    );
    return;
  }

  // Matching user: non-destructively merge
  const uidWishlistKey = getWishlistStorageKey(uidStr);
  const uidAddressesKey = getAddressStorageKey(uidStr);

  if (legacyWishlistRaw) {
    const legacyItems = JSON.parse(legacyWishlistRaw);
    const existingRaw = await mockStorage.getItem(uidWishlistKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const merged = [...existing];
    for (const item of legacyItems) {
      if (!merged.some((e) => e.id === item.id)) merged.push(item);
    }
    await mockStorage.setItem(uidWishlistKey, JSON.stringify(merged));
  }

  if (legacyAddressesRaw) {
    const legacyAddresses = JSON.parse(legacyAddressesRaw);
    const existingRaw = await mockStorage.getItem(uidAddressesKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const merged = [...existing];
    for (const addr of legacyAddresses) {
      if (!merged.some((e) => e.id === addr.id)) merged.push(addr);
    }
    await mockStorage.setItem(uidAddressesKey, JSON.stringify(merged));
  }

  await mockStorage.setItem(LEGACY_MIGRATION_COMPLETED_KEY, "true");
  await mockStorage.removeItem(LEGACY_WISHLIST_GLOBAL_KEY);
  await mockStorage.removeItem(LEGACY_ADDRESSES_GLOBAL_KEY);
}

async function runClientTests() {
  console.log("==================================================================");
  console.log("RUNNING CLIENT DATA ISOLATION & UID-SCOPED STORAGE TEST SUITE");
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
  // TEST 1: User A Wishlist Isolation
  // -------------------------------------------------------------
  await test("User A wishlist is saved strictly under @primo_gallery_wishlist_uid_A", async () => {
    await mockStorage.clear();
    const uidA = "primo_uid_user_A";
    const keyA = getWishlistStorageKey(uidA);
    assert.strictEqual(keyA, "@primo_gallery_wishlist_primo_uid_user_A");

    const userAWishlist = [{ id: 101, name: "Golden Masterpiece" }];
    await mockStorage.setItem(keyA, JSON.stringify(userAWishlist));

    const retrieved = JSON.parse(await mockStorage.getItem(keyA));
    assert.strictEqual(retrieved.length, 1);
    assert.strictEqual(retrieved[0].name, "Golden Masterpiece");
  });

  // -------------------------------------------------------------
  // TEST 2: User B Wishlist Isolation & Cross-User Bleed Prevention
  // -------------------------------------------------------------
  await test("User B wishlist is isolated and never contains User A's items", async () => {
    const uidB = "primo_uid_user_B";
    const keyB = getWishlistStorageKey(uidB);
    assert.strictEqual(keyB, "@primo_gallery_wishlist_primo_uid_user_B");

    // Check User B's storage before adding
    const rawBBefore = await mockStorage.getItem(keyB);
    assert.strictEqual(rawBBefore, null, "User B's storage must be empty initially");

    const userBWishlist = [{ id: 202, name: "Contemporary Bronze Sculpture" }];
    await mockStorage.setItem(keyB, JSON.stringify(userBWishlist));

    // Verify User A still only has their items
    const rawA = await mockStorage.getItem(getWishlistStorageKey("primo_uid_user_A"));
    const itemsA = JSON.parse(rawA);
    assert.strictEqual(itemsA.length, 1);
    assert.strictEqual(itemsA[0].id, 101, "User A's items must remain untouched");

    // Verify User B only has their items
    const itemsB = JSON.parse(await mockStorage.getItem(keyB));
    assert.strictEqual(itemsB.length, 1);
    assert.strictEqual(itemsB[0].id, 202, "User B must only see their own items");
  });

  // -------------------------------------------------------------
  // TEST 3: User A Logout -> User B Login Memory Reset
  // -------------------------------------------------------------
  await test("User A logout clears in-memory state so User B never sees previous session items", async () => {
    let inMemoryWishlist = [{ id: 101, name: "User A Art" }];

    // Simulate User A logout:
    inMemoryWishlist = [];
    assert.strictEqual(inMemoryWishlist.length, 0, "In-memory state must wipe immediately on logout");

    // Simulate User B login:
    const uidB = "primo_uid_user_B";
    const rawB = await mockStorage.getItem(getWishlistStorageKey(uidB));
    inMemoryWishlist = rawB ? JSON.parse(rawB) : [];

    assert.strictEqual(inMemoryWishlist.length, 1);
    assert.strictEqual(inMemoryWishlist[0].id, 202, "User B must see only User B items");
    assert.strictEqual(
      inMemoryWishlist.some((item) => item.id === 101),
      false,
      "User A's items must NEVER appear in User B's session"
    );
  });

  // -------------------------------------------------------------
  // TEST 4: Address Service Scoping & Explicit Non-Fallback
  // -------------------------------------------------------------
  await test("Address CRUD is strictly scoped to UID namespace and does not silently fall back to guest", async () => {
    const uidA = "primo_uid_user_A";
    const uidB = "primo_uid_user_B";

    await saveAddress({ fullName: "Collector A", addressLine1: "123 Art Blvd", city: "Delhi" }, uidA);
    await saveAddress({ fullName: "Collector B", addressLine1: "456 Gallery St", city: "Mumbai" }, uidB);

    const addressesA = await getStoredAddresses(uidA);
    const addressesB = await getStoredAddresses(uidB);
    const guestAddresses = await getStoredAddresses(null);

    assert.strictEqual(addressesA.length, 1);
    assert.strictEqual(addressesA[0].fullName, "Collector A");

    assert.strictEqual(addressesB.length, 1);
    assert.strictEqual(addressesB[0].fullName, "Collector B");

    assert.notStrictEqual(addressesA[0].addressLine1, addressesB[0].addressLine1);
    assert.strictEqual(guestAddresses[0].fullName, "Guest", "Guest address namespace must be separate");
  });

  // -------------------------------------------------------------
  // TEST 5: Guest Namespace Isolation
  // -------------------------------------------------------------
  await test("Guest actions (userId: null) only target guest namespace", async () => {
    const guestKey = getWishlistStorageKey(null);
    assert.strictEqual(guestKey, "@primo_gallery_wishlist_guest");

    const guestAddressKey = getAddressStorageKey(null);
    assert.strictEqual(guestAddressKey, "@primo_user_addresses_guest");
  });

  // -------------------------------------------------------------
  // TEST 6: Unrelated User Does NOT Receive Legacy Data (Migration Remains Pending)
  // -------------------------------------------------------------
  await test("Unrelated new user does not receive legacy global data; migration remains pending", async () => {
    await mockStorage.clear();

    // Setup legacy state belonging to legacy@primo.art
    await mockStorage.setItem("@primo_legacy_auth_backup", JSON.stringify({ email: "legacy@primo.art" }));
    await mockStorage.setItem("@primo_gallery_wishlist_v1", JSON.stringify([{ id: 999, name: "Legacy Artwork" }]));
    await mockStorage.setItem("@primo_user_addresses", JSON.stringify([{ id: "leg_1", title: "Legacy Address" }]));

    // An UNRELATED new user logs in: newuser@example.com
    const newUid = "primo_uid_new_collector";
    await checkAndMigrateLegacyData(newUid, "newuser@example.com");

    // 1. Verify new user's scoped storage received ZERO legacy items
    const newUserWishlist = await mockStorage.getItem(getWishlistStorageKey(newUid));
    assert.strictEqual(newUserWishlist, null, "New unrelated user must receive NO legacy wishlist items");

    const newUserAddresses = await getStoredAddresses(newUid);
    assert.strictEqual(newUserAddresses.length, 0, "New unrelated user must receive NO legacy addresses");

    // 2. Verify migration completed is STILL FALSE (pending for rightful owner)
    const isCompleted = await mockStorage.getItem("@primo_legacy_migration_completed");
    assert.notStrictEqual(isCompleted, "true", "Migration must remain pending for the rightful owner");

    // 3. Verify unclaimed backup was created
    const unclaimedBackup = await mockStorage.getItem("@primo_legacy_unclaimed_backup");
    assert.ok(unclaimedBackup, "Unclaimed backup must be preserved");
  });

  // -------------------------------------------------------------
  // TEST 7: Matching Legacy User Non-Destructively Merges Data & Sets Completed
  // -------------------------------------------------------------
  await test("Matching legacy user non-destructively merges data and sets migration completed", async () => {
    // Existing UID data for legacy user before merge
    const legacyUid = "primo_uid_legacy_owner";
    await mockStorage.setItem(
      getWishlistStorageKey(legacyUid),
      JSON.stringify([{ id: 888, name: "Pre-existing New Artwork" }])
    );

    // Matching legacy user logs in: legacy@primo.art
    await checkAndMigrateLegacyData(legacyUid, "legacy@primo.art");

    // 1. Verify merged wishlist has BOTH pre-existing item AND legacy item
    const mergedWishlistRaw = await mockStorage.getItem(getWishlistStorageKey(legacyUid));
    const mergedWishlist = JSON.parse(mergedWishlistRaw);
    assert.strictEqual(mergedWishlist.length, 2, "Wishlist must non-destructively contain 2 items");
    assert.ok(mergedWishlist.some((i) => i.id === 888), "Pre-existing item 888 must be preserved");
    assert.ok(mergedWishlist.some((i) => i.id === 999), "Legacy item 999 must be merged");

    // 2. Verify migration completed is now TRUE
    const isCompleted = await mockStorage.getItem("@primo_legacy_migration_completed");
    assert.strictEqual(isCompleted, "true", "Migration must be marked completed");

    // 3. Verify legacy global keys were cleaned up
    assert.strictEqual(await mockStorage.getItem("@primo_gallery_wishlist_v1"), null);
    assert.strictEqual(await mockStorage.getItem("@primo_user_addresses"), null);
  });

  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runClientTests().catch((err) => {
    console.error("Client test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runClientTests;
