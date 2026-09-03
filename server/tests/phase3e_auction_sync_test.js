const assert = require("assert");
const http = require("http");
const crypto = require("crypto");
const app = require("../index");
const auctionEventService = require("../services/auctionEventService");
const distributedRateLimiter = require("../services/distributedRateLimiter");
const collectorStore = require("../services/collectorStore");

function createValidToken(uid, email = "sync_test_collector@example.com") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "primo_jwt_secret_key_2026")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `Bearer ${header}.${payload}.${sig}`;
}

async function runPhase3E1Tests() {
  console.log("==================================================================");
  console.log("RUNNING PRIMO ART GALLERY PHASE 3E-1: LIVE AUCTION SYNC TEST SUITE");
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
    // GROUP 1: SSE CONNECTION ESTABLISHMENT & PROTOCOL COMPLIANCE
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 1] SSE Connection Establishment & Lifecycle");

    await test("1.1 Establishes SSE connection with valid Content-Type and headers", async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/auctions/1260/live`, {
        signal: controller.signal,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("content-type"), "text/event-stream");
      assert.strictEqual(res.headers.get("cache-control"), "no-cache, no-transform");

      // Verify subscriber registered
      assert(auctionEventService.getSubscriberCount(1260) >= 1);
      controller.abort();
    });

    await test("1.2 Receives initial AUCTION_STREAM_CONNECTED handshake event", async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/auctions/1260/live`, {
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);

      assert(text.includes("event: AUCTION_STREAM_CONNECTED"), "Must receive connect handshake");
      assert(text.includes('"auctionId":1260'), "Must echo back correct auction ID");
      controller.abort();
    });

    await test("1.3 Cleans up subscriber upon client disconnect without leaking memory", async () => {
      const initialCount = auctionEventService.getSubscriberCount(9999);
      const controller = new AbortController();

      const res = await fetch(`${baseUrl}/api/auctions/9999/live`, {
        signal: controller.signal,
      });
      assert.strictEqual(auctionEventService.getSubscriberCount(9999), 1);

      // Abort connection
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.strictEqual(auctionEventService.getSubscriberCount(9999), 0, "Subscriber count must drop to 0 after disconnect");
    });

    await test("1.4 Rejects invalid / non-numeric auction IDs on live stream", async () => {
      const res = await fetch(`${baseUrl}/api/auctions/abc_invalid/live`);
      assert.strictEqual(res.status, 400);
    });

    // -------------------------------------------------------------
    // GROUP 2: AUTHORITATIVE BID EVENT BROADCASTING
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 2] Authoritative Bid Events & Stale Event Protection");

    // Setup mock authoritative WordPress server
    let mockWpStatus = 200;
    let mockWpBody = { success: true, lot_id: 1260, current_bid: 250000, next_min_bid: 260000, bid_count: 5 };
    const mockWpServer = http.createServer((req, res) => {
      if (mockWpStatus === 504) {
        // Hang to trigger client timeout
        return;
      }
      res.writeHead(mockWpStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockWpBody));
    });
    await new Promise((resolve) => mockWpServer.listen(0, resolve));
    const mockWpPort = mockWpServer.address().port;

    const savedWp = process.env.WOOCOMMERCE_URL;
    process.env.WOOCOMMERCE_URL = `http://127.0.0.1:${mockWpPort}`;

    const testBidderUid = `sync_bidder_${Date.now()}`;
    const testBidderToken = createValidToken(testBidderUid, "sync_bidder@example.com");

    await test("2.1 Successful WordPress bid emits AUCTION_BID_CONFIRMED event to SSE subscribers", async () => {
      const controller = new AbortController();
      const sseRes = await fetch(`${baseUrl}/api/auctions/1260/live`, { signal: controller.signal });
      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      // Read initial connection event
      await reader.read();

      // Place confirmed bid
      mockWpStatus = 200;
      mockWpBody = { success: true, lot_id: 1260, current_bid: 250000, next_min_bid: 260000, bid_count: 5 };

      const bidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: testBidderToken },
        body: JSON.stringify({
          bidAmount: 250000,
          collectorName: "Anabil Bhattacharya",
          collectorEmail: "sync_bidder@example.com",
        }),
      });

      assert.strictEqual(bidRes.status, 201);

      // Read broadcast event from SSE stream
      const { value } = await reader.read();
      const eventText = decoder.decode(value);

      assert(eventText.includes("event: AUCTION_BID_CONFIRMED"), "Must receive confirmed bid event");
      assert(eventText.includes('"currentBid":250000'), "Must broadcast updated current bid");
      assert(eventText.includes('"nextMinimumBid":255000'), "Must broadcast updated next min bid");

      controller.abort();
    });

    await test("2.2 Event payload is sanitized (contains masked name, NO secrets, NO JWTs, NO raw emails)", async () => {
      const event = await auctionEventService.publishAuctionEvent({
        auctionId: 1260,
        lotData: { current_bid: 300000, next_min_bid: 310000, bid_count: 6 },
        bidder: { name: "Rohit Sharma", email: "rohit@example.com", uid: "secret_uid_123" },
      });

      assert.strictEqual(event.eventType, "AUCTION_BID_CONFIRMED");
      assert.strictEqual(event.bidderDisplay, "Ro*** S.", "Collector name must be masked for privacy");
      assert.strictEqual(event.email, undefined, "Raw email must NEVER be in broadcast event");
      assert.strictEqual(event.uid, undefined, "Raw UID must NEVER be in broadcast event");
      assert.strictEqual(event.jwt, undefined, "JWT must NEVER be in broadcast event");
    });

    await test("2.3 Monotonic sequence allows clients to order events and reject stale updates", async () => {
      const event1 = await auctionEventService.publishAuctionEvent({
        auctionId: 1260,
        lotData: { current_bid: 350000, next_min_bid: 360000 },
      });
      await new Promise((r) => setTimeout(r, 10));
      const event2 = await auctionEventService.publishAuctionEvent({
        auctionId: 1260,
        lotData: { current_bid: 375000, next_min_bid: 385000 },
      });

      assert(typeof event1.sequence === "number", "Event sequence must be a numeric timestamp/counter");
      assert(event2.sequence > event1.sequence, "Subsequent events must have strictly greater monotonic sequence");
    });

    // -------------------------------------------------------------
    // GROUP 3: FAILURE ISOLATION & NON-AUTHORITATIVE SSE GUARANTEE
    // -------------------------------------------------------------
    console.log("\n[TEST GROUP 3] Non-Authoritative SSE & Failure Isolation");

    await test("3.1 Upstream WordPress 500 error does NOT emit any bid event to subscribers", async () => {
      const testLotId = 7777;
      const controller = new AbortController();
      const sseRes = await fetch(`${baseUrl}/api/auctions/${testLotId}/live`, { signal: controller.signal });
      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      // Read initial connection event
      await reader.read();

      // Set upstream WordPress to return 500 Error
      mockWpStatus = 500;
      mockWpBody = { error: "Database lock timeout" };

      const bidRes = await fetch(`${baseUrl}/api/auctions/${testLotId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: testBidderToken },
        body: JSON.stringify({
          bidAmount: 400000,
          collectorName: "Error Test Bidder",
          collectorEmail: "err@example.com",
        }),
      });

      assert.strictEqual(bidRes.status, 502, "Must return 502 Bad Gateway");

      // Verify no new event was sent across SSE (stream remains quiet)
      let receivedUnexpected = false;
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 200));
      const readPromise = reader.read().then(({ value }) => {
        if (value) {
          const text = decoder.decode(value);
          if (text.includes("AUCTION_BID_CONFIRMED")) {
            receivedUnexpected = true;
          }
        }
      });

      await Promise.race([timeoutPromise, readPromise]);
      assert.strictEqual(receivedUnexpected, false, "Failed bridge must NEVER emit a confirmed bid event");
      controller.abort();
    });

    await test("3.2 Upstream WordPress timeout (504) does NOT emit any bid event to subscribers", async () => {
      const testLotId = 8888;
      const controller = new AbortController();
      const sseRes = await fetch(`${baseUrl}/api/auctions/${testLotId}/live`, { signal: controller.signal });
      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      // Read initial connection event
      await reader.read();

      // Set upstream WordPress to hang / timeout
      mockWpStatus = 504;

      const bidRes = await fetch(`${baseUrl}/api/auctions/${testLotId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: testBidderToken },
        body: JSON.stringify({
          bidAmount: 500000,
          collectorName: "Timeout Test Bidder",
          collectorEmail: "timeout@example.com",
        }),
      });

      assert.strictEqual(bidRes.status, 504, "Must return 504 Gateway Timeout");

      // Verify no event was emitted
      let receivedUnexpected = false;
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 200));
      const readPromise = reader.read().then(({ value }) => {
        if (value) {
          const text = decoder.decode(value);
          if (text.includes("AUCTION_BID_CONFIRMED")) {
            receivedUnexpected = true;
          }
        }
      });

      await Promise.race([timeoutPromise, readPromise]);
      assert.strictEqual(receivedUnexpected, false, "Timed out bridge must NEVER emit a confirmed bid event");
      controller.abort();
    });

    await test("3.3 Redis pub/sub failure does NOT alter authoritative WordPress bid success", async () => {
      mockWpStatus = 200;
      mockWpBody = { success: true, lot_id: 1260, current_bid: 450000, next_min_bid: 460000, bid_count: 7 };

      // Simulate Redis publish failure
      auctionEventService.setMockRedisMode("error");

      const bidRes = await fetch(`${baseUrl}/api/auctions/1260/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: testBidderToken },
        body: JSON.stringify({
          bidAmount: 450000,
          collectorName: "Resilient Bidder",
          collectorEmail: "sync_bidder@example.com",
        }),
      });

      assert.strictEqual(bidRes.status, 201, "Authoritative bid must still succeed even if Redis pub/sub warning occurs");
      const data = await bidRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.bid.bidAmount, 450000);

      auctionEventService.setMockRedisMode("normal");
    });

    await test("3.4 Bounded subscriber memory rejects excess connections gracefully (503)", async () => {
      const origMax = auctionEventService.MAX_SUBSCRIBERS_PER_LOT;
      auctionEventService.MAX_SUBSCRIBERS_PER_LOT = 2;

      const c1 = new AbortController();
      const c2 = new AbortController();

      const r1 = await fetch(`${baseUrl}/api/auctions/5555/live`, { signal: c1.signal });
      const r2 = await fetch(`${baseUrl}/api/auctions/5555/live`, { signal: c2.signal });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);

      // 3rd subscriber should be rejected with 503 capacity exceeded
      const r3 = await fetch(`${baseUrl}/api/auctions/5555/live`);
      assert.strictEqual(r3.status, 503);
      const data = await r3.json();
      assert.strictEqual(data.code, "LOT_CAPACITY_EXCEEDED");

      c1.abort();
      c2.abort();
      auctionEventService.MAX_SUBSCRIBERS_PER_LOT = origMax;
    });

    // Cleanup mock WordPress server
    process.env.WOOCOMMERCE_URL = savedWp;
    await new Promise((resolve) => mockWpServer.close(resolve));
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n==================================================================");
  console.log(`PHASE 3E-1 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase3E1Tests().catch((err) => {
    console.error("Phase 3E-1 tests failed:", err);
    process.exit(1);
  });
}

module.exports = runPhase3E1Tests;
