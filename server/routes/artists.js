const express = require("express");

const router = express.Router();

const getWooCommerceUrl = () => (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");

// GET /api/artists
router.get(["/api/artists", "/artists"], async (req, res) => {
  const WOOCOMMERCE_URL = getWooCommerceUrl(); if (!WOOCOMMERCE_URL) {
    return res.status(503).json({ error: "Gallery proxy configuration pending." });
  }

  const targetUrl = `${WOOCOMMERCE_URL}/wp-json/wp/v2/artists?per_page=100&_embed=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
    return res.status(502).json({ error: "Unable to connect to artists service." });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/artists/:id
router.get(["/api/artists/:id", "/artists/:id"], async (req, res) => {
  const WOOCOMMERCE_URL = getWooCommerceUrl(); if (!WOOCOMMERCE_URL) {
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

module.exports = router;
