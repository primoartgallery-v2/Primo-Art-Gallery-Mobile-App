const assert = require("assert");
const http = require("http");
const crypto = require("crypto");
const app = require("../index");
const firebaseAdmin = require("../services/firebaseAdmin");
const collectorStore = require("../services/collectorStore");

function createValidSignedToken(uid, email = "verified_collector@example.com", secret = process.env.JWT_SECRET || "primo_jwt_secret_key_2026") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `Bearer ${header}.${payload}.${sig}`;
}

function createUnsignedToken(uid, email = "attacker@example.com") {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  return `Bearer ${header}.${payload}.unsigned_dummy_signature`;
}

function createTamperedToken(uid, spoofedUid, email = "attacker@example.com", secret = process.env.JWT_SECRET || "primo_jwt_secret_key_2026") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const originalPayload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const originalSig = crypto.createHmac("sha256", secret).update(`${header}.${originalPayload}`).digest("base64url");

  // Tamper payload to spoofed UID while keeping original signature
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      uid: spoofedUid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");

  return `Bearer ${header}.${tamperedPayload}.${originalSig}`;
}

async function runSecurityHardeningTests() {
  console.log("==================================================================");
  console.log("RUNNING P0 SECURITY & AUCTION INTEGRITY HARDENING TEST SUITE");
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
    // GROUP 1: STRICT CRYPTOGRAPHIC JWT SIGNATURE VERIFICATION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 1] Strict JWT Signature Verification (No Unsigned Payload Trust)");

    await test("1.1 Rejects unsigned token with arbitrary UID in verifyAuthToken", async () => {
      const unsignedToken = createUnsignedToken("spoofed_vip_collector_999");
      const result = await firebaseAdmin.verifyAuthToken(unsignedToken);
      assert.strictEqual(result, null, "verifyAuthToken must return null for unsigned token");
    });

    await test("1.2 Rejects tampered payload with mismatched HMAC signature", async () => {
      const tamperedToken = createTamperedToken("legitimate_user", "attacker_spoofed_vip");
      const result = await firebaseAdmin.verifyAuthToken(tamperedToken);
      assert.strictEqual(result, null, "verifyAuthToken must return null for tampered payload");
    });

    await test("1.3 Rejects token signed with wrong HMAC secret", async () => {
      const wrongSecretToken = createValidSignedToken("collector_user", "col@example.com", "wrong_attacker_secret_key_12345");
      const result = await firebaseAdmin.verifyAuthToken(wrongSecretToken);
      assert.strictEqual(result, null, "verifyAuthToken must return null when secret does not match");
    });

    await test("1.4 Rejects unsigned token on protected endpoint (/api/collector/wishlist) with 401", async () => {
      const unsignedToken = createUnsignedToken("victim_collector_123");
      const res = await fetch(`${baseUrl}/api/collector/wishlist`, {
        headers: { Authorization: unsignedToken },
      });
      assert.strictEqual(res.status, 401, "Protected endpoint must return 401 for unsigned token");
    });

    await test("1.5 Rejects unsigned token on auction bid endpoint (/api/auctions/:id/bid) with 401", async () => {
      const unsignedToken = createUnsignedToken("victim_collector_123");
      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: unsignedToken },
        body: JSON.stringify({
          bidAmount: 150000,
          collectorName: "Attacker",
          collectorEmail: "attacker@example.com",
        }),
      });
      assert.strictEqual(res.status, 401, "Auction bid endpoint must return 401 for unsigned token");
    });

    await test("1.6 Strictly rejects fabricated HS256 tokens on verifyAuthToken", async () => {
      const validToken = createValidSignedToken("valid_collector_456", "valid@primo.art");
      const result = await firebaseAdmin.verifyAuthToken(validToken);
      assert.strictEqual(result, null, "verifyAuthToken must reject HS256 tokens");
    });

    // -------------------------------------------------------------
    // GROUP 2: PRODUCTION SECRET INVARIANT ENFORCEMENT
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 2] Production Secret Invariant Validation");

    await test("2.1 Rejects missing JWT_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        PRIMO_BRIDGE_SECRET: "strong_custom_bridge_secret_at_least_16_chars",
        COA_SIGNING_SECRET: "strong_custom_coa_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /JWT_SECRET.*missing/i);
    });

    await test("2.2 Rejects default fallback JWT_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "primo_jwt_secret_key_2026",
        PRIMO_BRIDGE_SECRET: "strong_custom_bridge_secret_at_least_16_chars",
        COA_SIGNING_SECRET: "strong_custom_coa_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /JWT_SECRET.*insecure\/default/i);
    });

    await test("2.3 Rejects missing PRIMO_BRIDGE_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "strong_custom_jwt_secret_at_least_16_chars",
        COA_SIGNING_SECRET: "strong_custom_coa_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /PRIMO_BRIDGE_SECRET.*missing/i);
    });

    await test("2.4 Rejects default fallback PRIMO_BRIDGE_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "strong_custom_jwt_secret_at_least_16_chars",
        PRIMO_BRIDGE_SECRET: "primo_curatorial_bridge_secret_2026",
        COA_SIGNING_SECRET: "strong_custom_coa_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /PRIMO_BRIDGE_SECRET.*insecure\/default/i);
    });

    await test("2.5 Rejects missing COA_SIGNING_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "strong_custom_jwt_secret_at_least_16_chars",
        PRIMO_BRIDGE_SECRET: "strong_custom_bridge_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /COA_SIGNING_SECRET.*missing/i);
    });

    await test("2.6 Rejects default fallback COA_SIGNING_SECRET in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "strong_custom_jwt_secret_at_least_16_chars",
        PRIMO_BRIDGE_SECRET: "strong_custom_bridge_secret_at_least_16_chars",
        COA_SIGNING_SECRET: "primo_curatorial_authority_signing_secret_2026",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /COA_SIGNING_SECRET.*insecure\/default/i);
    });

    await test("2.7 Rejects overly short secrets (< 16 characters) in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "short_secret",
        PRIMO_BRIDGE_SECRET: "strong_custom_bridge_secret_at_least_16_chars",
        COA_SIGNING_SECRET: "strong_custom_coa_secret_at_least_16_chars",
      };
      assert.throws(() => {
        app.validateProductionSecrets(testEnv);
      }, /too short/i);
    });

    await test("2.8 Accepts strong non-default secrets in production", async () => {
      const testEnv = {
        NODE_ENV: "production",
        JWT_SECRET: "enterprise_grade_random_jwt_secret_9948271a",
        PRIMO_BRIDGE_SECRET: "curatorial_bridge_vault_secret_8471920b",
        COA_SIGNING_SECRET: "digital_coa_provenance_master_key_182740c",
      };
      const validation = app.validateProductionSecrets(testEnv);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.errors.length, 0);
    });

    await test("2.9 Allows development/test execution without throwing", async () => {
      const testEnv = {
        NODE_ENV: "development",
        JWT_SECRET: "primo_jwt_secret_key_2026",
      };
      const validation = app.validateProductionSecrets(testEnv);
      assert.strictEqual(validation.valid, true);
    });

    // -------------------------------------------------------------
    // GROUP 3: AUCTION BRIDGE TIMEOUT & UPSTREAM FAILURE ISOLATION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 3] Auction Bridge Timeout & Failure Isolation");

    const bidderUid = `test_bidder_isolation_${Date.now()}`;
    const bidderToken = `Bearer test_id_token_${bidderUid}`;

    const originalVerifyAuthToken = firebaseAdmin.verifyAuthToken;
    firebaseAdmin.verifyAuthToken = async (token) => {
      if (token && token.includes(bidderUid)) {
        return { uid: bidderUid, email: "bidder@example.com" };
      }
      if (token && token.includes("prod_unconf_user")) {
        return { uid: "prod_unconf_user", email: "prod@example.com" };
      }
      return null;
    };

    // Sub-test 3.1 & 3.2: Timeout handling
    await test("3.1 Returns 504 Gateway Timeout when WordPress bridge times out", async () => {
      const timeoutServer = http.createServer((req, res) => {
        // Never respond to trigger client 3500ms timeout
      });
      await new Promise((resolve) => timeoutServer.listen(0, resolve));
      const timeoutPort = timeoutServer.address().port;

      const savedWp = process.env.WOOCOMMERCE_URL;
      process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${timeoutPort}`;

      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bidderToken },
        body: JSON.stringify({
          bidAmount: 150000,
          collectorName: "Timeout Test Bidder",
          collectorEmail: "timeout@example.com",
        }),
      });

      process.env.WOOCOMMERCE_URL = savedWp;
      timeoutServer.closeAllConnections ? timeoutServer.closeAllConnections() : null;
      await new Promise((resolve) => timeoutServer.close(resolve));

      assert.strictEqual(res.status, 504, "Must return 504 Gateway Timeout on bridge timeout");
      const data = await res.json();
      assert.strictEqual(data.code, "AUCTION_BRIDGE_TIMEOUT");
      assert.strictEqual(data.retryable, true);
    });

    await test("3.2 Verifies zero records created in collector bid history after bridge timeout", async () => {
      const historyRes = await fetch(`${baseUrl}/api/collector/my-bids`, {
        headers: { Authorization: bidderToken },
      });
      const historyData = await historyRes.json();
      const matchingBids = (historyData.bids || []).filter((b) => b.collectorName === "Timeout Test Bidder");
      assert.strictEqual(matchingBids.length, 0, "No bid must be recorded in storage when bridge times out");
    });

    // Sub-test 3.3 & 3.4: 500 error handling
    await test("3.3 Returns 502 Bad Gateway when WordPress bridge returns 500 error", async () => {
      const error500Server = http.createServer((req, res) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "WordPress database connection lost." }));
      });
      await new Promise((resolve) => error500Server.listen(0, resolve));
      const errPort = error500Server.address().port;

      const savedWp = process.env.WOOCOMMERCE_URL;
      process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${errPort}`;

      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bidderToken },
        body: JSON.stringify({
          bidAmount: 160000,
          collectorName: "500 Error Test Bidder",
          collectorEmail: "err500@example.com",
        }),
      });

      process.env.WOOCOMMERCE_URL = savedWp;
      await new Promise((resolve) => error500Server.close(resolve));

      assert.strictEqual(res.status, 502, "Must return 502 Bad Gateway on upstream bridge failure");
      const data = await res.json();
      assert.strictEqual(data.code, "AUCTION_BRIDGE_UPSTREAM_ERROR");
      assert.strictEqual(data.retryable, true);
    });

    await test("3.4 Verifies zero records created in collector bid history after bridge 500 error", async () => {
      const historyRes = await fetch(`${baseUrl}/api/collector/my-bids`, {
        headers: { Authorization: bidderToken },
      });
      const historyData = await historyRes.json();
      const matchingBids = (historyData.bids || []).filter((b) => b.collectorName === "500 Error Test Bidder");
      assert.strictEqual(matchingBids.length, 0, "No bid must be recorded in storage when bridge returns 500");
    });

    // Sub-test 3.5 & 3.6: Successful bridge confirmation
    await test("3.5 Returns 201 Created and saves bid when WordPress bridge succeeds", async () => {
      const successServer = http.createServer((req, res) => {
        if (req.url.includes("/wp-json/primo/v1/auctions/")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              lot_id: 1260,
              current_bid: 150000,
              bid_increment: 5000,
              next_min_bid: 155000,
              wp_user_id: 42,
            })
          );
          return;
        }
        if (req.url.includes("/wp-json/wc/v3/products/")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: 1260,
              name: "Authoritative Masterpiece",
              status: "publish",
              regular_price: "100000",
              price: "100000",
              meta_data: [
                { key: "_auction_start_price", value: "100000" },
                { key: "_auction_bid_increment", value: "5000" },
              ],
              images: [],
            })
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise((resolve) => successServer.listen(0, resolve));
      const successPort = successServer.address().port;

      const savedWp = process.env.WOOCOMMERCE_URL;
      const savedKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
      const savedSec = process.env.WOOCOMMERCE_CONSUMER_SECRET;
      process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${successPort}`;
      process.env.WOOCOMMERCE_CONSUMER_KEY = "ck_test_mock";
      process.env.WOOCOMMERCE_CONSUMER_SECRET = "cs_test_mock";

      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bidderToken },
        body: JSON.stringify({
          bidAmount: 150000,
          collectorName: "Successful Bridge Bidder",
          collectorEmail: "success@example.com",
        }),
      });

      process.env.WOOCOMMERCE_URL = savedWp;
      process.env.WOOCOMMERCE_CONSUMER_KEY = savedKey;
      process.env.WOOCOMMERCE_CONSUMER_SECRET = savedSec;
      await new Promise((resolve) => successServer.close(resolve));

      assert.strictEqual(res.status, 201, "Must return 201 Created when bridge succeeds");
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.bidReference.startsWith("PAG-BID-1260-"));
    });

    await test("3.6 Confirms bid is saved in history when bridge succeeds", async () => {
      const historyRes = await fetch(`${baseUrl}/api/collector/my-bids`, {
        headers: { Authorization: bidderToken },
      });
      const historyData = await historyRes.json();
      const matchingBids = (historyData.bids || []).filter(
        (b) => b.bidAmount === 150000 && b.lotId === 1260
      );
      assert.strictEqual(matchingBids.length, 1, "Exactly 1 bid must be recorded in storage upon bridge success");
      assert.strictEqual(matchingBids[0].bidAmount, 150000);
      assert.ok(matchingBids[0].bidReference.startsWith("PAG-BID-1260-"));
    });

    // -------------------------------------------------------------
    // GROUP 4: PRODUCTION UNCONFIGURED BRIDGE PROTECTION
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 4] Production Unconfigured Bridge Protection");

    await test("4.1 Rejects bidding in NODE_ENV=production when WOOCOMMERCE_URL is unconfigured with 503", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalWp = process.env.WOOCOMMERCE_URL;
      process.env.NODE_ENV = "production";
      process.env.WOOCOMMERCE_URL = "";

      const prodToken = "Bearer test_id_token_prod_unconf_user";
      const res = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: prodToken },
        body: JSON.stringify({
          bidAmount: 150000,
          collectorName: "Prod Test",
          collectorEmail: "prod@example.com",
        }),
      });

      process.env.NODE_ENV = originalEnv;
      process.env.WOOCOMMERCE_URL = originalWp;

      assert.strictEqual(res.status, 503, "Production environment must return 503 when WooCommerce is unconfigured");
      const data = await res.json();
      assert.strictEqual(data.code, "AUCTION_SERVICE_UNCONFIGURED");
    });
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    if (typeof originalVerifyAuthToken === "function") {
      firebaseAdmin.verifyAuthToken = originalVerifyAuthToken;
    }
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n==================================================================");
  console.log(`SECURITY HARDENING TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityHardeningTests().catch((err) => {
    console.error("Security hardening tests failed:", err);
    process.exit(1);
  });
}

module.exports = runSecurityHardeningTests;
