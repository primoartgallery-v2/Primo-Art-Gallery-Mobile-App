const assert = require("assert");
const http = require("http");
const crypto = require("crypto");

function createSignedToken(uid, email = "collector@example.com") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ uid, email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function runPhase3CTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 3C: EXHIBITION VIP RSVP TEST SUITE");
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

  const app = require("../index");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function apiGet(path, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
    });
    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data };
  }

  async function apiPost(path, body = {}, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data };
  }

  // -------------------------------------------------------------
  // TEST 1: Valid Authenticated RSVP
  // -------------------------------------------------------------
  await test("1. Authenticated RSVP derives canonical UID from verified Bearer token", async () => {
    // Generate valid test token for collector_vip_user_1
    const testToken = createSignedToken("collector_vip_user_1", "vip1@example.com");

    const res = await apiPost(
      "/api/exhibitions/rsvp",
      {
        exhibitionId: 1260,
        exhibitionTitle: "The Emerging Perspectives",
        collectorName: "Aarav Singhania",
        collectorEmail: "aarav.singhania@example.com",
        collectorPhone: "+91 98765 43210",
        guestCount: 2,
        message: "Looking forward to curatorial preview.",
      },
      { Authorization: `Bearer ${testToken}` }
    );

    assert.strictEqual(res.status, 201, "Must return 201 Created");
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.passId.startsWith("VIP-EHB-1260-"));
    assert.strictEqual(res.data.pass.collectorUid, "collector_vip_user_1");
    assert.strictEqual(res.data.pass.guestCount, 2);
  });

  // -------------------------------------------------------------
  // TEST 2: Body UID Spoofing Prevention
  // -------------------------------------------------------------
  await test("2. Rejects/ignores spoofed collectorUid in request body and enforces verified token UID", async () => {
    const testToken = createSignedToken("auth_user_888", "user888@example.com");

    const res = await apiPost(
      "/api/exhibitions/rsvp",
      {
        exhibitionId: 1260,
        collectorUid: "FORGED_ADMIN_UID_VICTIM_999",
        collectorName: "Spoof Attacker",
        collectorEmail: "attacker@example.com",
        guestCount: 1,
      },
      { Authorization: `Bearer ${testToken}` }
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(
      res.data.pass.collectorUid,
      "auth_user_888",
      "Must use verified token UID and ignore forged body UID"
    );
  });

  // -------------------------------------------------------------
  // TEST 3: Guest RSVP without Token
  // -------------------------------------------------------------
  await test("3. Guest RSVP without token successfully records with collectorUid: null", async () => {
    const res = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Guest Collector",
      collectorEmail: "guest.collector@example.com",
      guestCount: 3,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.pass.collectorUid, null);
    assert.strictEqual(res.data.pass.guestCount, 3);
  });

  // -------------------------------------------------------------
  // TEST 4: Guest Count 1–4 Validation
  // -------------------------------------------------------------
  await test("4. Strictly enforces guest count between 1 and 4", async () => {
    // Zero guests -> 400
    const resZero = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Valid Name",
      collectorEmail: "valid1@example.com",
      guestCount: 0,
    });
    assert.strictEqual(resZero.status, 400);

    // Five guests -> 400
    const resFive = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Valid Name",
      collectorEmail: "valid2@example.com",
      guestCount: 5,
    });
    assert.strictEqual(resFive.status, 400);

    // Negative guests -> 400
    const resNeg = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Valid Name",
      collectorEmail: "valid3@example.com",
      guestCount: -2,
    });
    assert.strictEqual(resNeg.status, 400);
  });

  // -------------------------------------------------------------
  // TEST 5: Input Validation & Missing Mandatory Fields
  // -------------------------------------------------------------
  await test("5. Rejects missing exhibition ID, short name, or invalid email with 400 Bad Request", async () => {
    // Missing exhibition ID
    const resNoId = await apiPost("/api/exhibitions/rsvp", {
      collectorName: "Valid Name",
      collectorEmail: "valid@example.com",
    });
    assert.strictEqual(resNoId.status, 400);

    // Short name (< 2 chars)
    const resShortName = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "A",
      collectorEmail: "valid@example.com",
    });
    assert.strictEqual(resShortName.status, 400);

    // Invalid email format
    const resBadEmail = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Valid Name",
      collectorEmail: "not_a_valid_email",
    });
    assert.strictEqual(resBadEmail.status, 400);
  });

  // -------------------------------------------------------------
  // TEST 6: Rate Limiting (3 per hour allowed, 4th = 429)
  // -------------------------------------------------------------
  await test("6. Enforces rate limit: 3 RSVPs allowed per hour per IP+email, 4th returns 429 Too Many Requests", async () => {
    const rateTestEmail = "rate.limit.test@example.com";

    // 1st request -> 201
    const res1 = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Rate User",
      collectorEmail: rateTestEmail,
      guestCount: 1,
    });
    assert.strictEqual(res1.status, 201);

    // 2nd request -> 201
    const res2 = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Rate User",
      collectorEmail: rateTestEmail,
      guestCount: 2,
    });
    assert.strictEqual(res2.status, 201);

    // 3rd request -> 201
    const res3 = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Rate User",
      collectorEmail: rateTestEmail,
      guestCount: 1,
    });
    assert.strictEqual(res3.status, 201);

    // 4th request -> 429
    const res4 = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Rate User",
      collectorEmail: rateTestEmail,
      guestCount: 1,
    });
    assert.strictEqual(res4.status, 429, "4th request within 1 hour must return 429");
    assert.strictEqual(res4.data.code, "RATE_LIMIT_EXCEEDED");
  });

  // -------------------------------------------------------------
  // TEST 7: VIP Pass & QR Data Structure
  // -------------------------------------------------------------
  await test("7. Emits structured VIP pass metadata and QR check-in string", async () => {
    const res = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Meera Kapoor",
      collectorEmail: "meera.kapoor@example.com",
      guestCount: 2,
    });

    assert.strictEqual(res.status, 201);
    const pass = res.data.pass;
    assert.ok(pass.passId.startsWith("VIP-EHB-1260-"));
    assert.ok(pass.qrCodeData.startsWith("PAG:RSVP:VIP-EHB-1260-"));
    assert.strictEqual(pass.status, "confirmed");
    assert.strictEqual(pass.source, "mobile_app");
  });

  // -------------------------------------------------------------
  // TEST 8: UID-Isolated Pass Storage & Retrieval
  // -------------------------------------------------------------
  await test("8. Authenticated user's passes persist under UID and can be retrieved via /api/collector/exhibition-passes", async () => {
    const collectorToken = createSignedToken("collector_pass_owner_1", "owner1@example.com");

    // Submit RSVP
    const rsvpRes = await apiPost(
      "/api/exhibitions/rsvp",
      {
        exhibitionId: 1260,
        collectorName: "Owner One",
        collectorEmail: "owner1@example.com",
        guestCount: 2,
      },
      { Authorization: `Bearer ${collectorToken}` }
    );
    assert.strictEqual(rsvpRes.status, 201);

    // Retrieve passes for Owner One
    const passesRes = await apiGet("/api/collector/exhibition-passes", {
      Authorization: `Bearer ${collectorToken}`,
    });
    assert.strictEqual(passesRes.status, 200);
    assert.ok(Array.isArray(passesRes.data.passes));
    assert.ok(passesRes.data.passes.some((p) => p.passId === rsvpRes.data.passId));

    // User Two cannot see Owner One's pass
    const userTwoToken = createSignedToken("user_two_isolated", "user2@example.com");
    const userTwoPasses = await apiGet("/api/collector/exhibition-passes", {
      Authorization: `Bearer ${userTwoToken}`,
    });
    assert.strictEqual(userTwoPasses.status, 200);
    assert.ok(!userTwoPasses.data.passes.some((p) => p.passId === rsvpRes.data.passId));
  });

  // -------------------------------------------------------------
  // TEST 9: Unauthenticated Passes Endpoint Protection
  // -------------------------------------------------------------
  await test("9. Rejects unauthenticated GET /api/collector/exhibition-passes with 401", async () => {
    const res = await apiGet("/api/collector/exhibition-passes");
    assert.strictEqual(res.status, 401);
  });

  // -------------------------------------------------------------
  // TEST 10: Zero Secrets Leakage in RSVP Response
  // -------------------------------------------------------------
  await test("10. Zero secret leakage: RESEND_API_KEY and Firebase secrets never exposed", async () => {
    const res = await apiPost("/api/exhibitions/rsvp", {
      exhibitionId: 1260,
      collectorName: "Security Test User",
      collectorEmail: "security.test@example.com",
      guestCount: 1,
    });

    const rawText = JSON.stringify(res.data);
    assert.ok(!rawText.includes("RESEND_API_KEY"), "Must not leak Resend API key");
    assert.ok(!rawText.includes("FIREBASE"), "Must not leak Firebase secrets");
    assert.ok(!rawText.includes("CONSUMER_SECRET"), "Must not leak WooCommerce secrets");
  });

  // -------------------------------------------------------------
  // TEST 11-18: Regressions Across Phases 1, 2, 3A, 3B
  // -------------------------------------------------------------
  await test("11. REGRESSION: Phase 1 Health endpoint returns 200 OK", async () => {
    const res = await apiGet("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, "ok");
  });

  await test("12. REGRESSION: Phase 2 Feature 1 Wishlist endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/wishlist");
    assert.strictEqual(res.status, 401);
  });

  await test("13. REGRESSION: Phase 2 Feature 2 Search & Filter endpoint remains operational", async () => {
    const res = await apiGet("/api/products?search=Krishna&min_price=50000");
    assert.ok(res.status === 200 || res.status === 502 || res.status === 503);
  });

  await test("14. REGRESSION: Phase 2 Feature 3 Recently Viewed endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/recently-viewed");
    assert.strictEqual(res.status, 401);
  });

  await test("15. REGRESSION: Phase 2 Feature 4 Saved Artists endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/saved-artists");
    assert.strictEqual(res.status, 401);
  });

  await test("16. REGRESSION: Phase 2 Feature 5 Artwork Enquiry endpoint remains operational", async () => {
    const res = await apiPost("/api/enquiries", {
      artworkId: 101,
      artworkTitle: "Test Artwork",
      collectorName: "Tester",
      collectorEmail: "tester@example.com",
      message: "Testing enquiry endpoint regression.",
    });
    assert.strictEqual(res.status, 201);
  });

  await test("17. REGRESSION: Phase 3A Addresses endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/addresses");
    assert.strictEqual(res.status, 401);
  });

  await test("18. REGRESSION: Phase 3B CoA endpoint generates valid certificate", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    }
    const res = await apiGet(`/api/products/${validId}/coa`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.coa.referenceId.startsWith(`PAG-COA-2026-${validId}-`));
  });

  await new Promise((resolve) => server.close(resolve));

  console.log("==================================================================");
  console.log(`PHASE 3C TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3CTests().catch((err) => {
  console.error("FATAL ERROR IN PHASE 3C TEST RUNNER:", err);
  process.exit(1);
});
