const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Persistent storage engine for OTP sessions, sliding-window rate limits,
 * cooldowns, attempt counters, and lockout state.
 *
 * Supports Firestore when initialized via firebase-admin, with an atomic
 * local disk file fallback (server/data/auth_store.json) for development and offline resilience.
 */
class PersistentAuthStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, "..", "data");
    this.filePath = path.join(this.dataDir, "auth_store.json");
    this.secretSalt = process.env.OTP_SECRET_SALT || "primo_gallery_secure_auth_salt_2026";
    this.firestore = null;

    this._ensureStorage();
  }

  setFirestore(db) {
    this.firestore = db;
    console.log("[PersistentAuthStore] Firestore backend configured.");
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(
          this.filePath,
          JSON.stringify({ otpSessions: {}, rateLimits: {} }, null, 2),
          "utf8"
        );
      }
    } catch (err) {
      console.warn("[PersistentAuthStore] Storage initialization notice:", err.message);
    }
  }

  _readDisk() {
    try {
      this._ensureStorage();
      const raw = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      console.error("[PersistentAuthStore] Failed to read disk store:", err.message);
      return { otpSessions: {}, rateLimits: {} };
    }
  }

  _writeDisk(data) {
    try {
      this._ensureStorage();
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error("[PersistentAuthStore] Failed to write disk store:", err.message);
    }
  }

  _normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  _hashEmail(email) {
    const clean = this._normalizeEmail(email);
    return crypto.createHash("sha256").update(`${clean}:${this.secretSalt}`).digest("hex");
  }

  hashOtp(otp, salt) {
    return crypto
      .createHash("sha256")
      .update(`${String(otp)}:${salt}:${this.secretSalt}`)
      .digest("hex");
  }

  verifyOtpHash(inputOtp, storedHash, salt) {
    if (!inputOtp || !storedHash || !salt) return false;
    const computed = this.hashOtp(inputOtp, salt);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(storedHash, "hex")
      );
    } catch {
      return false;
    }
  }

  /**
   * Check rate limits for sending OTP.
   * Rules:
   * - 60-second resend cooldown.
   * - Maximum 5 requests in rolling 24 hours.
   */
  async checkRateLimit(email) {
    const emailKey = this._hashEmail(email);
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const cooldownMs = 60 * 1000; // 60 seconds
    const maxRequestsPerDay = 5;

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("auth_rate_limits").doc(emailKey);
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data() || {};
          const timestamps = (data.timestamps || []).filter((t) => now - t < windowMs);
          const lastRequestedAt = data.lastRequestedAt || 0;

          if (now - lastRequestedAt < cooldownMs) {
            const remainingCooldown = Math.ceil((cooldownMs - (now - lastRequestedAt)) / 1000);
            return {
              allowed: false,
              reason: "cooldown",
              remainingSeconds: remainingCooldown,
              message: `Please wait ${remainingCooldown} seconds before requesting a new code.`,
            };
          }

          if (timestamps.length >= maxRequestsPerDay) {
            const oldest = timestamps[0];
            const resetInMinutes = Math.ceil((windowMs - (now - oldest)) / (60 * 1000));
            return {
              allowed: false,
              reason: "daily_limit",
              remainingMinutes: resetInMinutes,
              message: `Maximum OTP requests reached for today (5 requests/day). Please try again in ${resetInMinutes} minutes.`,
            };
          }

          return { allowed: true, currentRequestsToday: timestamps.length };
        }
        return { allowed: true, currentRequestsToday: 0 };
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore rate limit check fallback to disk:", err.message);
      }
    }

    // Disk fallback
    const store = this._readDisk();
    const entry = store.rateLimits[emailKey] || { timestamps: [], lastRequestedAt: 0 };
    const validTimestamps = (entry.timestamps || []).filter((t) => now - t < windowMs);

    if (now - (entry.lastRequestedAt || 0) < cooldownMs) {
      const remainingCooldown = Math.ceil((cooldownMs - (now - entry.lastRequestedAt)) / 1000);
      return {
        allowed: false,
        reason: "cooldown",
        remainingSeconds: remainingCooldown,
        message: `Please wait ${remainingCooldown} seconds before requesting a new code.`,
      };
    }

    if (validTimestamps.length >= maxRequestsPerDay) {
      const oldest = validTimestamps[0];
      const resetInMinutes = Math.ceil((windowMs - (now - oldest)) / (60 * 1000));
      return {
        allowed: false,
        reason: "daily_limit",
        remainingMinutes: resetInMinutes,
        message: `Maximum OTP requests reached for today (5 requests/day). Please try again in ${resetInMinutes} minutes.`,
      };
    }

    return { allowed: true, currentRequestsToday: validTimestamps.length };
  }

  /**
   * Records a new OTP request timestamp for rate limiting.
   */
  async recordOtpRequest(email) {
    const emailKey = this._hashEmail(email);
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("auth_rate_limits").doc(emailKey);
        const doc = await docRef.get();
        let timestamps = [];
        if (doc.exists) {
          timestamps = (doc.data()?.timestamps || []).filter((t) => now - t < windowMs);
        }
        timestamps.push(now);
        await docRef.set({
          timestamps,
          lastRequestedAt: now,
          emailHash: emailKey,
          updatedAt: new Date().toISOString(),
        });
        return;
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore record rate limit fallback to disk:", err.message);
      }
    }

    const store = this._readDisk();
    const entry = store.rateLimits[emailKey] || { timestamps: [], lastRequestedAt: 0 };
    const validTimestamps = (entry.timestamps || []).filter((t) => now - t < windowMs);
    validTimestamps.push(now);
    store.rateLimits[emailKey] = {
      timestamps: validTimestamps,
      lastRequestedAt: now,
    };
    this._writeDisk(store);
  }

  /**
   * Save a newly generated OTP session.
   * OTP is hashed before storage; plaintext OTP is NEVER saved.
   */
  async saveOtpSession(email, otp) {
    const emailKey = this._hashEmail(email);
    const salt = crypto.randomBytes(16).toString("hex");
    const otpHash = this.hashOtp(otp, salt);
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    const sessionData = {
      otpHash,
      salt,
      createdAt: now,
      expiresAt,
      failedAttempts: 0,
      lockedUntil: 0,
      consumed: false,
      normalizedEmail: this._normalizeEmail(email),
    };

    if (this.firestore) {
      try {
        await this.firestore.collection("auth_otp_sessions").doc(emailKey).set(sessionData);
        await this.recordOtpRequest(email);
        return { expiresAt, salt };
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore saveOtpSession fallback to disk:", err.message);
      }
    }

    const store = this._readDisk();
    store.otpSessions[emailKey] = sessionData;
    this._writeDisk(store);
    await this.recordOtpRequest(email);

    return { expiresAt, salt };
  }

  /**
   * Retrieves active OTP session for an email.
   */
  async getOtpSession(email) {
    const emailKey = this._hashEmail(email);

    if (this.firestore) {
      try {
        const doc = await this.firestore.collection("auth_otp_sessions").doc(emailKey).get();
        if (doc.exists) {
          return doc.data();
        }
        return null;
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore getOtpSession fallback to disk:", err.message);
      }
    }

    const store = this._readDisk();
    return store.otpSessions[emailKey] || null;
  }

  /**
   * Record a failed verification attempt.
   * If failed attempts reach 5, locks for 30 minutes.
   */
  async recordFailedAttempt(email) {
    const emailKey = this._hashEmail(email);
    const now = Date.now();
    const lockDurationMs = 30 * 60 * 1000; // 30 minutes
    const maxFailedAttempts = 5;

    const session = await this.getOtpSession(email);
    if (!session) return { attempts: 0, locked: false, remainingAttempts: 0 };

    const newAttempts = (session.failedAttempts || 0) + 1;
    const isLocked = newAttempts >= maxFailedAttempts;
    const lockedUntil = isLocked ? now + lockDurationMs : 0;

    const updated = {
      ...session,
      failedAttempts: newAttempts,
      lockedUntil,
    };

    if (this.firestore) {
      try {
        await this.firestore.collection("auth_otp_sessions").doc(emailKey).update({
          failedAttempts: newAttempts,
          lockedUntil,
        });
        return {
          attempts: newAttempts,
          locked: isLocked,
          lockedUntil,
          remainingAttempts: Math.max(0, maxFailedAttempts - newAttempts),
        };
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore recordFailedAttempt fallback to disk:", err.message);
      }
    }

    const store = this._readDisk();
    store.otpSessions[emailKey] = updated;
    this._writeDisk(store);

    return {
      attempts: newAttempts,
      locked: isLocked,
      lockedUntil,
      remainingAttempts: Math.max(0, maxFailedAttempts - newAttempts),
    };
  }

  /**
   * Immediately invalidates and marks the OTP session consumed.
   */
  async invalidateOtpSession(email) {
    const emailKey = this._hashEmail(email);

    if (this.firestore) {
      try {
        await this.firestore.collection("auth_otp_sessions").doc(emailKey).delete();
        return;
      } catch (err) {
        console.warn("[PersistentAuthStore] Firestore invalidateOtpSession fallback to disk:", err.message);
      }
    }

    const store = this._readDisk();
    delete store.otpSessions[emailKey];
    this._writeDisk(store);
  }
}

module.exports = new PersistentAuthStore();
