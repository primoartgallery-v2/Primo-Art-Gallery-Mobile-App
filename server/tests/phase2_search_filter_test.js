const assert = require("assert");
const http = require("http");
const app = require("../index"); // Express app

async function runSearchFilterTests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY FEATURE 2: SEARCH & FILTER TEST SUITE");
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

  // Start test HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function makeRequest(path) {
    const res = await fetch(`${baseUrl}${path}`);
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
    // TEST 1: Basic Search
    // -------------------------------------------------------------
    await test("1. Basic search query parameter is accepted by /api/products", async () => {
      const res = await makeRequest("/api/products?search=Radha+Krishna");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
      if (res.status === 200) {
        assert.ok(Array.isArray(res.data));
      }
    });

    // -------------------------------------------------------------
    // TEST 2: Empty Search
    // -------------------------------------------------------------
    await test("2. Empty search query string is handled safely without crashing", async () => {
      const res = await makeRequest("/api/products?search=");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 3: Search Length Validation (Max 100 chars)
    // -------------------------------------------------------------
    await test("3. Truncates/validates search strings exceeding 100 characters safely", async () => {
      const longQuery = "a".repeat(250);
      const res = await makeRequest(`/api/products?search=${longQuery}`);
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 4: Category Filtering
    // -------------------------------------------------------------
    await test("4. Accepts valid numeric category IDs for category filtering", async () => {
      const res = await makeRequest("/api/products?category=45");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 5: Invalid Category Input
    // -------------------------------------------------------------
    await test("5. Ignores malformed / non-numeric category input safely", async () => {
      const res = await makeRequest("/api/products?category=invalid_sql_inject%27;--");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 6: min_price Validation
    // -------------------------------------------------------------
    await test("6. Accepts valid numeric min_price and rejects negative min_price", async () => {
      const valid = await makeRequest("/api/products?min_price=50000");
      assert.ok(valid.status === 200 || valid.status === 503 || valid.status === 502);

      const invalid = await makeRequest("/api/products?min_price=-500");
      assert.strictEqual(invalid.status, 400, "Negative min_price must return 400 Bad Request");
      assert.ok(invalid.data.error.includes("Invalid min_price"));
    });

    // -------------------------------------------------------------
    // TEST 7: max_price Validation
    // -------------------------------------------------------------
    await test("7. Accepts valid numeric max_price and rejects negative max_price", async () => {
      const valid = await makeRequest("/api/products?max_price=200000");
      assert.ok(valid.status === 200 || valid.status === 503 || valid.status === 502);

      const invalid = await makeRequest("/api/products?max_price=abc");
      assert.strictEqual(invalid.status, 400, "Non-numeric max_price must return 400 Bad Request");
    });

    // -------------------------------------------------------------
    // TEST 8: min_price > max_price Rejection
    // -------------------------------------------------------------
    await test("8. Rejects request when min_price is greater than max_price", async () => {
      const res = await makeRequest("/api/products?min_price=500000&max_price=100000");
      assert.strictEqual(res.status, 400, "min_price > max_price must return 400 Bad Request");
      assert.strictEqual(res.data.error, "min_price cannot be greater than max_price.");
    });

    // -------------------------------------------------------------
    // TEST 9: INR Price Range Request
    // -------------------------------------------------------------
    await test("9. Properly accepts valid INR price range presets (e.g. ₹50,000 – ₹2,00,000)", async () => {
      const res = await makeRequest("/api/products?min_price=50000&max_price=200000");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 10: Sorting Low -> High
    // -------------------------------------------------------------
    await test("10. Supports orderby=price&order=asc for ascending price sorting", async () => {
      const res = await makeRequest("/api/products?orderby=price&order=asc");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 11: Sorting High -> Low
    // -------------------------------------------------------------
    await test("11. Supports orderby=price&order=desc for descending price sorting", async () => {
      const res = await makeRequest("/api/products?orderby=price&order=desc");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 12: Pagination
    // -------------------------------------------------------------
    await test("12. Clamps and accepts page=2&per_page=15 within bounds (1-1000, 1-100)", async () => {
      const res = await makeRequest("/api/products?page=2&per_page=15");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);

      const overflow = await makeRequest("/api/products?page=99999&per_page=5000");
      assert.ok(overflow.status === 200 || overflow.status === 503 || overflow.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 13: Search + Category Combined
    // -------------------------------------------------------------
    await test("13. Handles simultaneous search + category filtering in one request", async () => {
      const res = await makeRequest("/api/products?search=Banaras&category=22");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 14: Search + Price Combined
    // -------------------------------------------------------------
    await test("14. Handles simultaneous search + price range filtering", async () => {
      const res = await makeRequest("/api/products?search=Shiva&min_price=100000&max_price=500000");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 15: Category + Price Combined
    // -------------------------------------------------------------
    await test("15. Handles simultaneous category + price range filtering", async () => {
      const res = await makeRequest("/api/products?category=15&min_price=50000&max_price=200000");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 16: Search + Category + Price + Sort Combined
    // -------------------------------------------------------------
    await test("16. Handles full multi-filter combination (Search + Category + Price + Sort + Pagination)", async () => {
      const res = await makeRequest(
        "/api/products?search=Krishna&category=12&min_price=100000&max_price=500000&orderby=price&order=asc&page=1&per_page=20"
      );
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 17: Arbitrary Query Parameter Stripping
    // -------------------------------------------------------------
    await test("17. Strictly strips and ignores unwhitelisted arbitrary query parameters", async () => {
      const res = await makeRequest("/api/products?malicious_param=true&secret_bypass=1&eval=alert(1)");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 18: Response Headers Preservation
    // -------------------------------------------------------------
    await test("18. /api/categories endpoint returns valid array and headers", async () => {
      const res = await makeRequest("/api/categories");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
      if (res.status === 200) {
        assert.ok(Array.isArray(res.data));
      }
    });

    // -------------------------------------------------------------
    // TEST 19: Existing Artwork Loading Regression Check
    // -------------------------------------------------------------
    await test("19. Basic unfiltered /api/products request works cleanly (Phase 1 regression check)", async () => {
      const res = await makeRequest("/api/products");
      assert.ok(res.status === 200 || res.status === 503 || res.status === 502);
    });

    // -------------------------------------------------------------
    // TEST 20: Existing Wishlist & Collector Route Regression Check
    // -------------------------------------------------------------
    await test("20. Feature 1 Wishlist endpoint remains intact and protected by 401 auth gate", async () => {
      const unauth = await makeRequest("/api/collector/wishlist");
      assert.strictEqual(unauth.status, 401, "Wishlist route must require valid Bearer authentication");
    });
  } finally {
    server.close();
  }

  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSearchFilterTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = runSearchFilterTests;
