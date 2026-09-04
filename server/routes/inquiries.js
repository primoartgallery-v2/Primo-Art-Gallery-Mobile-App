const express = require("express");

const collectorStore = require("../services/collectorStore");
const emailService = require("../services/emailService");
const firebaseAdmin = require("../services/firebaseAdmin");
const distributedRateLimiter = require("../services/distributedRateLimiter");

const router = express.Router();

async function checkEnquiryRateLimit(ip, email) {
  const key = `${ip || "unknown"}_${(email || "").toLowerCase().trim()}`;
  return await distributedRateLimiter.checkRateLimit({
    bucket: "enquiry",
    key,
    limit: 5,
    windowSeconds: 3600,
    failMode: "fail-open",
  });
}

/**
 * POST /api/enquiries
 * Handles collector acquisition enquiries with strict server-side UID derivation,
 * input validation, anti-spam rate limiting, Firestore persistence, and Resend email dispatch.
 */
router.post(["/api/enquiries", "/enquiries"], async (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";

  // 1. Authenticated UID resolution (Zero-trust client UID)
  let collectorUid = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);
      if (verifiedUser && verifiedUser.uid) {
        collectorUid = verifiedUser.uid;
      }
    } catch {
      // Invalid token falls back to guest with null UID
      collectorUid = null;
    }
  }

  // 2. Input validation & sanitization
  const rawBody = req.body || {};

  // artworkId: required integer
  const artworkId = Number(rawBody.artworkId);
  if (!rawBody.artworkId || isNaN(artworkId) || artworkId <= 0) {
    return res.status(400).json({ error: "A valid numeric artworkId is required." });
  }

  // artworkTitle: required, 1-150 chars
  const artworkTitle = String(rawBody.artworkTitle || "").trim();
  if (!artworkTitle || artworkTitle.length < 1 || artworkTitle.length > 150) {
    return res.status(400).json({ error: "Artwork title is required (1-150 characters)." });
  }

  // collectorName: required, 2-80 chars
  const collectorName = String(rawBody.collectorName || "").trim();
  if (!collectorName || collectorName.length < 2 || collectorName.length > 80) {
    return res.status(400).json({ error: "Collector name is required (2-80 characters)." });
  }

  // collectorEmail: required valid email, 5-100 chars
  const collectorEmail = String(rawBody.collectorEmail || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !collectorEmail ||
    collectorEmail.length < 5 ||
    collectorEmail.length > 100 ||
    !emailRegex.test(collectorEmail)
  ) {
    return res.status(400).json({ error: "A valid email address is required (5-100 characters)." });
  }

  // collectorPhone: optional, max 25 chars
  const collectorPhone = rawBody.collectorPhone
    ? String(rawBody.collectorPhone).trim().slice(0, 25)
    : null;

  // message: required, 10-1000 chars
  const message = String(rawBody.message || "").trim();
  if (!message || message.length < 10 || message.length > 1000) {
    return res.status(400).json({ error: "Message is required (10-1000 characters)." });
  }

  // 3. Anti-Spam Rate Limiting (5 per hour)
  const rateLimit = await checkEnquiryRateLimit(clientIp, collectorEmail);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: "Enquiry limit exceeded. Maximum 5 enquiries allowed per hour. Please try again later.",
    });
  }

  // 4. Persistence to Firestore
  try {
    const result = await collectorStore.saveEnquiry({
      artworkId,
      artworkTitle,
      collectorUid,
      collectorName,
      collectorEmail,
      collectorPhone,
      message,
      clientIp,
    });

    // 5. Asynchronous Email Dispatch (non-blocking, failure caught gracefully)
    void emailService.sendArtworkEnquiryEmail(result.enquiry).catch((emailErr) => {
      console.error("[Enquiry API] Email dispatch notice:", emailErr.message);
    });

    return res.status(201).json({
      success: true,
      enquiryId: result.enquiryId,
      message: "Your acquisition enquiry has been received by Primo Art Gallery curators.",
    });
  } catch (err) {
    console.error("[Enquiry API] Save error:", err.message);
    return res.status(500).json({ error: "Failed to record enquiry. Please try again." });
  }
});

/**
 * GET /api/collector/enquiries
 * Retrieves all artwork acquisition enquiries for the authenticated user.
 * Authenticated UID is derived strictly from the verified Bearer token.
 * Rejects unauthenticated requests with 401.
 */
router.get(["/api/collector/enquiries", "/collector/enquiries"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access enquiries." });
  }

  try {
    const enquiries = await collectorStore.getEnquiries(verifiedUser.uid);
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (err) {
    console.error(`[Enquiry API] getEnquiries error for ${verifiedUser.uid}:`, err.message);
    return res.status(500).json({ error: "Failed to retrieve enquiries." });
  }
});

// ==========================================
// EXHIBITION VIP GUEST PASS & RSVP PIPELINE
// ==========================================

// Rate Limiter for Exhibition VIP RSVPs (Max 3 per rolling 1 hour per IP + Email)
async function checkExhibitionRsvpRateLimit(ip, email) {
  const key = `${ip || "unknown"}_${(email || "").toLowerCase()}`;
  return await distributedRateLimiter.checkRateLimit({
    bucket: "exhibition_rsvp",
    key,
    limit: 3,
    windowSeconds: 3600,
    failMode: "fail-open",
  });
}

// POST /api/exhibitions/rsvp
router.post(["/api/exhibitions/rsvp", "/exhibitions/rsvp"], async (req, res) => {
  const {
    exhibitionId,
    exhibitionTitle,
    exhibitionDates,
    exhibitionTimings,
    exhibitionVenue,
    collectorName,
    collectorEmail,
    collectorPhone,
    guestCount,
    message,
  } = req.body || {};

  // 1. Validate required fields
  if (!exhibitionId || isNaN(Number(exhibitionId))) {
    return res.status(400).json({ error: "Valid exhibition ID is required." });
  }

  if (
    !collectorName ||
    typeof collectorName !== "string" ||
    collectorName.trim().length < 2 ||
    collectorName.trim().length > 80
  ) {
    return res.status(400).json({ error: "Collector name must be between 2 and 80 characters." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !collectorEmail ||
    typeof collectorEmail !== "string" ||
    !emailRegex.test(collectorEmail.trim()) ||
    collectorEmail.trim().length < 5 ||
    collectorEmail.trim().length > 100
  ) {
    return res.status(400).json({ error: "A valid email address (5–100 characters) is required." });
  }

  const rawGuestCount =
    guestCount !== undefined && guestCount !== null && guestCount !== ""
      ? Number(guestCount)
      : 1;

  if (
    isNaN(rawGuestCount) ||
    rawGuestCount < 1 ||
    rawGuestCount > 4 ||
    !Number.isInteger(rawGuestCount)
  ) {
    return res.status(400).json({ error: "Guest count must be an integer between 1 and 4." });
  }
  const parsedGuestCount = rawGuestCount;

  if (message && (typeof message !== "string" || message.trim().length > 1000)) {
    return res.status(400).json({ error: "Optional message must not exceed 1000 characters." });
  }

  // 2. Cryptographic UID Derivation from Bearer Token (if present)
  let verifiedUid = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);
    if (verifiedUser && verifiedUser.uid) {
      verifiedUid = verifiedUser.uid;
    }
  }

  // 3. Rate Limiting Check (Max 3 per hour per IP + Email)
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const rateLimit = await checkExhibitionRsvpRateLimit(clientIp, collectorEmail);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: "You have exceeded the maximum allowed RSVP requests (3 per hour). Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  }

  // 4. Save Exhibition RSVP & generate VIP Pass
  try {
    const result = await collectorStore.saveExhibitionRsvp({
      exhibitionId: Number(exhibitionId),
      exhibitionTitle: exhibitionTitle
        ? String(exhibitionTitle).trim().slice(0, 150)
        : "The Emerging Perspectives",
      exhibitionDates: exhibitionDates
        ? String(exhibitionDates).trim().slice(0, 100)
        : "27–30 September 2026",
      exhibitionTimings: exhibitionTimings
        ? String(exhibitionTimings).trim().slice(0, 100)
        : "11:00 AM – 7:00 PM",
      exhibitionVenue: exhibitionVenue
        ? String(exhibitionVenue).trim().slice(0, 200)
        : "India Habitat Centre, Lodhi Road, New Delhi",
      collectorUid: verifiedUid,
      collectorName: String(collectorName).trim(),
      collectorEmail: String(collectorEmail).trim().toLowerCase(),
      collectorPhone: collectorPhone ? String(collectorPhone).trim().slice(0, 30) : null,
      guestCount: parsedGuestCount,
      message: message ? String(message).trim().slice(0, 1000) : "",
      clientIp,
    });

    // 5. Asynchronous Email Dispatch (non-blocking)
    void emailService.sendExhibitionRsvpEmails(result.pass).catch((emailErr) => {
      console.error("[Exhibition RSVP API] Email dispatch notice:", emailErr.message);
    });

    return res.status(201).json({
      success: true,
      rsvpId: result.rsvpId,
      passId: result.passId,
      pass: result.pass,
      message: "VIP Guest Pass confirmed. A confirmation has been sent to your email.",
    });
  } catch (err) {
    console.error("[Exhibition RSVP API] Save error:", err.message);
    return res.status(500).json({ error: "Failed to record exhibition RSVP. Please try again." });
  }
});

// GET /api/collector/exhibition-passes
router.get(
  ["/api/collector/exhibition-passes", "/collector/exhibition-passes"],
  async (req, res) => {
    const authHeader = req.headers.authorization;
    const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

    if (!verifiedUser || !verifiedUser.uid) {
      return res.status(401).json({ error: "Authentication required to access exhibition passes." });
    }

    try {
      const passes = await collectorStore.getExhibitionPasses(verifiedUser.uid);
      return res.json({ success: true, passes });
    } catch (err) {
      console.error(`[Exhibition Passes API] Error for ${verifiedUser.uid}:`, err.message);
      return res.status(500).json({ error: "Failed to retrieve exhibition passes." });
    }
  }
);

module.exports = router;
