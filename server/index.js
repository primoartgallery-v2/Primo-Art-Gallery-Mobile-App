const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config(); // Also check root .env if present
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;
const WOOCOMMERCE_URL = (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

if (!WOOCOMMERCE_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error("FATAL: Missing required environment variables (WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET).");
  process.exit(1);
}

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
    methods: ["GET", "OPTIONS"],
  })
);

app.use(express.json());

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

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /api/products
app.get("/api/products", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 10));
  const category = req.query.category ? String(req.query.category).trim() : null;
  const exclude = req.query.exclude ? String(req.query.exclude).trim() : null;
  const search = req.query.search ? String(req.query.search).trim() : null;
  const orderby = req.query.orderby ? String(req.query.orderby).trim() : null;
  const order = req.query.order ? String(req.query.order).trim() : null;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.set("status", "publish");

  if (category && /^\d+$/.test(category)) {
    params.set("category", category);
  }
  if (exclude && /^[\d,]+$/.test(exclude)) {
    params.set("exclude", exclude);
  }
  if (search) {
    params.set("search", search);
  }
  if (orderby) {
    params.set("orderby", orderby);
  }
  if (order) {
    params.set("order", order);
  }

  // Fallback support for query auth if Basic Auth is filtered by hosting
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
        Authorization: getAuthHeader(),
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
app.get("/api/products/:id", async (req, res) => {
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
        Authorization: getAuthHeader(),
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

// GET /api/artists/:id
app.get("/api/artists/:id", async (req, res) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid artist ID." });
  }

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wp/v2/artists/${id}`;

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
app.get("/api/categories", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`[Primo Proxy] Running securely on port ${PORT}`);
});
