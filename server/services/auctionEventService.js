const crypto = require("crypto");
const EventEmitter = require("events");

/**
 * Helper to mask collector names for privacy in public live streams
 * e.g. "Anabil Bhattacharya" -> "An*** B."
 */
function maskCollectorName(name) {
  if (!name || typeof name !== "string") return "Collector";
  const clean = name.trim();
  const parts = clean.split(" ");
  if (parts.length === 1) {
    if (clean.length <= 2) return `${clean[0]}*`;
    return `${clean.slice(0, 2)}***`;
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0] || "";
  const maskedFirst = first.length <= 2 ? first : `${first.slice(0, 2)}***`;
  return `${maskedFirst} ${lastInitial}.`;
}

/**
 * Real-Time Auction Synchronization & SSE Broadcasting Service
 *
 * Provides live server-sent event (SSE) updates to mobile auction subscribers
 * with multi-instance Redis Pub/Sub support and bounded connection lifecycle.
 *
 * Guarantees:
 * 1. SSE is NEVER an auction authority.
 * 2. Only confirmed successful WordPress Simple Auctions bridge transactions emit events.
 * 3. Events contain only sanitized public auction data (no secrets, JWTs, or raw emails).
 * 4. Redis/SSE failure never impairs an authoritative bid transaction.
 */
class AuctionEventService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.subscribers = new Map(); // Map<auctionId, Set<res>>
    this.totalSubscribers = 0;
    this.MAX_SUBSCRIBERS_PER_LOT = options.maxPerLot || 200;
    this.MAX_TOTAL_SUBSCRIBERS = options.maxTotal || 1000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 20000; // 20s
    this.latestLotState = new Map(); // Map<auctionId, latestEvent>

    this.redisUrl = (options.redisUrl || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
    this.redisToken = options.redisToken || process.env.UPSTASH_REDIS_REST_TOKEN || "";
    this.mockRedisMode = "normal"; // 'normal' | 'error' | 'unconfigured'

    // Periodic Heartbeat & Dead-Connection Sweep
    this.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, this.heartbeatIntervalMs);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  setMockRedisMode(mode) {
    this.mockRedisMode = mode;
  }

  get isRedisConfigured() {
    if (this.mockRedisMode === "unconfigured") return false;
    if (this.mockRedisMode === "error") return true;
    const url = (process.env.UPSTASH_REDIS_REST_URL || this.redisUrl || "").trim();
    const token = (process.env.UPSTASH_REDIS_REST_TOKEN || this.redisToken || "").trim();
    return Boolean(url && token);
  }

  /**
   * Subscribes an HTTP response client to live auction events for a specific lot
   */
  subscribeClient(auctionId, req, res) {
    const lotId = Number(auctionId);
    if (!lotId || isNaN(lotId)) {
      return res.status(400).json({ error: "A valid numeric auctionId is required." });
    }

    // Capacity enforcement
    if (this.totalSubscribers >= this.MAX_TOTAL_SUBSCRIBERS) {
      return res.status(503).json({
        error: "Live auction stream capacity reached. Please refresh shortly.",
        code: "SSE_CAPACITY_EXCEEDED",
      });
    }

    let lotSubscribers = this.subscribers.get(lotId);
    if (!lotSubscribers) {
      lotSubscribers = new Set();
      this.subscribers.set(lotId, lotSubscribers);
    }

    if (lotSubscribers.size >= this.MAX_SUBSCRIBERS_PER_LOT) {
      return res.status(503).json({
        error: "Maximum live subscribers reached for this auction lot.",
        code: "LOT_CAPACITY_EXCEEDED",
      });
    }

    // Set Server-Sent Events headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connected handshake
    const connectEvent = {
      eventId: `conn_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      eventType: "AUCTION_STREAM_CONNECTED",
      auctionId: lotId,
      timestamp: new Date().toISOString(),
    };
    res.write(`id: ${connectEvent.eventId}\nevent: ${connectEvent.eventType}\ndata: ${JSON.stringify(connectEvent)}\n\n`);

    // If we have a cached authoritative state for this lot, deliver it immediately
    const latest = this.latestLotState.get(lotId);
    if (latest) {
      res.write(`id: ${latest.eventId}\nevent: ${latest.eventType}\ndata: ${JSON.stringify(latest)}\n\n`);
    }

    // Register subscriber
    lotSubscribers.add(res);
    this.totalSubscribers++;

    // Handle client disconnect / socket close
    const cleanup = () => {
      if (lotSubscribers.has(res)) {
        lotSubscribers.delete(res);
        this.totalSubscribers = Math.max(0, this.totalSubscribers - 1);
        if (lotSubscribers.size === 0) {
          this.subscribers.delete(lotId);
        }
      }
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  }

  /**
   * Broadcasts an authoritative auction event to all subscribers of a lot
   * @param {Object} params
   * @param {number|string} params.auctionId - Auction lot ID
   * @param {Object} params.lotData - Authoritative lot data returned by WordPress bridge
   * @param {Object} [params.bidder] - Bidder details { name, email, uid }
   */
  async publishAuctionEvent({ auctionId, lotData = {}, bidder = {} }) {
    const lotId = Number(auctionId);
    if (!lotId || isNaN(lotId)) return null;

    const currentBid = Number(lotData.current_bid || lotData.currentBid || 0);
    const nextMinimumBid = Number(lotData.next_min_bid || lotData.nextMinimumBid || currentBid + 5000);
    const bidCount = Number(lotData.bid_count || lotData.bidCount || 1);

    const now = Date.now();
    const event = {
      eventId: `bid_${now}_${crypto.randomBytes(4).toString("hex")}`,
      eventType: "AUCTION_BID_CONFIRMED",
      auctionId: lotId,
      currentBid,
      nextMinimumBid,
      bidCount,
      sequence: now, // Monotonic timestamp sequence for stale event rejection
      timestamp: new Date(now).toISOString(),
      bidderDisplay: maskCollectorName(bidder.name || bidder.displayName || "Collector"),
      lotStatus: lotData.status || "active",
    };

    // Cache latest authoritative state for new reconnecting subscribers
    this.latestLotState.set(lotId, event);

    // 1. Broadcast locally to connected clients on this instance
    this._broadcastToLocalSubscribers(lotId, event);

    // 2. Publish to Redis Pub/Sub for multi-instance Render backplane
    if (this.isRedisConfigured) {
      try {
        await this._publishToRedis(lotId, event);
      } catch (err) {
        console.warn(`[AuctionEventService] Redis pub/sub warning for lot ${lotId} (${err.message}). Local delivery succeeded.`);
      }
    }

    return event;
  }

  _broadcastToLocalSubscribers(lotId, event) {
    const subscribers = this.subscribers.get(lotId);
    if (!subscribers || subscribers.size === 0) return;

    const payload = `id: ${event.eventId}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const clientRes of subscribers) {
      try {
        if (!clientRes.writableEnded && clientRes.writable) {
          clientRes.write(payload);
        } else {
          subscribers.delete(clientRes);
          this.totalSubscribers = Math.max(0, this.totalSubscribers - 1);
        }
      } catch {
        subscribers.delete(clientRes);
        this.totalSubscribers = Math.max(0, this.totalSubscribers - 1);
      }
    }

    if (subscribers.size === 0) {
      this.subscribers.delete(lotId);
    }
  }

  async _publishToRedis(auctionId, event) {
    if (this.mockRedisMode === "error") {
      throw new Error("Upstash Redis Pub/Sub connection error (mocked)");
    }

    const url = `${process.env.UPSTASH_REDIS_REST_URL || this.redisUrl}/publish/primo:auction:${auctionId}`;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || this.redisToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Upstash Redis HTTP Publish error ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  _sendHeartbeat() {
    const heartbeatComment = `: keepalive ${Date.now()}\n\n`;
    for (const [lotId, subscribers] of this.subscribers.entries()) {
      for (const clientRes of subscribers) {
        try {
          if (!clientRes.writableEnded && clientRes.writable) {
            clientRes.write(heartbeatComment);
          } else {
            subscribers.delete(clientRes);
            this.totalSubscribers = Math.max(0, this.totalSubscribers - 1);
          }
        } catch {
          subscribers.delete(clientRes);
          this.totalSubscribers = Math.max(0, this.totalSubscribers - 1);
        }
      }
      if (subscribers.size === 0) {
        this.subscribers.delete(lotId);
      }
    }
  }

  getSubscriberCount(auctionId) {
    const subscribers = this.subscribers.get(Number(auctionId));
    return subscribers ? subscribers.size : 0;
  }
}

module.exports = new AuctionEventService();
