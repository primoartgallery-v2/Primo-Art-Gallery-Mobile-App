const distributedRateLimiter = require("../services/distributedRateLimiter");

// Global Proxy Rate Limiter (120 requests per rolling 60 seconds per IP, Fail-Open to bounded memory)
async function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  try {
    const check = await distributedRateLimiter.checkRateLimit({
      bucket: "global_proxy",
      key: ip,
      limit: 120,
      windowSeconds: 60,
      failMode: "fail-open",
    });

    if (!check.allowed) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
  } catch {
    // Non-transactional browsing fails open safely to bounded local memory
  }
  next();
}

module.exports = {
  rateLimiter,
};
