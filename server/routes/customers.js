const express = require("express");

const collectorStore = require("../services/collectorStore");
const firebaseAdmin = require("../services/firebaseAdmin");

const router = express.Router();

router.get(["/api/collector/wishlist", "/collector/wishlist"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access wishlist." });
  }

  try {
    const items = await collectorStore.getWishlist(verifiedUser.uid);
    return res.json({ success: true, items });
  } catch (err) {
    console.error("[Collector API] getWishlist error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve wishlist." });
  }
});

/**
 * POST /api/collector/wishlist
 * Persists wishlist items for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.post(["/api/collector/wishlist", "/collector/wishlist"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to update wishlist." });
  }

  const items = req.body?.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Items array is required." });
  }

  try {
    const result = await collectorStore.saveWishlist(verifiedUser.uid, items);
    return res.json({ success: true, count: result.count });
  } catch (err) {
    console.error("[Collector API] saveWishlist error:", err.message);
    return res.status(500).json({ error: "Failed to save wishlist." });
  }
});

/**
 * GET /api/collector/recently-viewed
 * Retrieves recently viewed artworks for the authenticated user (max 20).
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.get(["/api/collector/recently-viewed", "/collector/recently-viewed"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access recently viewed artworks." });
  }

  try {
    const items = await collectorStore.getRecentlyViewed(verifiedUser.uid);
    return res.json({ success: true, items });
  } catch (err) {
    console.error("[Collector API] getRecentlyViewed error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve recently viewed artworks." });
  }
});

/**
 * POST /api/collector/recently-viewed
 * Persists recently viewed artworks for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.post(["/api/collector/recently-viewed", "/collector/recently-viewed"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to update recently viewed artworks." });
  }

  const items = req.body?.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Items array is required." });
  }

  try {
    const result = await collectorStore.saveRecentlyViewed(verifiedUser.uid, items);
    return res.json({ success: true, count: result.count });
  } catch (err) {
    console.error("[Collector API] saveRecentlyViewed error:", err.message);
    return res.status(500).json({ error: "Failed to save recently viewed artworks." });
  }
});

/**
 * GET /api/collector/saved-artists
 * Retrieves list of saved artist IDs for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.get(["/api/collector/saved-artists", "/collector/saved-artists"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access saved artists." });
  }

  try {
    const artistIds = await collectorStore.getSavedArtists(verifiedUser.uid);
    return res.json({ success: true, artistIds });
  } catch (err) {
    console.error("[Collector API] getSavedArtists error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve saved artists." });
  }
});

/**
 * POST /api/collector/saved-artists
 * Persists list of saved artist IDs for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.post(["/api/collector/saved-artists", "/collector/saved-artists"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to update saved artists." });
  }

  const artistIds = req.body?.artistIds;
  if (!Array.isArray(artistIds)) {
    return res.status(400).json({ error: "artistIds array is required." });
  }

  try {
    const result = await collectorStore.saveSavedArtists(verifiedUser.uid, artistIds);
    return res.json({ success: true, count: result.count, artistIds: result.artistIds });
  } catch (err) {
    console.error("[Collector API] saveSavedArtists error:", err.message);
    return res.status(500).json({ error: "Failed to save saved artists." });
  }
});

/**
 * GET /api/collector/addresses
 * Retrieves saved shipping addresses for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.get(["/api/collector/addresses", "/collector/addresses"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access saved addresses." });
  }

  try {
    const addresses = await collectorStore.getAddresses(verifiedUser.uid);
    return res.json({ success: true, addresses });
  } catch (err) {
    console.error("[Collector API] getAddresses error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve addresses." });
  }
});

/**
 * POST /api/collector/addresses
 * Persists shipping addresses for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.post(["/api/collector/addresses", "/collector/addresses"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to update addresses." });
  }

  const addresses = req.body?.addresses;
  if (!Array.isArray(addresses)) {
    return res.status(400).json({ error: "Addresses array is required." });
  }

  try {
    const result = await collectorStore.saveAddresses(verifiedUser.uid, addresses);
    return res.json({ success: true, count: result.count, addresses: result.addresses });
  } catch (err) {
    console.error("[Collector API] saveAddresses error:", err.message);
    return res.status(500).json({ error: "Failed to save addresses." });
  }
});

/**
 * GET /api/collector/profile
 * Retrieves profile customization details for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.get(["/api/collector/profile", "/collector/profile"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to access collector profile." });
  }

  try {
    const profile = await collectorStore.getProfile(verifiedUser.uid);
    return res.json({ success: true, profile });
  } catch (err) {
    console.error("[Collector API] getProfile error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve collector profile." });
  }
});

/**
 * POST /api/collector/profile
 * Persists profile customization details for the authenticated user.
 * Authenticated UID is derived exclusively from the verified Bearer token.
 */
router.post(["/api/collector/profile", "/collector/profile"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const verifiedUser = await firebaseAdmin.verifyAuthToken(authHeader);

  if (!verifiedUser || !verifiedUser.uid) {
    return res.status(401).json({ error: "Authentication required to update collector profile." });
  }

  const profileData = req.body?.profile || req.body;
  if (!profileData || typeof profileData !== "object") {
    return res.status(400).json({ error: "Profile data object is required." });
  }

  try {
    const result = await collectorStore.saveProfile(verifiedUser.uid, profileData);
    return res.json({ success: true, profile: result.profile });
  } catch (err) {
    console.error("[Collector API] saveProfile error:", err.message);
    return res.status(500).json({ error: "Failed to save collector profile." });
  }
});


module.exports = router;
