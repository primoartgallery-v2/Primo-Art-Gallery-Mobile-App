const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config(); // Also check root .env if present
const express = require("express");
const cors = require("cors");

const persistentAuthStore = require("./services/persistentAuthStore");
const firebaseAdmin = require("./services/firebaseAdmin");
const distributedRateLimiter = require("./services/distributedRateLimiter");
const auctionEventService = require("./services/auctionEventService");
const pushNotificationService = require("./services/pushNotificationService");

const { KNOWN_INSECURE_SECRETS, validateProductionSecrets } = require("./utils/secrets");
const { parseAuctionLot } = require("./utils/auctionParser");
const { rateLimiter } = require("./middleware/rateLimiter");

// Decomposed Route Modules
const authRouter = require("./routes/auth");
const customersRouter = require("./routes/customers");
const notificationsRouter = require("./routes/notifications");
const inquiriesRouter = require("./routes/inquiries");
const auctionsRouter = require("./routes/auctions");
const coaRouter = require("./routes/coa");
const productsRouter = require("./routes/products");
const artistsRouter = require("./routes/artists");
const categoriesRouter = require("./routes/categories");

// Initialize Firebase Admin on startup
firebaseAdmin.initFirebaseAdmin();

// Enforce production security invariants on startup
validateProductionSecrets(process.env);

const app = express();
// Enable single-hop reverse proxy trust for Render / Cloudflare infrastructure
app.set("trust proxy", 1);

const PORT = process.env.PORT || 4000;
const getWooCommerceUrl = () => (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const getConsumerKey = () => process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const getConsumerSecret = () => process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

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

// Global Proxy Rate Limiter (120 requests per rolling 60 seconds per IP, Fail-Open to bounded memory)
app.use(rateLimiter);

// Health check endpoint for Render & container monitoring
app.get(["/health", "/api/health"], (_req, res) => {
  const wcUrl = getWooCommerceUrl();
  const cKey = getConsumerKey();
  const cSec = getConsumerSecret();
  res.json({
    status: "ok",
    service: "Primo Art Gallery Proxy & Auth Server",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      auth: "ready",
      woocommerce: Boolean(wcUrl && cKey && cSec) ? "ready" : "unconfigured",
      email: Boolean(process.env.RESEND_API_KEY) ? "ready" : "unconfigured",
      storage: persistentAuthStore.useFirestore ? "firestore" : "persistent_disk",
    },
  });
});

// Mount Decomposed Routers in Authoritative Order
app.use(authRouter);
app.use(customersRouter);
app.use(notificationsRouter);
app.use(inquiriesRouter);
app.use(auctionsRouter);
app.use(coaRouter);
app.use(productsRouter);
app.use(artistsRouter);
app.use(categoriesRouter);

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

// Preserve exact exported app properties for authoritative test suites
app.validateProductionSecrets = validateProductionSecrets;
app.KNOWN_INSECURE_SECRETS = KNOWN_INSECURE_SECRETS;
app.distributedRateLimiter = distributedRateLimiter;
app.auctionEventService = auctionEventService;
app.pushNotificationService = pushNotificationService;
app.parseAuctionLot = parseAuctionLot;

module.exports = app;

