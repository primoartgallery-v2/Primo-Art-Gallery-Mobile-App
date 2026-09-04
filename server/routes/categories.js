const express = require("express");

const router = express.Router();

const getWooCommerceUrl = () => (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const getConsumerKey = () => process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const getConsumerSecret = () => process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

// GET /api/categories
router.get(["/api/categories", "/categories"], async (req, res) => {
  const WOOCOMMERCE_URL = getWooCommerceUrl(); const CONSUMER_KEY = getConsumerKey(); const CONSUMER_SECRET = getConsumerSecret(); if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
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
        "User-Agent": "PrimoArtGallery-App/1.0",
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
    return res.status(502).json({ error: "Unable to connect to category service." });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
