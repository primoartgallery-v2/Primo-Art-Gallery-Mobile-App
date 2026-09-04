const express = require("express");

const router = express.Router();

const getWooCommerceUrl = () => (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const getConsumerKey = () => process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const getConsumerSecret = () => process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

const ALLOWED_ORDERBY = new Set(["date", "id", "include", "title", "slug", "price", "popularity", "rating"]);
const ALLOWED_ORDER = new Set(["asc", "desc", "ASC", "DESC"]);

// GET /api/products
router.get(["/api/products", "/products"], async (req, res) => {
  const WOOCOMMERCE_URL = getWooCommerceUrl(); const CONSUMER_KEY = getConsumerKey(); const CONSUMER_SECRET = getConsumerSecret(); if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
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

  // Price filtering parameters
  const minPrice = req.query.min_price !== undefined && req.query.min_price !== null && req.query.min_price !== ""
    ? parseFloat(String(req.query.min_price))
    : null;
  const maxPrice = req.query.max_price !== undefined && req.query.max_price !== null && req.query.max_price !== ""
    ? parseFloat(String(req.query.max_price))
    : null;

  if (minPrice !== null && (isNaN(minPrice) || minPrice < 0)) {
    return res.status(400).json({ error: "Invalid min_price. Must be a non-negative number." });
  }
  if (maxPrice !== null && (isNaN(maxPrice) || maxPrice < 0)) {
    return res.status(400).json({ error: "Invalid max_price. Must be a non-negative number." });
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return res.status(400).json({ error: "min_price cannot be greater than max_price." });
  }

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
  if (minPrice !== null) {
    params.set("min_price", String(minPrice));
  }
  if (maxPrice !== null) {
    params.set("max_price", String(maxPrice));
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
    return res.status(502).json({ error: "Unable to connect to gallery service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/products/:id
router.get(["/api/products/:id", "/products/:id"], async (req, res) => {
  const WOOCOMMERCE_URL = getWooCommerceUrl(); const CONSUMER_KEY = getConsumerKey(); const CONSUMER_SECRET = getConsumerSecret(); if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
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
    return res.status(502).json({ error: "Unable to connect to gallery service." });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
