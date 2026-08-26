const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config(); // Also check root .env if present
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const persistentAuthStore = require("./services/persistentAuthStore");
const emailService = require("./services/emailService");
const firebaseAdmin = require("./services/firebaseAdmin");

// Initialize Firebase Admin on startup
firebaseAdmin.initFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 4000;
const WOOCOMMERCE_URL = (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
    exposedHeaders: ["x-wp-total", "x-wp-totalpages"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json());

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[HTTP ${req.method}] ${req.url} - IP: ${req.ip}`);
  next();
});

// Basic In-Memory Rate Limiter (120 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const clientData = rateLimitMap.get(ip);

  if (!clientData || now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { startTime: now, count: 1 });
    return next();
  }

  clientData.count += 1;
  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  next();
}

app.use(rateLimiter);

// Helper for Basic Auth header
function getAuthHeader() {
  const token = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

// Health check endpoint for Render & container monitoring
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "ok",
    service: "Primo Art Gallery Proxy & Auth Server",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      auth: "ready",
      woocommerce: Boolean(WOOCOMMERCE_URL && CONSUMER_KEY && CONSUMER_SECRET) ? "ready" : "unconfigured",
      email: Boolean(process.env.RESEND_API_KEY) ? "ready" : "unconfigured",
      storage: persistentAuthStore.useFirestore ? "firestore" : "persistent_disk",
    },
  });
});

app.get(["/api/auth/health", "/api/api/auth/health", "/auth/health"], (_req, res) => {
  res.json({ status: "ok", service: "Primo Art Gallery Auth Service", timestamp: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * POST /api/auth/send-otp
 * Generates and sends a 6-digit OTP via Resend with strict persistent rate limiting.
 */
app.post(["/api/auth/send-otp", "/api/api/auth/send-otp", "/auth/send-otp"], async (req, res) => {
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
app.post(["/api/auth/verify-otp", "/api/api/auth/verify-otp", "/auth/verify-otp"], async (req, res) => {
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

    // OTP is valid! Immediately invalidate it (single-use guarantee)
    await persistentAuthStore.invalidateOtpSession(email);

    // Optional registration payload (password, fullName, phone)
    const rawPassword = req.body?.password;
    const rawFullName = req.body?.fullName;
    const rawPhone = req.body?.phone;

    const extraData = {};
    if (rawFullName && typeof rawFullName === "string" && rawFullName.trim()) {
      extraData.displayName = rawFullName.trim();
    }

    // Resolve or create canonical user via Firebase Admin Identity Authority
    const user = await firebaseAdmin.getOrCreateUserByEmail(email, extraData);

    // If password provided during registration, set it securely in Firebase Auth (scrypt)
    if (rawPassword && typeof rawPassword === "string" && rawPassword.length >= 8) {
      try {
        await firebaseAdmin.setUserPassword(user.uid, rawPassword);
      } catch (pwErr) {
        console.warn("[Auth API] Set initial password notice:", pwErr.message);
      }
    }

    // Mint Firebase Custom Token
    const customToken = await firebaseAdmin.createCustomTokenForUser(user.uid, {
      authMethod: "email_otp",
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
        phone: typeof rawPhone === "string" ? rawPhone.trim() : "",
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
    console.error("[Auth API] verify-otp error:", err.message);
    return res.status(500).json({ error: "Failed to verify code. Please try again." });
  }
});

/**
 * POST /api/auth/login-password
 * Authenticates user via Firebase Authentication email + password flow.
 * On success, mints a Firebase Custom Token and returns canonical collector profile.
 */
app.post(["/api/auth/login-password", "/api/api/auth/login-password", "/auth/login-password"], async (req, res) => {
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

    const verifyResult = await firebaseAdmin.verifyPassword(email, password);

    if (!verifyResult.success) {
      return res.status(401).json({
        error: verifyResult.error || "Invalid email or password.",
        isOtpOnlyUser: verifyResult.isOtpOnlyUser || false,
      });
    }

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
app.post(["/api/auth/reset-password", "/api/api/auth/reset-password", "/auth/reset-password"], async (req, res) => {
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
app.post(["/api/auth/google-verify", "/api/api/auth/google-verify", "/auth/google-verify"], async (req, res) => {
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
});

// ==========================================
// WOOCOMMERCE PROXY ENDPOINTS (HARDENED)
// ==========================================

const ALLOWED_ORDERBY = new Set(["date", "id", "include", "title", "slug", "price", "popularity", "rating"]);
const ALLOWED_ORDER = new Set(["asc", "desc", "ASC", "DESC"]);

// GET /api/products
app.get(["/api/products", "/products"], async (req, res) => {
  if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  // Strict input validation
  const page = Math.min(1000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 10));
  const category = req.query.category ? String(req.query.category).trim() : null;
  const exclude = req.query.exclude ? String(req.query.exclude).trim() : null;
  const search = req.query.search ? String(req.query.search).trim().slice(0, 100) : null;
  const orderby = req.query.orderby ? String(req.query.orderby).trim().toLowerCase() : null;
  const order = req.query.order ? String(req.query.order).trim().toLowerCase() : null;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.set("status", "publish");

  if (category && /^\d+(,\d+)*$/.test(category)) {
    params.set("category", category);
  }
  if (exclude && /^\d+(,\d+)*$/.test(exclude)) {
    params.set("exclude", exclude);
  }
  if (search && search.length > 0) {
    params.set("search", search);
  }
  if (orderby && ALLOWED_ORDERBY.has(orderby)) {
    params.set("orderby", orderby);
  }
  if (order && ALLOWED_ORDER.has(order)) {
    params.set("order", order);
  }

  params.set("consumer_key", CONSUMER_KEY);
  params.set("consumer_secret", CONSUMER_SECRET);

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PrimoArtGallery-App/1.0",
      },
      signal: controller.signal,
    });

    const total = upstreamRes.headers.get("x-wp-total");
    const totalPages = upstreamRes.headers.get("x-wp-totalpages");

    if (total) res.setHeader("x-wp-total", total);
    if (totalPages) res.setHeader("x-wp-totalpages", totalPages);

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: "Failed to fetch artworks from gallery server.",
        status: upstreamRes.status,
      });
    }

    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Upstream request timed out." });
    }
    return res.status(502).json({ error: "Unable to connect to gallery service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/products/:id
app.get(["/api/products/:id", "/products/:id"], async (req, res) => {
  if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid product ID." });
  }

  const params = new URLSearchParams({
    consumer_key: CONSUMER_KEY,
    consumer_secret: CONSUMER_SECRET,
  });

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products/${id}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PrimoArtGallery-App/1.0",
      },
      signal: controller.signal,
    });

    if (upstreamRes.status === 404) {
      return res.status(404).json({ error: "Artwork not found." });
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: "Failed to fetch artwork details.",
        status: upstreamRes.status,
      });
    }

    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Upstream request timed out." });
    }
    return res.status(502).json({ error: "Unable to connect to gallery service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/artists
app.get(["/api/artists", "/artists"], async (req, res) => {
  if (!WOOCOMMERCE_URL) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wp/v2/artists?per_page=100&_embed=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: "Failed to fetch artists from gallery server.",
        status: upstreamRes.status,
      });
    }

    const rawData = await upstreamRes.json();
    const parsed = rawData
      .map((item) => ({
        id: item.id,
        name:
          item.title?.rendered
            ?.replace(/&amp;/g, "&")
            ?.replace(/&#0*39;/g, "'")
            ?.replace(/&quot;/g, '"') || "Artist",
        slug: item.slug,
        link: item.link,
        imageUrl: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
        category: item._embedded?.["wp:term"]?.[0]?.[0]?.name || "Contemporary Artist",
        bio:
          item.content?.rendered
            ?.replace(/<[^>]*>/g, "")
            ?.replace(/&nbsp;/g, " ")
            ?.replace(/&amp;/g, "&")
            ?.replace(/&#0*39;/g, "'")
            ?.trim() || "",
      }))
      .filter((a) => a.name !== "." && a.name.trim().length > 0);

    return res.json(parsed);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Artists request timed out." });
    }
    return res.status(502).json({ error: "Unable to connect to artists service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/artists/:id
app.get(["/api/artists/:id", "/artists/:id"], async (req, res) => {
  if (!WOOCOMMERCE_URL) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid artist ID." });
  }

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wp/v2/artists/${id}?_embed=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (upstreamRes.status === 404) {
      return res.status(404).json({ error: "Artist not found." });
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: "Failed to fetch artist details.",
        status: upstreamRes.status,
      });
    }

    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Artist request timed out." });
    }
    return res.status(502).json({ error: "Unable to connect to artist service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/categories
app.get(["/api/categories", "/categories"], async (req, res) => {
  if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  const params = new URLSearchParams({
    per_page: "100",
    hide_empty: "true",
    consumer_key: CONSUMER_KEY,
    consumer_secret: CONSUMER_SECRET,
  });

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products/categories?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: getAuthHeader(),
      },
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: "Failed to fetch categories.",
        status: upstreamRes.status,
      });
    }

    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Upstream request timed out." });
    }
    return res.status(502).json({ error: "Unable to connect to category service." });
  } finally {
    clearTimeout(timeout);
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Primo Proxy & Auth Server] Running securely on port ${PORT}`);

    // Auto-initialize public tunnel for mobile device access
    try {
      const localtunnel = require("localtunnel");
      const initTunnel = async () => {
        try {
          const tunnel = await localtunnel({ port: PORT, subdomain: "primo-gallery-auth" });
          console.log(`[Public Tunnel] 🌐 Active Public HTTPS URL: ${tunnel.url}`);
          tunnel.on("close", () => {
            console.log("[Public Tunnel] Tunnel closed. Reconnecting in 5s...");
            setTimeout(initTunnel, 5000);
          });
          tunnel.on("error", (tErr) => {
            console.warn("[Public Tunnel] Tunnel error:", tErr.message);
          });
        } catch (err) {
          console.warn("[Public Tunnel] Tunnel init notice:", err.message);
          setTimeout(initTunnel, 10000);
        }
      };
      initTunnel();
    } catch {
      // Optional in cloud production
    }
  });
}

module.exports = app;
