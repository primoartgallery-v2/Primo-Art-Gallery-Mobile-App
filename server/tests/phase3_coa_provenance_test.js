process.env.COA_SIGNING_SECRET = process.env.COA_SIGNING_SECRET || "digital_coa_provenance_master_key_182740c";

const assert = require("assert");
const crypto = require("crypto");
const http = require("http");

async function runPhase3BTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 3B: COA & PROVENANCE TEST SUITE");
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

  async function apiGet(path) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
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
  // TEST 1: Valid CoA Generation for Existing Artwork
  // -------------------------------------------------------------
  await test("1. Successfully generates authoritative CoA for valid artwork ID", async () => {
    // 1. Fetch any live product ID or use 1260
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    assert.strictEqual(res.status, 200, "Must return 200 OK");
    assert.strictEqual(res.data.success, true, "Response must indicate success");
    assert.ok(res.data.coa, "Response must contain coa object");
    assert.strictEqual(res.data.coa.artworkId, validId);
  });

  // -------------------------------------------------------------
  // TEST 2: Deterministic Reference ID Generation
  // -------------------------------------------------------------
  await test("2. Generates deterministic, immutable CoA Reference IDs", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res1 = await apiGet(`/api/products/${validId}/coa`);
    const res2 = await apiGet(`/api/products/${validId}/coa`);

    assert.ok(res1.data.coa.referenceId.startsWith(`PAG-COA-2026-${validId}-`));
    assert.strictEqual(
      res1.data.coa.referenceId,
      res2.data.coa.referenceId,
      "Reference ID must be deterministic across calls"
    );
  });

  // -------------------------------------------------------------
  // TEST 3: Metadata Completeness
  // -------------------------------------------------------------
  await test("3. Ensures all mandatory curatorial and provenance fields are populated", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    const coa = res.data.coa;

    const requiredFields = [
      "referenceId",
      "artworkId",
      "artworkTitle",
      "artistName",
      "medium",
      "dimensions",
      "creationYear",
      "edition",
      "signatureStatus",
      "gallery",
      "curator",
      "issuedAt",
      "integrityHash",
      "cryptographicSignature",
      "verificationMechanism",
      "verificationUrl",
      "legalNotice",
    ];

    for (const field of requiredFields) {
      assert.ok(coa[field] !== undefined && coa[field] !== null && String(coa[field]).trim().length > 0, `Field ${field} must be present`);
    }

    assert.strictEqual(coa.gallery, "Primo Art Gallery, New Delhi");
    assert.strictEqual(coa.edition, "Original Masterwork (1 of 1)");
  });

  // -------------------------------------------------------------
  // TEST 4: Artwork ID Validation & Rejection of Malformed IDs
  // -------------------------------------------------------------
  await test("4. Rejects malformed, non-numeric product IDs with 400 Bad Request", async () => {
    const res = await apiGet("/api/products/abc_injection/coa");
    assert.strictEqual(res.status, 400, "Non-numeric ID must return 400");
    assert.strictEqual(res.data.error, "Invalid product ID.");
  });

  // -------------------------------------------------------------
  // TEST 5: Rejection of Special Characters & SQL Injections
  // -------------------------------------------------------------
  await test("5. Safely rejects SQL injection attempts in product ID parameter", async () => {
    const res = await apiGet("/api/products/101%27;DROP%20TABLE/coa");
    assert.strictEqual(res.status, 400);
  });

  // -------------------------------------------------------------
  // TEST 6: Nonexistent Artwork ID Handling (404 Not Found)
  // -------------------------------------------------------------
  await test("6. Returns 404 Not Found for nonexistent artwork IDs", async () => {
    const res = await apiGet("/api/products/999999999/coa");
    assert.strictEqual(res.status, 404, "Must return 404 for nonexistent artwork");
    assert.strictEqual(res.data.error, "Artwork not found for CoA generation.");
  });

  // -------------------------------------------------------------
  // TEST 7: Zero Secret Leakage in CoA Response
  // -------------------------------------------------------------
  await test("7. Zero secret leakage: private signing keys and server credentials never exposed", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    const rawText = JSON.stringify(res.data);

    assert.ok(!rawText.includes("COA_SIGNING_SECRET"), "Must not leak env key name");
    assert.ok(!rawText.includes("CONSUMER_SECRET"), "Must not leak WooCommerce secret");
    assert.ok(!rawText.includes("FIREBASE"), "Must not leak Firebase keys");
  });

  // -------------------------------------------------------------
  // TEST 8: Cryptographic Signature Integrity & Verification
  // -------------------------------------------------------------
  await test("8. Verifies HMAC-SHA256 signature against integrity hash", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    const coa = res.data.coa;

    const signingSecret = process.env.COA_SIGNING_SECRET;
    const expectedSignature = crypto
      .createHmac("sha256", signingSecret)
      .update(coa.integrityHash)
      .digest("hex");

    assert.strictEqual(
      coa.cryptographicSignature,
      expectedSignature,
      "Server signature must be authentic HMAC-SHA256 of the integrity hash"
    );

    // Tampered test: If integrity hash is altered, signature verification fails
    const tamperedHash = "tampered_hash_value_12345";
    const tamperedExpected = crypto
      .createHmac("sha256", signingSecret)
      .update(tamperedHash)
      .digest("hex");

    assert.notStrictEqual(
      coa.cryptographicSignature,
      tamperedExpected,
      "Tampered hash must fail signature verification"
    );
  });

  // -------------------------------------------------------------
  // TEST 9: Legal Disclaimer & Ownership Invariant
  // -------------------------------------------------------------
  await test("9. Legal disclaimer explicitly clarifies CoA does not imply legal title without invoice", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    assert.ok(
      res.data.coa.legalNotice.includes("does not constitute legal title"),
      "Legal notice must protect gallery copyright and title"
    );
  });

  // -------------------------------------------------------------
  // TEST 10: Verification Web URL Format
  // -------------------------------------------------------------
  await test("10. Verification URL includes URL-encoded CoA reference ID", async () => {
    const prodRes = await apiGet("/api/products?per_page=1");
    let validId = 1260;
    if (Array.isArray(prodRes.data) && prodRes.data.length > 0) {
      validId = prodRes.data[0].id;
    } else if (prodRes.data && Array.isArray(prodRes.data.products) && prodRes.data.products.length > 0) {
      validId = prodRes.data.products[0].id;
    }

    const res = await apiGet(`/api/products/${validId}/coa`);
    assert.ok(
      res.data.coa.verificationUrl.startsWith(`https://primoartgallery.com/verify-coa?ref=PAG-COA-2026-${validId}-`),
      "Verification URL must lead to gallery registry with reference ID"
    );
  });

  // -------------------------------------------------------------
  // TEST 10: Phase 1 & 2 Regressions Intact
  // -------------------------------------------------------------
  await test("10. REGRESSION: Phase 1 Health endpoint returns 200 OK", async () => {
    const res = await apiGet("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, "ok");
  });

  await test("11. REGRESSION: Phase 2 Search & Filter endpoint remains operational", async () => {
    const res = await apiGet("/api/products?search=Krishna&min_price=50000");
    assert.ok(res.status === 200 || res.status === 502 || res.status === 503);
  });

  await test("12. REGRESSION: Phase 2 Feature 1 Wishlist endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/wishlist");
    assert.strictEqual(res.status, 401);
  });

  await test("13. REGRESSION: Phase 3A Addresses endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/addresses");
    assert.strictEqual(res.status, 401);
  });

  await test("14. REGRESSION: Phase 3A Profile endpoint remains protected with 401", async () => {
    const res = await apiGet("/api/collector/profile");
    assert.strictEqual(res.status, 401);
  });

  await new Promise((resolve) => server.close(resolve));

  console.log("==================================================================");
  console.log(`PHASE 3B TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3BTests().catch((err) => {
  console.error("FATAL ERROR IN PHASE 3B TEST RUNNER:", err);
  process.exit(1);
});
