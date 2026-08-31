const crypto = require("crypto");

/**
 * High-performance Distributed Rate Limiter & Abuse Protection Service
 *
 * Backed by Upstash Redis REST API (HTTPS pipeline) with atomic sliding window log,
 * and a memory-bounded local fallback engine for non-transactional traffic resiliency.
 *
 * Supported Failure Modes:
 * - 'fail-open': Falls back to bounded local in-memory limiter during Redis outages
 *                (used for global proxy, browsing, enquiries, RSVPs).
 * - 'fail-closed': Fails securely with serviceUnavailable: true
 *                  (used for auction bids to prevent unverified bypasses).
 */
class DistributedRateLimiter {
  constructor(options = {}) {
    this.redisUrl = (options.redisUrl || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
    this.redisToken = options.redisToken || process.env.UPSTASH_REDIS_REST_TOKEN || "";
    this.timeoutMs = options.timeoutMs || 1500;
    this.mockMode = "normal"; // 'normal' | 'timeout' | 'error' | 'unconfigured'

    // Bounded Local In-Memory Fallback Store
    this.localStore = new Map();
    this.localLocks = new Map();
    this.MAX_LOCAL_ENTRIES = 10000;

    // Periodic sweep for local in-memory storage (every 60s)
    this.cleanupInterval = setInterval(() => {
      this._cleanupLocalStore();
    }, 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get isConfigured() {
    if (this.mockMode === "unconfigured") return false;
    if (this.mockMode === "timeout" || this.mockMode === "error") return true;
    const url = (process.env.UPSTASH_REDIS_REST_URL || this.redisUrl || "").trim();
    const token = (process.env.UPSTASH_REDIS_REST_TOKEN || this.redisToken || "").trim();
    return Boolean(url && token);
  }

  /**
   * Test Hook: Allows mocking Redis infrastructure state in test environments
   * @param {'normal' | 'timeout' | 'error' | 'unconfigured'} mode
   */
  setMockMode(mode) {
    this.mockMode = mode;
  }

  _cleanupLocalStore() {
    const now = Date.now();
    for (const [key, data] of this.localStore.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        this.localStore.delete(key);
      } else if (Array.isArray(data.timestamps)) {
        data.timestamps = data.timestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
        if (data.timestamps.length === 0) {
          this.localStore.delete(key);
        }
      }
    }

    for (const [key, lockData] of this.localLocks.entries()) {
      if (lockData.lockedUntil && now > lockData.lockedUntil) {
        this.localLocks.delete(key);
      }
    }

    // Safety hard-cap: If map exceeds 10,000 entries, evict oldest entries
    if (this.localStore.size > this.MAX_LOCAL_ENTRIES) {
      const keysToDelete = Array.from(this.localStore.keys()).slice(0, 1000);
      for (const k of keysToDelete) {
        this.localStore.delete(k);
      }
    }
  }

  /**
   * Executes an atomic Upstash Redis REST pipeline
   */
  async _execPipeline(commands) {
    if (this.mockMode === "timeout") {
      throw new Error("Upstash Redis connection timed out (mocked)");
    }
    if (this.mockMode === "error") {
      throw new Error("Upstash Redis upstream cluster error 500 (mocked)");
    }
    if (!this.isConfigured) {
      throw new Error("Upstash Redis is unconfigured");
    }

    const url = `${process.env.UPSTASH_REDIS_REST_URL || this.redisUrl}/pipeline`;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || this.redisToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Upstash Redis HTTP Error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Upstash Redis request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Checks rate limit for an action using atomic sliding window log
   * @param {Object} opts
   * @param {string} opts.bucket - e.g. 'global', 'auction', 'enquiry', 'rsvp'
   * @param {string} opts.key - client identifier (e.g. IP or UID)
   * @param {number} opts.limit - max allowed actions within window
   * @param {number} opts.windowSeconds - sliding window in seconds
   * @param {'fail-open' | 'fail-closed'} [opts.failMode='fail-open']
   * @returns {Promise<{ allowed: boolean, remaining: number, resetSeconds: number, source: string, serviceUnavailable?: boolean }>}
   */
  async checkRateLimit({ bucket, key, limit, windowSeconds, failMode = "fail-open" }) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const minScore = now - windowMs;
    const redisKey = `primo:rl:${bucket}:${key}`;
    const entropy = crypto.randomBytes(3).toString("hex");
    const member = `${now}_${entropy}`;

    if (this.isConfigured && this.mockMode !== "unconfigured") {
      try {
        const pipeline = [
          ["ZREMRANGEBYSCORE", redisKey, "0", String(minScore)],
          ["ZADD", redisKey, String(now), member],
          ["ZCARD", redisKey],
          ["EXPIRE", redisKey, String(windowSeconds + 60)],
        ];

        const results = await this._execPipeline(pipeline);
        // results is an array of responses: [{ result: removedCount }, { result: addedCount }, { result: count }, { result: 1 }]
        const currentCount = results && results[2] && typeof results[2].result === "number" ? results[2].result : 1;

        if (currentCount > limit) {
          return {
            allowed: false,
            remaining: 0,
            resetSeconds: windowSeconds,
            currentCount,
            source: "redis",
          };
        }

        return {
          allowed: true,
          remaining: Math.max(0, limit - currentCount),
          resetSeconds: windowSeconds,
          currentCount,
          source: "redis",
        };
      } catch (err) {
        console.warn(`[DistributedRateLimiter] Redis failure for ${bucket}:${key} (${err.message})`);

        if (failMode === "fail-closed") {
          return {
            allowed: false,
            serviceUnavailable: true,
            error: err.message,
            source: "redis_failed_closed",
          };
        }
        // Fall through to local memory for fail-open
      }
    } else {
      // In production, unconfigured Redis on fail-closed endpoints fails closed
      if (process.env.NODE_ENV === "production" && failMode === "fail-closed") {
        return {
          allowed: false,
          serviceUnavailable: true,
          error: "Distributed rate limit service unconfigured in production.",
          source: "unconfigured_production_fail_closed",
        };
      }
    }

    // Local in-memory sliding window fallback (bounded)
    return this._checkLocalLimit(redisKey, limit, windowMs, windowSeconds);
  }

  _checkLocalLimit(key, limit, windowMs, windowSeconds) {
    const now = Date.now();
    let entry = this.localStore.get(key);
    if (!entry) {
      entry = { timestamps: [], expiresAt: now + windowMs + 60000 };
      this.localStore.set(key, entry);
    }

    const validTimestamps = (entry.timestamps || []).filter((t) => now - t < windowMs);

    if (validTimestamps.length >= limit) {
      entry.timestamps = validTimestamps;
      return {
        allowed: false,
        remaining: 0,
        resetSeconds: windowSeconds,
        currentCount: validTimestamps.length,
        source: "memory",
      };
    }

    validTimestamps.push(now);
    entry.timestamps = validTimestamps;
    entry.expiresAt = now + windowMs + 60000;

    return {
      allowed: true,
      remaining: Math.max(0, limit - validTimestamps.length),
      resetSeconds: windowSeconds,
      currentCount: validTimestamps.length,
      source: "memory",
    };
  }

  /**
   * Checks if an identifier is locked due to repeated authentication failures
   */
  async isLocked({ bucket, key }) {
    const now = Date.now();
    const lockKey = `primo:lock:${bucket}:${key}`;

    if (this.isConfigured && this.mockMode !== "unconfigured") {
      try {
        const pipeline = [["TTL", lockKey]];
        const results = await this._execPipeline(pipeline);
        const ttl = results && results[0] && typeof results[0].result === "number" ? results[0].result : -2;

        if (ttl > 0) {
          return { locked: true, remainingSeconds: ttl, source: "redis" };
        }
        return { locked: false, remainingSeconds: 0, source: "redis" };
      } catch (err) {
        console.warn(`[DistributedRateLimiter] isLocked fallback to memory for ${bucket}:${key}:`, err.message);
      }
    }

    const lockData = this.localLocks.get(lockKey);
    if (lockData && lockData.lockedUntil && now < lockData.lockedUntil) {
      const remainingSeconds = Math.ceil((lockData.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds, source: "memory" };
    }

    return { locked: false, remainingSeconds: 0, source: "memory" };
  }

  /**
   * Records a security authentication failure (e.g. invalid password)
   * Locks key for lockoutSeconds if failure count reaches maxFailures.
   */
  async recordFailure({ bucket, key, maxFailures = 5, lockoutSeconds = 900, windowSeconds = 900 }) {
    const now = Date.now();
    const failKey = `primo:fail:${bucket}:${key}`;
    const lockKey = `primo:lock:${bucket}:${key}`;

    if (this.isConfigured && this.mockMode !== "unconfigured") {
      try {
        const pipeline = [
          ["INCR", failKey],
          ["EXPIRE", failKey, String(windowSeconds)],
        ];
        const results = await this._execPipeline(pipeline);
        const count = results && results[0] && typeof results[0].result === "number" ? results[0].result : 1;

        if (count >= maxFailures) {
          await this._execPipeline([
            ["SET", lockKey, String(now), "EX", String(lockoutSeconds)],
            ["DEL", failKey],
          ]);
          return {
            locked: true,
            attempts: count,
            remainingAttempts: 0,
            lockoutSeconds,
            source: "redis",
          };
        }

        return {
          locked: false,
          attempts: count,
          remainingAttempts: Math.max(0, maxFailures - count),
          source: "redis",
        };
      } catch (err) {
        console.warn(`[DistributedRateLimiter] recordFailure fallback to memory for ${bucket}:${key}:`, err.message);
      }
    }

    // Local memory fallback
    let lockData = this.localLocks.get(lockKey) || { failures: 0, lockedUntil: 0 };
    lockData.failures = (lockData.failures || 0) + 1;

    if (lockData.failures >= maxFailures) {
      lockData.lockedUntil = now + lockoutSeconds * 1000;
      lockData.failures = 0;
      this.localLocks.set(lockKey, lockData);
      return {
        locked: true,
        attempts: maxFailures,
        remainingAttempts: 0,
        lockoutSeconds,
        source: "memory",
      };
    }

    this.localLocks.set(lockKey, lockData);
    return {
      locked: false,
      attempts: lockData.failures,
      remainingAttempts: Math.max(0, maxFailures - lockData.failures),
      source: "memory",
    };
  }

  /**
   * Clears failure counters and lockouts upon successful authentication
   */
  async clearFailure({ bucket, key }) {
    const failKey = `primo:fail:${bucket}:${key}`;
    const lockKey = `primo:lock:${bucket}:${key}`;

    if (this.isConfigured && this.mockMode !== "unconfigured") {
      try {
        await this._execPipeline([
          ["DEL", failKey],
          ["DEL", lockKey],
        ]);
      } catch (err) {
        // Best effort
      }
    }

    this.localLocks.delete(lockKey);
    this.localLocks.delete(failKey);
  }
}

module.exports = new DistributedRateLimiter();
