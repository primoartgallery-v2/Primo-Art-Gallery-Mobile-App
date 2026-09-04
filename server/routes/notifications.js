const express = require("express");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");
const pushNotificationService = require("../services/pushNotificationService");
const distributedRateLimiter = require("../services/distributedRateLimiter");

const router = express.Router();

router.post(["/api/collector/push-token", "/collector/push-token"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to register push token." });
  }

  const { pushToken, platform, deviceName } = req.body || {};

  if (!pushToken || typeof pushToken !== "string" || !pushNotificationService.isValidExpoPushToken(pushToken)) {
    return res.status(400).json({
      error: "A valid Expo push token (e.g. ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]) is required.",
    });
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const rateLimit = await distributedRateLimiter.checkRateLimit({
    bucket: "push_token",
    key: `${clientIp}_${verifiedUser.uid}`,
    limit: 10,
    windowSeconds: 60,
    failMode: "fail-open",
  });

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Too many push token registration attempts. Please slow down." });
  }

  try {
    const result = await collectorStore.savePushToken(verifiedUser.uid, {
      token: pushToken,
      platform,
      deviceName,
    });
    return res.json({
      success: true,
      message: "Push token registered successfully.",
      count: result.count,
    });
  } catch (err) {
    console.error(`[PushToken API] Save error for ${verifiedUser.uid}:`, err.message);
    return res.status(500).json({ error: "Failed to register push token." });
  }
});

/**
 * DELETE /api/collector/push-token & POST /api/collector/push-token/unregister
 * Unregisters a specific device push token for the authenticated collector.
 */
router.all(
  ["/api/collector/push-token/unregister", "/collector/push-token/unregister", "/api/collector/push-token", "/collector/push-token"],
  async (req, res, next) => {
    if (req.method !== "DELETE" && !req.path.includes("unregister")) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

    if (!verifiedUser || !verifiedUser.uid) {
      return res.status(401).json({ error: "Authentication required to unregister push token." });
    }

    const { pushToken } = req.body || {};
    if (!pushToken || typeof pushToken !== "string") {
      return res.status(400).json({ error: "A valid push token string is required." });
    }

    try {
      const result = await collectorStore.removePushToken(verifiedUser.uid, pushToken);
      return res.json({
        success: true,
        message: "Push token unregistered successfully.",
        removed: result.removed,
      });
    } catch (err) {
      console.error(`[PushToken API] Remove error for ${verifiedUser.uid}:`, err.message);
      return res.status(500).json({ error: "Failed to unregister push token." });
    }
  }
);

/**
 * GET /api/collector/push-tokens
 * Retrieves registered push tokens for the authenticated user (masked for privacy).
 */
router.get(["/api/collector/push-tokens", "/collector/push-tokens"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to view push tokens." });
  }

  try {
    const rawTokens = await collectorStore.getPushTokens(verifiedUser.uid);
    const sanitized = rawTokens.map((t) => ({
      token: pushNotificationService.maskPushToken(t.token),
      platform: t.platform || "mobile",
      deviceName: t.deviceName || "Collector Device",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    return res.json({ success: true, count: sanitized.length, tokens: sanitized });
  } catch (err) {
    console.error(`[PushToken API] Get error for ${verifiedUser.uid}:`, err.message);
    return res.status(500).json({ error: "Failed to retrieve push tokens." });
  }
});


module.exports = router;
