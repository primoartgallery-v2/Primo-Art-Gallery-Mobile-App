const assert = require("assert");
const app = require("../index.js");
const parseAuctionLot = app.parseAuctionLot;

async function runTests() {
  console.log("=== RUNNING AUTHORITATIVE AUCTION PARSER UNIT TESTS ===\n");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // Test 1: Regular WooCommerce product without auction meta -> NULL
  await test("1. Regular WooCommerce painting returns NULL", () => {
    const regularProduct = {
      id: 2126,
      name: "Untitled Canvas",
      regular_price: "45000",
      price: "45000",
      type: "simple",
      meta_data: [
        { key: "_medium", value: "Acrylic on canvas" },
        { key: "_dimensions", value: "24x36" },
      ],
    };
    const lot = parseAuctionLot(regularProduct);
    assert.strictEqual(lot, null, "Regular product must return null");
  });

  // Test 2: Product with regular_price only -> NULL
  await test("2. Product with regular_price only (no auction meta) returns NULL", () => {
    const product = {
      id: 2127,
      name: "Masterpiece",
      regular_price: "90000",
      meta_data: [],
    };
    const lot = parseAuctionLot(product);
    assert.strictEqual(lot, null, "Must not infer auction from regular_price");
  });

  // Test 3: product.type === 'auction' without authoritative metadata -> NULL
  await test("3. product.type === 'auction' without authoritative metadata returns NULL", () => {
    const product = {
      id: 2128,
      name: "Fake Auction Lot",
      type: "auction",
      regular_price: "50000",
      meta_data: [{ key: "_some_unrelated_key", value: "123" }],
    };
    const lot = parseAuctionLot(product);
    assert.strictEqual(lot, null, "product.type alone must not grant auction status");
  });

  // Test 4: Valid auction metadata + active timing -> valid LIVE lot
  await test("4. Valid auction metadata + active timing returns valid LIVE lot", () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    const pastDate = new Date(Date.now() - 86400000 * 1).toISOString();
    const activeAuction = {
      id: 2129,
      name: "Kamdhenu Green",
      type: "auction",
      meta_data: [
        { key: "_auction_start_price", value: "40000" },
        { key: "_auction_dates_from", value: pastDate },
        { key: "_auction_dates_to", value: futureDate },
        { key: "_auction_bid_increment", value: "5000" },
        { key: "_auction_current_bid", value: "45000" },
        { key: "_auction_bid_count", value: "3" },
      ],
      permalink: "https://primoartgallery.com/product/kamdhenu-green/",
    };
    const lot = parseAuctionLot(activeAuction);
    assert.ok(lot, "Valid auction must parse");
    assert.strictEqual(lot.id, 2129);
    assert.strictEqual(lot.status, "live", "Active time window must result in status: 'live'");
    assert.strictEqual(lot.startingBid, 40000);
    assert.strictEqual(lot.currentBid, 45000);
    assert.strictEqual(lot.nextMinimumBid, 50000);
    assert.strictEqual(lot.bidCount, 3);
  });

  // Test 5: Upcoming auction -> status: 'upcoming' (excluded from LIVE)
  await test("5. Upcoming auction returns status: 'upcoming'", () => {
    const futureStart = new Date(Date.now() + 86400000 * 2).toISOString();
    const futureEnd = new Date(Date.now() + 86400000 * 5).toISOString();
    const upcomingAuction = {
      id: 2130,
      name: "Upcoming Masterwork",
      meta_data: [
        { key: "_auction_start_price", value: "75000" },
        { key: "_auction_dates_from", value: futureStart },
        { key: "_auction_dates_to", value: futureEnd },
      ],
    };
    const lot = parseAuctionLot(upcomingAuction);
    assert.ok(lot);
    assert.strictEqual(lot.status, "upcoming", "Future start date must result in status: 'upcoming'");
  });

  // Test 6: Expired auction -> status: 'closed' (excluded from LIVE)
  await test("6. Expired auction returns status: 'closed'", () => {
    const pastStart = new Date(Date.now() - 86400000 * 5).toISOString();
    const pastEnd = new Date(Date.now() - 86400000 * 1).toISOString();
    const closedAuction = {
      id: 2131,
      name: "Closed Lot",
      meta_data: [
        { key: "_auction_start_price", value: "30000" },
        { key: "_auction_dates_from", value: pastStart },
        { key: "_auction_dates_to", value: pastEnd },
      ],
    };
    const lot = parseAuctionLot(closedAuction);
    assert.ok(lot);
    assert.strictEqual(lot.status, "closed", "Past end date must result in status: 'closed'");
  });

  // Test 7: Malformed auction metadata -> NULL
  await test("7. Malformed auction metadata returns NULL", () => {
    const malformed = {
      id: 2132,
      name: "Malformed Lot",
      meta_data: [
        { key: "_auction_start_price", value: "NOT_A_NUMBER" },
        { key: "_auction_dates_to", value: "INVALID_DATE_STRING" },
      ],
    };
    const lot = parseAuctionLot(malformed);
    assert.strictEqual(lot, null, "Malformed values must return null");
  });

  // Test 8: Empty catalogue or regular products array -> 0 parsed lots
  await test("8. Catalogue of 50 regular paintings results in 0 parsed auction lots", () => {
    const products = Array.from({ length: 50 }, (_, i) => ({
      id: 2000 + i,
      name: `Painting ${i}`,
      regular_price: "25000",
      price: "25000",
      meta_data: [{ key: "_artist_name", value: "Artist" }],
    }));
    const parsed = products.map(parseAuctionLot).filter(Boolean);
    assert.strictEqual(parsed.length, 0, "No fake auction lots must be created");
  });

  console.log("\n========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
