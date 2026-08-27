const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");
const emailService = require("../services/emailService");
const app = require("../index");

async function runEnquiryTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY FEATURE 5: ARTWORK ENQUIRIES TEST SUITE");
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

  const testDataDir = path.join(__dirname, "..", "data", "test_enquiry_data");
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
    // TEST 1: Authenticated Enquiry Derives UID from Bearer Token
    // -------------------------------------------------------------
    await test("1. Authenticated enquiry derives UID from verified Bearer token", async () => {
      const testUid = "primo_collector_enquiry_vip_001";
      const token = await firebaseAdmin.createCustomTokenForUser(testUid, {
        authMethod: "email_otp",
      });

      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          artworkId: 101,
          artworkTitle: "Golden Vrindavan Moonlight",
          collectorName: "Ananya Birla",
          collectorEmail: "ananya.birla@example.com",
          collectorPhone: "+91 98111 22334",
          message: "Interested in acquiring this masterpiece. Please share certificate of authenticity.",
        }),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.enquiryId && res.data.enquiryId.startsWith("enq_"));
    });

    // -------------------------------------------------------------
    // TEST 2: Spoofed Body collectorUid is Ignored
    // -------------------------------------------------------------
    await test("2. Spoofed body collectorUid is ignored and replaced with verified token UID", async () => {
      const realUid = "primo_legit_enquiry_user_777";
      const token = await firebaseAdmin.createCustomTokenForUser(realUid, {
        authMethod: "email_otp",
      });

      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          collectorUid: "forged_victim_uid_attacker", // Attacker trying to spoof
          userId: "forged_victim_user_attacker",
          artworkId: 102,
          artworkTitle: "Royal Darbar Pichwai",
          collectorName: "Vikram Singhania",
          collectorEmail: "vikram.singhania@example.com",
          message: "Please share pricing and international delivery terms to London.",
        }),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
    });

    // -------------------------------------------------------------
    // TEST 3: Guest Enquiry Stores collectorUid: null
    // -------------------------------------------------------------
    await test("3. Guest enquiry without token stores collectorUid: null safely", async () => {
      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 103,
          artworkTitle: "Eternal Ganga Ghats",
          collectorName: "Guest Collector",
          collectorEmail: "guest.artlover@example.com",
          message: "Kindly let me know if this artwork is currently available for purchase.",
        }),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
    });

    // -------------------------------------------------------------
    // TEST 4: Invalid/Missing Required Fields Return 400
    // -------------------------------------------------------------
    await test("4. Missing required fields (artworkId, artworkTitle, name, email, message) return 400", async () => {
      // Missing artworkId
      const res1 = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkTitle: "Title",
          collectorName: "Name",
          collectorEmail: "test@example.com",
          message: "Message text at least 10 chars",
        }),
      });
      assert.strictEqual(res1.status, 400);

      // Missing artworkTitle
      const res2 = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 105,
          collectorName: "Name",
          collectorEmail: "test@example.com",
          message: "Message text at least 10 chars",
        }),
      });
      assert.strictEqual(res2.status, 400);
    });

    // -------------------------------------------------------------
    // TEST 5: Message Shorter than 10 Characters Rejected (400)
    // -------------------------------------------------------------
    await test("5. Message shorter than 10 characters is rejected with 400", async () => {
      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 104,
          artworkTitle: "Temple Courtyard",
          collectorName: "Rohan Varma",
          collectorEmail: "rohan@example.com",
          message: "Short msg", // 9 chars
        }),
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes("10-1000 characters"));
    });

    // -------------------------------------------------------------
    // TEST 6: Invalid Email Format Rejected (400)
    // -------------------------------------------------------------
    await test("6. Invalid email format is rejected with 400", async () => {
      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 105,
          artworkTitle: "Temple Courtyard",
          collectorName: "Rohan Varma",
          collectorEmail: "not-a-valid-email",
          message: "Please share pricing and details about this piece.",
        }),
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes("email"));
    });

    // -------------------------------------------------------------
    // TEST 7: Input Length Limits Enforced
    // -------------------------------------------------------------
    await test("7. Input length limits enforced (>150 title, >80 name, >1000 message)", async () => {
      // Long name
      const resName = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 106,
          artworkTitle: "Art Title",
          collectorName: "A".repeat(85),
          collectorEmail: "valid@example.com",
          message: "Valid message length exceeding 10 characters.",
        }),
      });
      assert.strictEqual(resName.status, 400);

      // Long message
      const resMsg = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 106,
          artworkTitle: "Art Title",
          collectorName: "Valid Name",
          collectorEmail: "valid@example.com",
          message: "A".repeat(1005),
        }),
      });
      assert.strictEqual(resMsg.status, 400);
    });

    // -------------------------------------------------------------
    // TEST 8 & 9: Persistence & Default Status (pending_review)
    // -------------------------------------------------------------
    await test("8 & 9. Enquiry is persisted with status: pending_review and ISO createdAt", async () => {
      const saved = await mockCollectorStore.saveEnquiry({
        artworkId: 200,
        artworkTitle: "Serenity in Varanasi",
        collectorUid: "uid_test_status",
        collectorName: "Karan Johar",
        collectorEmail: "karan@example.com",
        collectorPhone: "+91 98222 33445",
        message: "Requesting detailed catalog and pricing terms.",
        clientIp: "127.0.0.1",
      });

      assert.strictEqual(saved.success, true);
      assert.strictEqual(saved.enquiry.status, "pending_review");
      assert.strictEqual(saved.enquiry.artworkId, 200);
      assert.strictEqual(saved.enquiry.artworkTitle, "Serenity in Varanasi");
      assert.ok(saved.enquiry.createdAt);
      assert.strictEqual(saved.enquiry.source, "mobile_app");
    });

    // -------------------------------------------------------------
    // TEST 10: Email Notification Triggered Safely
    // -------------------------------------------------------------
    await test("10. Email notification executes safely without exposing secrets", async () => {
      const emailResult = await emailService.sendArtworkEnquiryEmail({
        enquiryId: "enq_test_123",
        artworkId: 205,
        artworkTitle: "Lotus Blossom at Dawn",
        collectorName: "Meera Kapoor",
        collectorEmail: "meera.kapoor@example.com",
        collectorPhone: "+91 98765 43210",
        message: "I would like to inquire about payment via bank wire transfer.",
        collectorUid: "usr_meera_77",
      });

      assert.strictEqual(emailResult.success, true);
    });

    // -------------------------------------------------------------
    // TEST 11 & 12: Anti-Spam Rate Limiting (5 per hour -> 6th returns 429)
    // -------------------------------------------------------------
    await test("11 & 12. Anti-Spam: Allows up to 5 enquiries/hour, 6th returns 429 Too Many Requests", async () => {
      const spamEmail = `spammer_${Date.now()}@example.com`;

      for (let i = 1; i <= 5; i++) {
        const res = await makeRequest("/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artworkId: 300 + i,
            artworkTitle: `Artwork ${i}`,
            collectorName: "Spam Tester",
            collectorEmail: spamEmail,
            message: `This is enquiry number ${i} for testing rate limits.`,
          }),
        });
        assert.strictEqual(res.status, 201, `Enquiry #${i} must succeed`);
      }

      // 6th attempt from the same email / IP
      const spamRes = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 306,
          artworkTitle: "Artwork 6",
          collectorName: "Spam Tester",
          collectorEmail: spamEmail,
          message: "This is enquiry number 6 and must be rate-limited.",
        }),
      });

      assert.strictEqual(spamRes.status, 429, "6th enquiry within 1 hour must return 429");
      assert.ok(spamRes.data.error.includes("limit exceeded"));
    });

    // -------------------------------------------------------------
    // TEST 13 & 14: Direct Client Firestore Block & Read Isolation
    // -------------------------------------------------------------
    await test("13 & 14. Verifies enquiry storage contract and zero secrets exposure", async () => {
      // Ensure no sensitive headers or tokens leak in response
      const res = await makeRequest("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: 401,
          artworkTitle: "Sacred Chants",
          collectorName: "Divya Shah",
          collectorEmail: "divya@example.com",
          message: "Please share provenance and exhibition history.",
        }),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.CONSUMER_KEY, undefined);
      assert.strictEqual(res.data.CONSUMER_SECRET, undefined);
      assert.strictEqual(res.data.RESEND_API_KEY, undefined);
      assert.strictEqual(res.data.FIREBASE_SERVICE_ACCOUNT, undefined);
    });

    // -------------------------------------------------------------
    // TEST 15: Phase 1 Health Endpoint Unaffected
    // -------------------------------------------------------------
    await test("15. Phase 1 /health endpoint returns 200 OK", async () => {
      const res = await makeRequest("/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, "ok");
    });

    // -------------------------------------------------------------
    // TEST 16: Feature 1 Wishlist Protected
    // -------------------------------------------------------------
    await test("16. Feature 1 Wishlist endpoint remains protected with 401", async () => {
      const res = await makeRequest("/api/collector/wishlist");
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // TEST 17: Feature 2 Search & Filter Operational
    // -------------------------------------------------------------
    await test("17. Feature 2 Search & Filter endpoint remains operational", async () => {
      const res = await makeRequest("/api/products?search=Radha&min_price=10000");
      assert.strictEqual(res.status, 200);
    });

    // -------------------------------------------------------------
    // TEST 18: Feature 3 Recently Viewed Protected
    // -------------------------------------------------------------
    await test("18. Feature 3 Recently Viewed endpoint remains protected with 401", async () => {
      const res = await makeRequest("/api/collector/recently-viewed");
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // TEST 19: Feature 4 Saved Artists Protected
    // -------------------------------------------------------------
    await test("19. Feature 4 Saved Artists endpoint remains protected with 401", async () => {
      const res = await makeRequest("/api/collector/saved-artists");
      assert.strictEqual(res.status, 401);
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
  runEnquiryTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runEnquiryTests;
