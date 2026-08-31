const collectorStore = require("./collectorStore");

/**
 * Validates whether a given string is a valid Expo push token format
 * Matches both standard formats: ExponentPushToken[...] and ExpoPushToken[...]
 */
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[a-zA-Z0-9_\-\.\+~]{10,}\]$/;

function isValidExpoPushToken(token) {
  if (!token || typeof token !== "string") return false;
  return EXPO_PUSH_TOKEN_REGEX.test(token.trim());
}

/**
 * Masks a push token for safe logging without exposing full credentials
 * e.g. "ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]" -> "ExpoPushToken[***xxxx]"
 */
function maskPushToken(token) {
  if (!token || typeof token !== "string") return "[invalid_token]";
  const clean = token.trim();
  if (clean.length < 20) return "ExpoPushToken[***]";
  const prefix = clean.startsWith("ExponentPushToken") ? "ExponentPushToken" : "ExpoPushToken";
  const suffix = clean.slice(-5, -1);
  return `${prefix}[***${suffix}]`;
}

/**
 * Expo Push Notification Service
 *
 * Dispatches secure, non-blocking mobile push notifications via the Expo Push API.
 * Guarantees:
 * 1. Push notifications are NEVER authoritative for auction bidding or transaction outcomes.
 * 2. Notification failures/timeouts never impair or roll back confirmed WordPress bids.
 * 3. Notification payloads are strictly sanitized (no JWTs, passwords, raw emails, or secrets).
 * 4. Expired/unregistered device tokens (DeviceNotRegistered) are safely purged from user records.
 */
class PushNotificationService {
  constructor(options = {}) {
    this.expoApiUrl = options.expoApiUrl || "https://exp.host/--/api/v2/push/send";
    this.timeoutMs = options.timeoutMs || 3000; // 3-second bounded timeout
    this.mockMode = "normal"; // 'normal' | 'error' | 'timeout' | 'invalid_token'
  }

  /**
   * Test Hook: Set mock mode for automated test suites
   * @param {'normal' | 'error' | 'timeout' | 'invalid_token'} mode
   */
  setMockMode(mode) {
    this.mockMode = mode;
  }

  isValidExpoPushToken(token) {
    return isValidExpoPushToken(token);
  }

  maskPushToken(token) {
    return maskPushToken(token);
  }

  /**
   * Sends push notifications to one or more Expo push tokens.
   * @param {Object} opts
   * @param {string|string[]} opts.to - Target push token(s)
   * @param {string} opts.title - Notification title
   * @param {string} opts.body - Notification body text
   * @param {Object} [opts.data] - Sanitized payload data
   * @param {string} [opts.sound='default'] - Sound configuration
   * @param {string} [opts.priority='high'] - Notification priority ('default' | 'normal' | 'high')
   * @returns {Promise<{ success: boolean, deliveredCount: number, failedCount: number, deadTokens: string[], error?: string }>}
   */
  async sendPushNotification({ to, title, body, data = {}, sound = "default", priority = "high" }) {
    const rawTokens = Array.isArray(to) ? to : [to];
    const validTokens = rawTokens.filter((t) => isValidExpoPushToken(t));

    if (validTokens.length === 0) {
      return { success: true, deliveredCount: 0, failedCount: 0, deadTokens: [] };
    }

    // Mock mode handling for test environments
    if (this.mockMode === "timeout") {
      console.warn("[PushNotificationService] Simulated Expo API timeout (3000ms)");
      return {
        success: false,
        deliveredCount: 0,
        failedCount: validTokens.length,
        deadTokens: [],
        error: "Expo Push API request timed out (mocked)",
      };
    }

    if (this.mockMode === "error") {
      console.warn("[PushNotificationService] Simulated Expo API 500 error");
      return {
        success: false,
        deliveredCount: 0,
        failedCount: validTokens.length,
        deadTokens: [],
        error: "Expo Push API upstream error (mocked)",
      };
    }

    if (this.mockMode === "invalid_token") {
      console.warn(`[PushNotificationService] Simulated DeviceNotRegistered for token: ${maskPushToken(validTokens[0])}`);
      return {
        success: false,
        deliveredCount: 0,
        failedCount: validTokens.length,
        deadTokens: validTokens,
        error: "DeviceNotRegistered",
      };
    }

    // Format Expo Push message objects
    const messages = validTokens.map((token) => ({
      to: token,
      title: String(title || "Primo Art Gallery").slice(0, 100),
      body: String(body || "").slice(0, 250),
      data: { ...data },
      sound,
      priority,
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.expoApiUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[PushNotificationService] Expo API HTTP ${res.status} response notice.`);
        return {
          success: false,
          deliveredCount: 0,
          failedCount: validTokens.length,
          deadTokens: [],
          error: `Expo HTTP ${res.status}`,
        };
      }

      const responseData = await res.json();
      const tickets = responseData.data || [];
      const deadTokens = [];
      let deliveredCount = 0;
      let failedCount = 0;

      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          deliveredCount++;
        } else {
          failedCount++;
          if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
            deadTokens.push(validTokens[idx]);
          }
        }
      });

      return {
        success: deliveredCount > 0,
        deliveredCount,
        failedCount,
        deadTokens,
        tickets,
      };
    } catch (err) {
      const isTimeout = err.name === "AbortError";
      console.warn(`[PushNotificationService] Push dispatch notice (${isTimeout ? "Timeout" : err.message}). Auction integrity unaffected.`);
      return {
        success: false,
        deliveredCount: 0,
        failedCount: validTokens.length,
        deadTokens: [],
        error: isTimeout ? "Expo API request timed out" : err.message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Formats and dispatches a sanitized outbid push notification to the prior highest bidder
   * @param {Object} params
   * @param {string} params.recipientUid - Prior highest bidder UID
   * @param {number|string} params.auctionId - Auction lot ID
   * @param {string} params.lotTitle - Artwork title
   * @param {number} params.currentBid - New highest bid amount
   * @param {number} params.nextMinimumBid - Required next minimum bid
   */
  async sendOutbidNotification({ recipientUid, auctionId, lotTitle, currentBid, nextMinimumBid }) {
    if (!recipientUid) return { success: false, reason: "NO_RECIPIENT_UID" };

    try {
      const tokenRecords = await collectorStore.getPushTokens(recipientUid);
      const tokenStrings = tokenRecords.map((r) => r.token).filter((t) => isValidExpoPushToken(t));

      if (tokenStrings.length === 0) {
        return { success: true, deliveredCount: 0, reason: "NO_TOKENS_REGISTERED" };
      }

      const formattedCurrent = `₹ ${Number(currentBid).toLocaleString("en-IN")}`;
      const title = "Outbid Alert — Primo Art Gallery";
      const body = `You have been outbid on "${lotTitle || `Lot #${auctionId}`}". Current bid is ${formattedCurrent}.`;

      // Strictly sanitized payload
      const data = {
        type: "AUCTION_OUTBID",
        auctionId: Number(auctionId),
        currentBid: Number(currentBid),
        nextMinimumBid: Number(nextMinimumBid),
        lotTitle: String(lotTitle || "").slice(0, 100),
      };

      const result = await this.sendPushNotification({
        to: tokenStrings,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
      });

      // Cleanup dead tokens if returned by Expo
      if (result.deadTokens && result.deadTokens.length > 0) {
        for (const deadToken of result.deadTokens) {
          void collectorStore.removePushToken(recipientUid, deadToken).catch(() => {});
        }
      }

      return result;
    } catch (err) {
      console.warn(`[PushNotificationService] Outbid notification notice for ${recipientUid}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new PushNotificationService();
