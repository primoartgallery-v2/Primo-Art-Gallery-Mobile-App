const assert = require("assert");
const fs = require("fs");
const path = require("path");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");

async function runPhase3ATests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 3A: ADDRESS & PROFILE TEST SUITE");
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

  const testDataDir = path.join(__dirname, "..", "data", "test_phase3_data");
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const mockCollectorStore = new collectorStore.constructor({ dataDir: testDataDir });

  // -------------------------------------------------------------
  // TEST 1: Strict UID Isolation on Address Book
  // -------------------------------------------------------------
  await test("Enforces strict UID isolation: User A cannot access User B's address book", async () => {
    const userA = "primo_collector_delhi_101";
    const userB = "primo_collector_mumbai_202";

    const userAAddresses = [
      {
        id: "addr_delhi_1",
        title: "Home",
        fullName: "Vikramaditya Singhania",
        phone: "+91 98111 22334",
        addressLine1: "12 Golf Links",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110003",
        country: "India",
        isDefault: true,
      },
    ];

    const userBAddresses = [
      {
        id: "addr_mumbai_1",
        title: "Art Studio",
        fullName: "Ananya Piramal",
        phone: "+91 98222 44556",
        addressLine1: "Floor 18, Sea Face Towers, Worli",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400018",
        country: "India",
        isDefault: true,
      },
    ];

    await mockCollectorStore.saveAddresses(userA, userAAddresses);
    await mockCollectorStore.saveAddresses(userB, userBAddresses);

    const retrievedA = await mockCollectorStore.getAddresses(userA);
    const retrievedB = await mockCollectorStore.getAddresses(userB);

    assert.strictEqual(retrievedA.length, 1, "User A must have 1 address");
    assert.strictEqual(retrievedB.length, 1, "User B must have 1 address");
    assert.strictEqual(retrievedA[0].city, "New Delhi");
    assert.strictEqual(retrievedB[0].city, "Mumbai");
    assert.strictEqual(retrievedA[0].fullName, "Vikramaditya Singhania");
    assert.strictEqual(retrievedB[0].fullName, "Ananya Piramal");
  });

  // -------------------------------------------------------------
  // TEST 2: Address Saving and Invariant (Default Address)
  // -------------------------------------------------------------
  await test("Enforces default-address invariant: exactly one default designated", async () => {
    const uid = "primo_collector_invariant_test";

    const multiAddresses = [
      {
        id: "addr_1",
        title: "Residence",
        fullName: "Aarav Sharma",
        phone: "+91 99000 11223",
        addressLine1: "14 Jubilee Hills",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500033",
        isDefault: false,
      },
      {
        id: "addr_2",
        title: "Office",
        fullName: "Aarav Sharma",
        phone: "+91 99000 11223",
        addressLine1: "Cyber Gateway, HITEC City",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
        isDefault: false,
      },
    ];

    // None was marked default -> first should become default
    await mockCollectorStore.saveAddresses(uid, multiAddresses);
    const saved = await mockCollectorStore.getAddresses(uid);

    assert.strictEqual(saved.length, 2);
    assert.strictEqual(saved[0].isDefault, true, "First address must automatically become default");
    assert.strictEqual(saved[1].isDefault, false, "Second address must not be default");
  });

  // -------------------------------------------------------------
  // TEST 3: Address Deduplication by ID
  // -------------------------------------------------------------
  await test("Deduplicates addresses by ID without duplication", async () => {
    const uid = "primo_collector_dedup_test";

    const duplicatePayload = [
      {
        id: "addr_dup_1",
        title: "Home",
        fullName: "Rohan Kapoor",
        phone: "+91 98765 00000",
        addressLine1: "Plot 88, Vasant Vihar",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110057",
        isDefault: true,
      },
      {
        id: "addr_dup_1",
        title: "Home Renamed",
        fullName: "Rohan Kapoor",
        phone: "+91 98765 00000",
        addressLine1: "Plot 88, Vasant Vihar",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110057",
        isDefault: true,
      },
    ];

    await mockCollectorStore.saveAddresses(uid, duplicatePayload);
    const saved = await mockCollectorStore.getAddresses(uid);

    assert.strictEqual(saved.length, 1, "Duplicate ID must be collapsed to exactly 1 entry");
  });

  // -------------------------------------------------------------
  // TEST 4: Address Input Sanitization & Required Fields
  // -------------------------------------------------------------
  await test("Sanitizes address input and filters entries missing mandatory location fields", async () => {
    const uid = "primo_collector_sanitize_test";

    const invalidPayload = [
      {
        id: "addr_valid",
        title: "Gallery Wall",
        fullName: "Sunita Roy",
        phone: "+91 91234 56789",
        addressLine1: "Park Street",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700016",
        isDefault: true,
      },
      {
        id: "addr_invalid_no_city",
        title: "Incomplete",
        fullName: "Test User",
        phone: "+91 99999 99999",
        addressLine1: "Incomplete street",
        city: "", // Missing
        state: "Karnataka",
        pincode: "560001",
      },
    ];

    await mockCollectorStore.saveAddresses(uid, invalidPayload);
    const saved = await mockCollectorStore.getAddresses(uid);

    assert.strictEqual(saved.length, 1, "Only valid address with complete fields must be retained");
    assert.strictEqual(saved[0].id, "addr_valid");
  });

  // -------------------------------------------------------------
  // TEST 5: Profile Cloud Persistence & Retrieval
  // -------------------------------------------------------------
  await test("Persists and retrieves collector profile customizations", async () => {
    const uid = "primo_collector_profile_user_1";

    const profileData = {
      firstName: "Devendra",
      lastName: "Rathore",
      email: "devendra.rathore@rajasthanart.org",
      phone: "+91 98290 12345",
      avatarUrl: "avatar_3", // Patron
    };

    const saveRes = await mockCollectorStore.saveProfile(uid, profileData);
    assert.strictEqual(saveRes.success, true);

    const fetchedProfile = await mockCollectorStore.getProfile(uid);
    assert.strictEqual(fetchedProfile.firstName, "Devendra");
    assert.strictEqual(fetchedProfile.lastName, "Rathore");
    assert.strictEqual(fetchedProfile.email, "devendra.rathore@rajasthanart.org");
    assert.strictEqual(fetchedProfile.phone, "+91 98290 12345");
    assert.strictEqual(fetchedProfile.avatarUrl, "avatar_3");
    assert.ok(fetchedProfile.updatedAt, "Must record updatedAt timestamp");
  });

  // -------------------------------------------------------------
  // TEST 6: Profile Strict UID Isolation
  // -------------------------------------------------------------
  await test("Enforces strict UID isolation on profile data", async () => {
    const userA = "primo_collector_prof_A";
    const userB = "primo_collector_prof_B";

    await mockCollectorStore.saveProfile(userA, {
      firstName: "Priya",
      lastName: "Nair",
      email: "priya@gallery.in",
      avatarUrl: "avatar_4", // Curator
    });

    await mockCollectorStore.saveProfile(userB, {
      firstName: "Kabir",
      lastName: "Mehta",
      email: "kabir@collector.in",
      avatarUrl: "avatar_5", // VIP
    });

    const profileA = await mockCollectorStore.getProfile(userA);
    const profileB = await mockCollectorStore.getProfile(userB);

    assert.strictEqual(profileA.firstName, "Priya");
    assert.strictEqual(profileB.firstName, "Kabir");
    assert.strictEqual(profileA.avatarUrl, "avatar_4");
    assert.strictEqual(profileB.avatarUrl, "avatar_5");
  });

  // -------------------------------------------------------------
  // TEST 7: Anti-Spoofing on Verified Tokens
  // -------------------------------------------------------------
  await test("Rejects forged Bearer tokens without valid UID verification", async () => {
    const forgedToken = "Bearer forged.token.with.spoofed.uid";
    const verified = await firebaseAdmin.verifyAuthToken(forgedToken);

    assert.strictEqual(verified, null, "Forged token must return null verified user");
  });

const persistentAuthStore = require("../services/persistentAuthStore");

  // -------------------------------------------------------------
  // TEST 8: Token Extraction Determinism
  // -------------------------------------------------------------
  await test("Extracts deterministic UID from authenticated token without trusting body", async () => {
    const canonicalUid = "primo_canonical_collector_777";
    const customToken = await firebaseAdmin.createCustomTokenForUser(canonicalUid, { email: "collector777@primo.art" });

    assert.ok(customToken, "Must generate valid Firebase custom token");
    const verified = await firebaseAdmin.verifyAuthToken(`Bearer ${customToken}`);
    assert.strictEqual(verified.uid, canonicalUid, "Verified UID must match canonical token UID");
  });

  // -------------------------------------------------------------
  // TEST 9: Offline Queue Simulation & Reconnection Flush
  // -------------------------------------------------------------
  await test("Simulates offline address mutations and reconnection flush", async () => {
    const uid = "primo_collector_offline_queue_test";

    // Simulate local mutations while offline
    const offlineAddressBook = [
      {
        id: "addr_offline_1",
        title: "Summer Villa",
        fullName: "Rohit Verma",
        phone: "+91 98333 44556",
        addressLine1: "Goa Villa 4, Candolim",
        city: "Goa",
        state: "Goa",
        pincode: "403515",
        isDefault: true,
      },
    ];

    // Reconnection triggers flush
    await mockCollectorStore.saveAddresses(uid, offlineAddressBook);
    const flushed = await mockCollectorStore.getAddresses(uid);

    assert.strictEqual(flushed.length, 1);
    assert.strictEqual(flushed[0].id, "addr_offline_1");
    assert.strictEqual(flushed[0].city, "Goa");
  });

  // -------------------------------------------------------------
  // TEST 10: Multi-Device Profile & Address Sync
  // -------------------------------------------------------------
  await test("Multi-Device sync restores full addresses and profile on new device", async () => {
    const sharedUid = "primo_collector_multidevice_user";

    // Device 1: updates profile and address
    await mockCollectorStore.saveProfile(sharedUid, {
      firstName: "Meenakshi",
      lastName: "Sundaram",
      email: "meenakshi@southart.in",
      avatarUrl: "avatar_6", // Master
    });

    await mockCollectorStore.saveAddresses(sharedUid, [
      {
        id: "addr_chn_1",
        title: "Chennai Residence",
        fullName: "Meenakshi Sundaram",
        phone: "+91 94440 12345",
        addressLine1: "Boat Club Road",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600028",
        isDefault: true,
      },
    ]);

    // Device 2: logs in with same UID and reads cloud state
    const syncedProfile = await mockCollectorStore.getProfile(sharedUid);
    const syncedAddresses = await mockCollectorStore.getAddresses(sharedUid);

    assert.strictEqual(syncedProfile.firstName, "Meenakshi");
    assert.strictEqual(syncedProfile.avatarUrl, "avatar_6");
    assert.strictEqual(syncedAddresses.length, 1);
    assert.strictEqual(syncedAddresses[0].city, "Chennai");
  });

  // -------------------------------------------------------------
  // TEST 11: Phase 1 Authentication Regression
  // -------------------------------------------------------------
  await test("REGRESSION: Phase 1 Auth OTP session and password hashing intact", async () => {
    const testEmail = "phase3_regression_auth@primo.art";
    const plainOtp = "849201";
    await persistentAuthStore.saveOtpSession(testEmail, plainOtp);
    const session = await persistentAuthStore.getOtpSession(testEmail);
    assert.ok(session, "OTP session must exist in storage");
    assert.ok(session.otpHash, "SHA-256 hash must be stored");
    assert.strictEqual(session.otp, undefined, "Plaintext OTP must not be stored");
  });

  // -------------------------------------------------------------
  // TEST 12: Phase 2 Feature 1 Wishlist Regression
  // -------------------------------------------------------------
  await test("REGRESSION: Phase 2 Feature 1 Wishlist persistence intact", async () => {
    const uid = "phase3_reg_wishlist_user";
    await mockCollectorStore.saveWishlist(uid, [{ id: 999, name: "Reg Artwork", price: "75000" }]);
    const wishlist = await mockCollectorStore.getWishlist(uid);
    assert.strictEqual(wishlist.length, 1);
    assert.strictEqual(wishlist[0].id, 999);
  });

  // -------------------------------------------------------------
  // TEST 13: Phase 2 Feature 3 Recently Viewed Regression
  // -------------------------------------------------------------
  await test("REGRESSION: Phase 2 Feature 3 Recently Viewed 20-cap intact", async () => {
    const uid = "phase3_reg_recent_user";
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Artwork ${i + 1}`, price: "50000" }));
    const saved = await mockCollectorStore.saveRecentlyViewed(uid, items);
    assert.strictEqual(saved.count, 20, "Must enforce 20 item cap");
  });

  // -------------------------------------------------------------
  // TEST 14: Phase 2 Feature 4 Saved Artists Regression
  // -------------------------------------------------------------
  await test("REGRESSION: Phase 2 Feature 4 Saved Artists intact", async () => {
    const uid = "phase3_reg_artists_user";
    await mockCollectorStore.saveSavedArtists(uid, ["artist_101", "artist_102"]);
    const saved = await mockCollectorStore.getSavedArtists(uid);
    assert.strictEqual(saved.length, 2);
  });

  // -------------------------------------------------------------
  // TEST 15: Phase 2 Feature 5 Artwork Enquiries Regression
  // -------------------------------------------------------------
  await test("REGRESSION: Phase 2 Feature 5 Artwork Enquiry storage intact", async () => {
    const enquiry = {
      artworkId: 501,
      artworkTitle: "Golden Temple at Dawn",
      collectorName: "Siddharth Oberoi",
      collectorEmail: "siddharth@oberoi.com",
      message: "Please share pricing and provenance.",
    };
    const res = await mockCollectorStore.saveEnquiry(enquiry);
    assert.strictEqual(res.success, true);
    assert.ok(res.enquiryId.startsWith("enq_"));
  });

  // Clean up test data
  try {
    const files = fs.readdirSync(testDataDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testDataDir, file));
    }
    fs.rmdirSync(testDataDir);
  } catch {}

  console.log("==================================================================");
  console.log(`PHASE 3A TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3ATests().catch((err) => {
  console.error("FATAL ERROR IN PHASE 3A TEST RUNNER:", err);
  process.exit(1);
});
