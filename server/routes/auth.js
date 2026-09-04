const express = require("express");
const crypto = require("crypto");

const persistentAuthStore = require("../services/persistentAuthStore");
const emailService = require("../services/emailService");
const firebaseAdmin = require("../services/firebaseAdmin");
const distributedRateLimiter = require("../services/distributedRateLimiter");

const router = express.Router();

router.get(["/api/auth/health", "/api/api/auth/health", "/auth/health"], (_req, res) => {
  res.json({ status: "ok", service: "Primo Art Gallery Auth Service", timestamp: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * POST /api/auth/send-otp
 * Generates and sends a 6-digit OTP via Resend with strict persistent rate limiting.
 */
router.post(["/api/auth/send-otp", "/api/api/auth/send-otp", "/auth/send-otp"], async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const email = rawEmail.trim().toLowerCase();
    console.log(`[Auth API] 📩 Received send-otp request for email: ${email}`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email format." });
    }

    // Check persistent rate limiting (60s cooldown & max 5 requests / 24h)
    const rateCheck = await persistentAuthStore.checkRateLimit(email);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.message,
        reason: rateCheck.reason,
        remainingSeconds: rateCheck.remainingSeconds,
        remainingMinutes: rateCheck.remainingMinutes,
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Persist hashed OTP session (never plaintext)
    await persistentAuthStore.saveOtpSession(email, otp);

    // Send email via Resend
    await emailService.sendOtpEmail({ email, otpCode: otp });

    return res.json({
      success: true,
      message: "A 6-digit verification code has been sent to your email.",
      expiresInSeconds: 600, // 10 minutes
    });
  } catch (err) {
    console.error("[Auth API] send-otp error:", err.message);
    return res.status(500).json({ error: "Failed to send verification code. Please try again." });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verifies 6-digit OTP, handles attempt limits and temporary lockouts,
 * invalidates OTP immediately on success, and returns a Firebase Custom Token.
 */
router.post(["/api/auth/verify-otp", "/api/api/auth/verify-otp", "/auth/verify-otp"], async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawOtp = req.body?.otp;

    if (!rawEmail || !rawOtp) {
      return res.status(400).json({ error: "Email and 6-digit verification code are required." });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const otp = String(rawOtp).trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Verification code must be exactly 6 digits." });
    }

    const session = await persistentAuthStore.getOtpSession(email);
    if (!session || session.consumed) {
      return res.status(400).json({
        error: "No active verification code found. Please request a new code.",
      });
    }

    const now = Date.now();

    // Check if account is temporarily locked (5 failed attempts -> 30 min lockout)
    if (session.lockedUntil && now < session.lockedUntil) {
      const remainingLockMinutes = Math.ceil((session.lockedUntil - now) / (60 * 1000));
      return res.status(423).json({
        error: `Verification is temporarily locked due to too many failed attempts. Please try again in ${remainingLockMinutes} minutes.`,
        locked: true,
        remainingMinutes: remainingLockMinutes,
      });
    }

    // Check if code has expired (10 minutes validity)
    if (now > session.expiresAt) {
      await persistentAuthStore.invalidateOtpSession(email);
      return res.status(400).json({
        error: "This verification code has expired. Please request a new code.",
        expired: true,
      });
    }

    // Constant-time hash verification
    const isValid = persistentAuthStore.verifyOtpHash(otp, session.otpHash, session.salt);

    if (!isValid) {
      const attemptResult = await persistentAuthStore.recordFailedAttempt(email);
      if (attemptResult.locked) {
        return res.status(423).json({
          error: "Incorrect code. Maximum attempts exceeded. Verification is locked for 30 minutes.",
          locked: true,
          remainingMinutes: 30,
        });
      }
      return res.status(400).json({
        error: `Incorrect code. ${attemptResult.remainingAttempts} attempt(s) remaining.`,
        remainingAttempts: attemptResult.remainingAttempts,
      });
    }

    console.log("[Auth API] OTP HASH VERIFIED");

    // OTP is valid! Immediately invalidate it (single-use guarantee)
    await persistentAuthStore.invalidateOtpSession(email);
    console.log("[Auth API] OTP SESSION INVALIDATED");

    // Optional registration payload (password, fullName, phone)
    const rawPassword = req.body?.password;
    const rawFullName = req.body?.fullName;
    const rawPhone = req.body?.phone;

    const extraData = {};
    if (rawFullName && typeof rawFullName === "string" && rawFullName.trim()) {
      extraData.displayName = rawFullName.trim();
    }

    // Resolve or create canonical user via Firebase Admin Identity Authority
    console.log("[Auth API] FIREBASE USER RESOLUTION START");
    const user = await firebaseAdmin.getOrCreateUserByEmail(email, extraData);
    console.log(`[Auth API] FIREBASE USER RESOLUTION SUCCESS (uid: ${user.uid})`);

    // If password provided during registration, set it securely in Firebase Auth (scrypt)
    if (rawPassword && typeof rawPassword === "string" && rawPassword.length >= 8) {
      try {
        await firebaseAdmin.setUserPassword(user.uid, rawPassword);
      } catch (pwErr) {
        console.warn("[Auth API] Set initial password notice:", pwErr.message);
      }
    }

    // Mint Firebase Custom Token
    console.log("[Auth API] CUSTOM TOKEN GENERATION START");
    const customToken = await firebaseAdmin.createCustomTokenForUser(user.uid, {
      authMethod: "email_otp",
    });
    console.log("[Auth API] CUSTOM TOKEN GENERATION SUCCESS");

    const collectorProfile = {
      id: user.uid,
      email: user.email,
      first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      last_name: user.displayName && user.displayName.split(" ").length > 1
        ? user.displayName.split(" ").slice(1).join(" ")
        : "",
      username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, ""),
      role: "customer",
      billing: {
        email: user.email,
        first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
        phone: typeof rawPhone === "string" ? rawPhone.trim() : "",
      },
      avatar_url: user.photoURL || "avatar_1",
      date_created: user.createdAt,
    };

    console.log("[Auth API] VERIFY OTP COMPLETE");

    return res.json({
      success: true,
      customToken,
      user: collectorProfile,
    });
  } catch (err) {
    console.error("[Auth API] verify-otp ERROR DETAILS:", {
      name: err.name,
      code: err.code,
      message: err.message,
      stack: err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : undefined,
    });
    return res.status(500).json({ error: "Failed to verify code. Please try again." });
  }
});

/**
 * POST /api/auth/login-password
 * Authenticates user via Firebase Authentication email + password flow.
 * On success, mints a Firebase Custom Token and returns canonical collector profile.
 */
router.post(["/api/auth/login-password", "/api/api/auth/login-password", "/auth/login-password"], async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;

    if (!rawEmail || !rawPassword) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const password = String(rawPassword);

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    // 1. Check account lockout due to repeated password failures
    const lockCheck = await distributedRateLimiter.isLocked({
      bucket: "login_password",
      key: email,
    });

    if (lockCheck.locked) {
      const remainingMinutes = Math.ceil((lockCheck.remainingSeconds || 900) / 60);
      return res.status(423).json({
        error: `Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        locked: true,
        remainingMinutes,
      });
    }

    const verifyResult = await firebaseAdmin.verifyPassword(email, password);

    if (!verifyResult.success) {
      const failResult = await distributedRateLimiter.recordFailure({
        bucket: "login_password",
        key: email,
        maxFailures: 5,
        lockoutSeconds: 900, // 15 minutes
      });

      if (failResult.locked) {
        return res.status(423).json({
          error: "Account has been temporarily locked for 15 minutes due to 5 consecutive failed login attempts.",
          locked: true,
          remainingMinutes: 15,
        });
      }

      return res.status(401).json({
        error: verifyResult.error || "Invalid email or password.",
        remainingAttempts: failResult.remainingAttempts,
        isOtpOnlyUser: verifyResult.isOtpOnlyUser || false,
      });
    }

    // Clear failure counter upon successful login
    await distributedRateLimiter.clearFailure({
      bucket: "login_password",
      key: email,
    });

    // User authenticated successfully! Fetch/ensure user profile
    const user = await firebaseAdmin.getOrCreateUserByEmail(email);

    // Mint Firebase Custom Token
    const customToken = await firebaseAdmin.createCustomTokenForUser(user.uid, {
      authMethod: "email_password",
    });

    const collectorProfile = {
      id: user.uid,
      email: user.email,
      first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      last_name: user.displayName && user.displayName.split(" ").length > 1
        ? user.displayName.split(" ").slice(1).join(" ")
        : "",
      username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, ""),
      role: "customer",
      billing: {
        email: user.email,
        first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      },
      avatar_url: user.photoURL || "avatar_1",
      date_created: user.createdAt,
    };

    return res.json({
      success: true,
      customToken,
      user: collectorProfile,
    });
  } catch (err) {
    console.error("[Auth API] login-password error:", err.message);
    return res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

/**
 * POST /api/auth/reset-password
 * Verifies 6-digit OTP and updates user's password in Firebase Authentication.
 */
router.post(["/api/auth/reset-password", "/api/api/auth/reset-password", "/auth/reset-password"], async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawOtp = req.body?.otp;
    const rawNewPassword = req.body?.newPassword;

    if (!rawEmail || !rawOtp || !rawNewPassword) {
      return res.status(400).json({ error: "Email, verification code, and new password are required." });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const otp = String(rawOtp).trim();
    const newPassword = String(rawNewPassword);

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Verification code must be exactly 6 digits." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    const session = await persistentAuthStore.getOtpSession(email);
    if (!session || session.consumed) {
      return res.status(400).json({
        error: "No active verification code found. Please request a new code.",
      });
    }

    const now = Date.now();
    if (session.lockedUntil && now < session.lockedUntil) {
      const remainingLockMinutes = Math.ceil((session.lockedUntil - now) / (60 * 1000));
      return res.status(423).json({
        error: `Verification is temporarily locked due to too many failed attempts. Please try again in ${remainingLockMinutes} minutes.`,
        locked: true,
        remainingMinutes: remainingLockMinutes,
      });
    }

    if (now > session.expiresAt) {
      await persistentAuthStore.invalidateOtpSession(email);
      return res.status(400).json({
        error: "This verification code has expired. Please request a new code.",
        expired: true,
      });
    }

    const isValid = persistentAuthStore.verifyOtpHash(otp, session.otpHash, session.salt);
    if (!isValid) {
      const attemptResult = await persistentAuthStore.recordFailedAttempt(email);
      if (attemptResult.locked) {
        return res.status(423).json({
          error: "Incorrect code. Maximum attempts exceeded. Verification is locked for 30 minutes.",
          locked: true,
          remainingMinutes: 30,
        });
      }
      return res.status(400).json({
        error: `Incorrect code. ${attemptResult.remainingAttempts} attempt(s) remaining.`,
        remainingAttempts: attemptResult.remainingAttempts,
      });
    }

    // Invalidate OTP immediately
    await persistentAuthStore.invalidateOtpSession(email);

    // Get or create canonical user
    const user = await firebaseAdmin.getOrCreateUserByEmail(email);

    // Set new password securely in Firebase Auth
    await firebaseAdmin.setUserPassword(user.uid, newPassword);

    // Mint Firebase Custom Token
    const customToken = await firebaseAdmin.createCustomTokenForUser(user.uid, {
      authMethod: "password_reset",
    });

    const collectorProfile = {
      id: user.uid,
      email: user.email,
      first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      last_name: user.displayName && user.displayName.split(" ").length > 1
        ? user.displayName.split(" ").slice(1).join(" ")
        : "",
      username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, ""),
      role: "customer",
      billing: {
        email: user.email,
        first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      },
      avatar_url: user.photoURL || "avatar_1",
      date_created: user.createdAt,
    };

    return res.json({
      success: true,
      message: "Password reset successfully.",
      customToken,
      user: collectorProfile,
    });
  } catch (err) {
    console.error("[Auth API] reset-password error:", err.message);
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

/**
 * POST /api/auth/google-verify
 * Verifies Google ID token server-side, unifies identity with existing email user,
 * and returns Firebase Custom Token for the canonical UID.
 */
router.post(["/api/auth/google-verify", "/api/api/auth/google-verify", "/auth/google-verify"], async (req, res) => {
  try {
    const idToken = req.body?.idToken;
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "Google ID token is required." });
    }

    const googleData = await firebaseAdmin.verifyGoogleIdToken(idToken);
    const user = await firebaseAdmin.getOrCreateUserByEmail(googleData.email, {
      displayName: googleData.displayName,
      photoURL: googleData.photoURL,
    });

    const customToken = await firebaseAdmin.createCustomTokenForUser(user.uid, {
      authMethod: "google",
    });

    const collectorProfile = {
      id: user.uid,
      email: user.email,
      first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      last_name: user.displayName && user.displayName.split(" ").length > 1
        ? user.displayName.split(" ").slice(1).join(" ")
        : "",
      username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, ""),
      role: "customer",
      billing: {
        email: user.email,
        first_name: user.displayName ? user.displayName.split(" ")[0] : "Collector",
      },
      avatar_url: user.photoURL || "avatar_1",
      date_created: user.createdAt,
    };

    return res.json({
      success: true,
      customToken,
      user: collectorProfile,
    });
  } catch (err) {
    console.error("[Auth API] google-verify error:", err.message);
    return res.status(401).json({ error: "Google authentication verification failed." });
  }
});/**
 * POST /api/auth/session-token
 * Exchanges a Firebase Custom Token for authoritative Firebase ID & Refresh Tokens.
 * Rate-limited per IP (Max 10 req/5min, fail-closed) with strict payload validation.
 */
router.post("/api/auth/session-token", async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || "unknown_ip";

  const rateLimit = await distributedRateLimiter.checkRateLimit({
    bucket: "auth_session_token",
    key: clientIp,
    limit: 10,
    windowSeconds: 300,
    failMode: "fail-closed",
  });

  if (!rateLimit.allowed) {
    if (rateLimit.error) {
      return res.status(503).json({
        error: "Rate limiter service unavailable. Please try again later.",
        code: "SERVICE_UNAVAILABLE",
      });
    }
    return res.status(429).json({
      error: `Too many session requests. Please try again in ${rateLimit.resetSeconds} seconds.`,
      code: "RATE_LIMITED",
    });
  }

  const customToken = req.body?.customToken;
  if (!customToken || typeof customToken !== "string" || customToken.trim().length === 0 || customToken.length > 4096) {
    return res.status(400).json({ error: "A valid custom token is required.", code: "INVALID_ARGUMENT" });
  }

  try {
    const session = await firebaseAdmin.exchangeCustomTokenForSession(customToken);
    if (!session.success || !session.idToken) {
      const statusCode = session.status || 401;
      return res.status(statusCode).json({
        error: session.error || "Failed to exchange session token.",
        code: session.code || "INVALID_TOKEN",
      });
    }

    return res.json({
      success: true,
      idToken: session.idToken,
      refreshToken: session.refreshToken || null,
      expiresIn: session.expiresIn || 3600,
    });
  } catch {
    return res.status(503).json({
      error: "Authentication service is currently unavailable. Please try again later.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
});

/**
 * POST /api/auth/refresh-token
 * Refreshes an expired Firebase ID Token using the Refresh Token.
 * Rate-limited per IP (Max 30 req/5min, fail-closed) with strict payload validation.
 */
router.post("/api/auth/refresh-token", async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || "unknown_ip";

  const rateLimit = await distributedRateLimiter.checkRateLimit({
    bucket: "auth_refresh_token",
    key: clientIp,
    limit: 30,
    windowSeconds: 300,
    failMode: "fail-closed",
  });

  if (!rateLimit.allowed) {
    if (rateLimit.error) {
      return res.status(503).json({
        error: "Rate limiter service unavailable. Please try again later.",
        code: "SERVICE_UNAVAILABLE",
      });
    }
    return res.status(429).json({
      error: `Too many token refresh requests. Please try again in ${rateLimit.resetSeconds} seconds.`,
      code: "RATE_LIMITED",
    });
  }

  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim().length === 0 || refreshToken.length > 4096) {
    return res.status(400).json({ error: "A valid refresh token is required.", code: "INVALID_ARGUMENT" });
  }

  try {
    const refreshed = await firebaseAdmin.refreshFirebaseIdToken(refreshToken);
    if (!refreshed.success || !refreshed.idToken) {
      const statusCode = refreshed.status || 401;
      return res.status(statusCode).json({
        error: refreshed.error || "Invalid or expired session refresh token.",
        code: refreshed.code || "INVALID_TOKEN",
      });
    }

    return res.json({
      success: true,
      idToken: refreshed.idToken,
      refreshToken: refreshed.refreshToken || refreshToken,
      expiresIn: refreshed.expiresIn || 3600,
    });
  } catch {
    return res.status(503).json({
      error: "Authentication service is currently unavailable. Please try again later.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
});

module.exports = router;
