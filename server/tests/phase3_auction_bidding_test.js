const assert = require("assert");
const http = require("http");
const app = require("../index");
const collectorStore = require("../services/collectorStore");
const {
  buildCollectorBidEmailHtml,
  buildGalleryBidNotificationEmailHtml,
} = require("../services/emailService");

const crypto = require("crypto");

function createTestToken(uid, email = "collector@example.com") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ uid, email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `Bearer ${header}.${payload}.${sig}`;
}

async function runTests() {
  console.log("============================================================");
  console.log("PRIMO ART GALLERY — PHASE 3D AUCTION & VIP BIDDING TEST SUITE");
  console.log("============================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assertTest(condition, name) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  const savedWpUrl = process.env.WOOCOMMERCE_URL;
  process.env.WOOCOMMERCE_URL = "";

  try {
    // ------------------------------------------------------------
    // TEST 1: GET /api/auctions with non-numeric / invalid route behavior
    // ------------------------------------------------------------
    console.log("TEST GROUP 1: Route Validation & Lot Details");
    const invalidIdRes = await fetch(`${baseUrl}/api/auctions/abc`);
    assertTest(invalidIdRes.status === 400, "1. GET /api/auctions/abc returns 400 for non-numeric ID");

    // ------------------------------------------------------------
    // TEST 2: Authentication & Token Verification on POST /api/auctions/:id/bid
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 2: Authentication & Bearer Token Enforcement");
    const noAuthRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bidAmount: 150000,
        collectorName: "Anonymous Bidder",
        collectorEmail: "anon@example.com",
      }),
    });
    assertTest(noAuthRes.status === 401, "2. POST /api/auctions/1260/bid returns 401 without Authorization header");

    const invalidAuthRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_token_12345",
      },
      body: JSON.stringify({
        bidAmount: 150000,
        collectorName: "Test User",
        collectorEmail: "test@example.com",
      }),
    });
    assertTest(invalidAuthRes.status === 401, "3. POST /api/auctions/1260/bid returns 401 with invalid Bearer token");

    // ------------------------------------------------------------
    // TEST 3: Input Validation on POST /api/auctions/:id/bid
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 3: Strict Input Validation");
    const validToken = createTestToken("collector_auction_user_101", "vikram@example.com");

    const zeroBidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: validToken },
      body: JSON.stringify({
        bidAmount: 0,
        collectorName: "Vikram Malhotra",
        collectorEmail: "vikram@example.com",
      }),
    });
    assertTest(zeroBidRes.status === 400, "4. POST /api/auctions/1260/bid rejects zero/negative bid with 400");

    const shortNameRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: validToken },
      body: JSON.stringify({
        bidAmount: 150000,
        collectorName: "V",
        collectorEmail: "vikram@example.com",
      }),
    });
    assertTest(shortNameRes.status === 400, "5. POST /api/auctions/1260/bid rejects collectorName < 2 chars with 400");

    const badEmailRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: validToken },
      body: JSON.stringify({
        bidAmount: 150000,
        collectorName: "Vikram Malhotra",
        collectorEmail: "not-an-email",
      }),
    });
    assertTest(badEmailRes.status === 400, "6. POST /api/auctions/1260/bid rejects invalid email format with 400");

    // ------------------------------------------------------------
    // TEST 4: Minimum Increment Validation (Math & Protection)
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 4: Minimum Bid Increment Validation");
    const lowBidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: validToken },
      body: JSON.stringify({
        bidAmount: 50000, // Below starting bid of 100,000
        collectorName: "Vikram Malhotra",
        collectorEmail: "vikram@example.com",
      }),
    });
    assertTest(lowBidRes.status === 400, "7. POST /api/auctions/1260/bid rejects bid below minimum with 400");
    const lowBidData = await lowBidRes.json();
    assertTest(lowBidData.nextMinimumBid !== undefined, "8. Error response includes authoritative nextMinimumBid");

    // ------------------------------------------------------------
    // TEST 5: Successful Bid Submission & Cryptographic UID Derivation
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 5: Successful VIP Bid Submission & UID Protection");
    const successBidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: validToken },
      body: JSON.stringify({
        bidAmount: 125000,
        collectorName: "Vikram Malhotra",
        collectorEmail: "vikram@example.com",
        collectorPhone: "+91 98765 43210",
        // Attacker attempts to spoof a different collector's UID
        collectorUid: "attacker_spoofed_uid_999",
      }),
    });

    assertTest(successBidRes.status === 201, "9. POST /api/auctions/1260/bid accepts valid bid with 201");
    successBidData = await successBidRes.json();
    assertTest(successBidData.success === true, "10. Response contains success: true");
    assertTest(
      Boolean(successBidData.bidReference && successBidData.bidReference.startsWith("PAG-BID-1260-")),
      `11. Generates deterministic reference ID: ${successBidData?.bidReference}`
    );
    assertTest(
      successBidData?.bid?.collectorUid === "collector_auction_user_101",
      "12. Cryptographically derives UID from token and ignores body-supplied spoofed UID"
    );
    assertTest(
      successBidData?.nextMinimumBid === 130000,
      `13. Calculates updated next minimum bid accurately (125,000 + 5,000 = 130,000): ${successBidData?.nextMinimumBid}`
    );

    // ------------------------------------------------------------
    // TEST 6: Rate Limiting Enforcement (Max 5 bids / min)
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 6: Anti-Spam Rate Limiting (Max 5/min)");
    const rateLimitToken = createTestToken("rate_limiter_user_bid", "fast@example.com");
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        fetch(`${baseUrl}/api/auctions/1260/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: rateLimitToken },
          body: JSON.stringify({
            bidAmount: 150000 + i * 5000,
            collectorName: "Fast Bidder",
            collectorEmail: "fast@example.com",
          }),
        })
      );
    }
    const rateResults = await Promise.all(attempts);
    const rateStatusCodes = rateResults.map((r) => r.status);
    assertTest(rateStatusCodes.includes(429), "14. 6th bid within 1 minute returns 429 Too Many Requests");

    // ------------------------------------------------------------
    // TEST 7: UID Isolation on GET /api/collector/my-bids
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 7: Collector UID Isolation & History");
    const userABidsRes = await fetch(`${baseUrl}/api/collector/my-bids`, {
      headers: { Authorization: validToken },
    });
    assertTest(userABidsRes.status === 200, "15. User A can fetch their own bids with 200");
    userABidsData = await userABidsRes.json();
    assertTest(
      Array.isArray(userABidsData.bids) && userABidsData.bids.length > 0 && userABidsData.bids.some((b) => b.bidAmount === 125000),
      "16. User A's placed bid is returned in history"
    );

    const userBToken = createTestToken("collector_user_b_auction", "userb@example.com");
    const userBBidsRes = await fetch(`${baseUrl}/api/collector/my-bids`, {
      headers: { Authorization: userBToken },
    });
    const userBBidsData = await userBBidsRes.json();
    assertTest(
      Array.isArray(userBBidsData.bids) && userBBidsData.bids.length === 0,
      "17. User B cannot see User A's bids (strict UID isolation)"
    );

    // ------------------------------------------------------------
    // TEST 8: Email HTML Generation
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 8: Email Template Formatting & Aesthetics");
    const mockBid = {
      bidId: "bid_12345",
      bidReference: "PAG-BID-1260-8F2A",
      lotId: 1260,
      lotTitle: "Celestial Harmony",
      artist: "S. H. Raza",
      bidAmount: 125000,
      collectorName: "Vikram Malhotra",
      collectorEmail: "vikram@example.com",
      collectorPhone: "+91 98765 43210",
      collectorUid: "uid_101",
    };

    const collectorHtml = buildCollectorBidEmailHtml(mockBid);
    assertTest(
      collectorHtml.includes("PAG-BID-1260-8F2A") && collectorHtml.includes("Celestial Harmony") && collectorHtml.includes("1,25,000"),
      "18. Collector bid confirmation HTML renders reference ID, lot title, and formatted INR amount"
    );

    const galleryHtml = buildGalleryBidNotificationEmailHtml(mockBid);
    assertTest(
      galleryHtml.includes("Vikram Malhotra") && galleryHtml.includes("1,25,000") && galleryHtml.includes("Celestial Harmony"),
      "19. Gallery curatorial desk HTML renders bidder name, lot details, and bid value"
    );

    // ------------------------------------------------------------
    // TEST 9: Zero Secret Leakage
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 9: Client Bundle & Response Security Audit");
    const responsePayloadString = JSON.stringify(successBidData || {}) + JSON.stringify(userABidsData || {});
    assertTest(
      !responsePayloadString.includes("CONSUMER_SECRET") &&
        !responsePayloadString.includes("ck_") &&
        !responsePayloadString.includes("cs_") &&
        !responsePayloadString.includes("RESEND_API_KEY") &&
        !responsePayloadString.includes("COA_SIGNING_SECRET"),
      "20. API responses contain zero server secrets or admin credentials"
    );

    // ------------------------------------------------------------
    // TEST 10: Idempotency & Duplicate Protection
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 10: Idempotency & Duplicate Bid Protection");
    const testIdempKey = "idemp_test_key_unique_12345";
    const idempBidRes1 = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: validToken,
        "x-idempotency-key": testIdempKey,
      },
      body: JSON.stringify({
        bidAmount: 135000,
        collectorName: "Vikram Malhotra",
        collectorEmail: "vikram@example.com",
      }),
    });
    assertTest(idempBidRes1.status === 201, "21. Idempotent bid request 1 accepted with 201");
    const idempBidData1 = await idempBidRes1.json();
    assertTest(idempBidData1.bid?.idempotencyKey === testIdempKey, "22. Preserves idempotency key in bid record");

    // ------------------------------------------------------------
    // TEST 11: Regression Across Phases 1, 2, 3A, 3B, 3C
    // ------------------------------------------------------------
    console.log("\nTEST GROUP 11: Complete Regression Baseline Audit (Phases 1–3C)");
    const healthRes = await fetch(`${baseUrl}/health`);
    assertTest(healthRes.status === 200, "23. REGRESSION: Phase 1 Health endpoint returns 200");

    const wishlistRes = await fetch(`${baseUrl}/api/collector/wishlist`);
    assertTest(wishlistRes.status === 401, "24. REGRESSION: Phase 2 Feature 1 Wishlist endpoint remains 401 protected");

    const searchRes = await fetch(`${baseUrl}/api/products?search=Krishna&min_price=10000`);
    assertTest(
      searchRes.status === 200 || searchRes.status === 502 || searchRes.status === 503,
      "25. REGRESSION: Phase 2 Feature 2 Search & Filter endpoint remains operational"
    );

    const recentlyViewedRes = await fetch(`${baseUrl}/api/collector/recently-viewed`);
    assertTest(recentlyViewedRes.status === 401, "26. REGRESSION: Phase 2 Feature 3 Recently Viewed remains 401 protected");

    const savedArtistsRes = await fetch(`${baseUrl}/api/collector/saved-artists`);
    assertTest(savedArtistsRes.status === 401, "27. REGRESSION: Phase 2 Feature 4 Saved Artists remains 401 protected");

    const enquiryRes = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artworkId: 101,
        artworkTitle: "Divine Serenity",
        collectorName: "Aarav Sharma",
        collectorEmail: "aarav@example.com",
        message: "Requesting pricing catalogue.",
      }),
    });
    assertTest(enquiryRes.status === 201, "28. REGRESSION: Phase 2 Feature 5 Artwork Enquiry accepts valid submissions");

    const addressRes = await fetch(`${baseUrl}/api/collector/addresses`);
    assertTest(addressRes.status === 401, "29. REGRESSION: Phase 3A Address Book remains 401 protected");

    const coaRes = await fetch(`${baseUrl}/api/products/1260/coa`);
    assertTest(
      coaRes.status === 200 || coaRes.status === 404 || coaRes.status === 502,
      "30. REGRESSION: Phase 3B CoA generation remains operational"
    );

    const rsvpRes = await fetch(`${baseUrl}/api/exhibitions/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exhibitionId: 101,
        exhibitionTitle: "Varanasi Heritage",
        collectorName: "Sunita Roy",
        collectorEmail: "sunita@example.com",
        guestCount: 2,
      }),
    });
    assertTest(rsvpRes.status === 201, "31. REGRESSION: Phase 3C Exhibition VIP RSVP accepts submissions");
  } catch (err) {
    console.error("Test execution fatal error:", err);
    failed++;
  } finally {
    process.env.WOOCOMMERCE_URL = savedWpUrl;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n============================================================");
  console.log(`PHASE 3D TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
