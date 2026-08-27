const fs = require("fs");
const path = require("path");

class CollectorStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, "..", "data");
    this.firestore = null;
    this._ensureStorage();
  }

  setFirestore(db) {
    this.firestore = db;
    console.log("[CollectorStore] Firestore backend configured.");
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[CollectorStore] Storage initialization notice:", err.message);
    }
  }

  _getUserFilePath(uid) {
    const safeUid = String(uid).replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.dataDir, `collector_${safeUid}.json`);
  }

  _readUserDisk(uid) {
    try {
      this._ensureStorage();
      const filePath = this._getUserFilePath(uid);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
    } catch (err) {
      console.error(`[CollectorStore] Failed to read collector data for ${uid}:`, err.message);
    }
    return { wishlist: [], recentlyViewed: [], savedArtists: [] };
  }

  _writeUserDisk(uid, data) {
    try {
      this._ensureStorage();
      const filePath = this._getUserFilePath(uid);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`[CollectorStore] Failed to write collector data for ${uid}:`, err.message);
    }
  }

  // ==========================================
  // WISHLIST
  // ==========================================

  /**
   * Retrieves the UID-scoped wishlist items.
   */
  async getWishlist(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("wishlist");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.items || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getWishlist error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.wishlist || [];
  }

  /**
   * Saves UID-scoped wishlist items with deduplication by artwork ID.
   */
  async saveWishlist(uid, rawItems) {
    if (!uid) throw new Error("UID is required to save wishlist.");
    if (!Array.isArray(rawItems)) throw new Error("Wishlist items must be an array.");

    // Deduplicate and sanitize items
    const seenIds = new Set();
    const cleanItems = [];

    for (const item of rawItems) {
      if (!item || item.id === undefined || item.id === null) continue;
      const numId = Number(item.id);
      if (isNaN(numId) || seenIds.has(numId)) continue;
      seenIds.add(numId);

      cleanItems.push({
        id: numId,
        name: String(item.name || "Untitled Artwork").trim(),
        price: String(item.price || item.regular_price || ""),
        regular_price: item.regular_price ? String(item.regular_price) : undefined,
        images: Array.isArray(item.images)
          ? item.images.slice(0, 4).map((img) => ({
              id: Number(img.id || 0),
              src: String(img.src || ""),
              alt: img.alt ? String(img.alt) : undefined,
            }))
          : [],
        permalink: String(item.permalink || ""),
        artist: item.artist ? String(item.artist) : undefined,
        date_saved: item.date_saved || new Date().toISOString(),
      });
    }

    const payload = {
      items: cleanItems,
      updatedAt: new Date().toISOString(),
      itemCount: cleanItems.length,
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("wishlist");
        await docRef.set(payload, { merge: true });
        return { success: true, count: cleanItems.length };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveWishlist error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.wishlist = cleanItems;
    userData.wishlistUpdatedAt = payload.updatedAt;
    this._writeUserDisk(uid, userData);

    return { success: true, count: cleanItems.length };
  }

  // ==========================================
  // RECENTLY VIEWED ARTWORKS (MAX 20)
  // ==========================================

  /**
   * Retrieves the UID-scoped recently viewed artworks.
   */
  async getRecentlyViewed(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("recently_viewed");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.items || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getRecentlyViewed error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.recentlyViewed || [];
  }

  /**
   * Persists UID-scoped recently viewed artworks.
   * Enforces deduplication by ID, newest viewedAt order, and max 20 items.
   */
  async saveRecentlyViewed(uid, rawItems) {
    if (!uid) throw new Error("UID is required to save recently viewed items.");
    if (!Array.isArray(rawItems)) throw new Error("Recently viewed items must be an array.");

    // Deduplicate by ID preserving the newest viewedAt timestamp
    const itemMap = new Map();

    for (const item of rawItems) {
      if (!item || item.id === undefined || item.id === null) continue;
      const numId = Number(item.id);
      if (isNaN(numId)) continue;

      const cleanItem = {
        id: numId,
        name: String(item.name || "Untitled Artwork").trim(),
        price: String(item.price || item.regular_price || ""),
        imageUrl: String(item.imageUrl || (item.images?.[0]?.src) || ""),
        artist: String(item.artist || ""),
        viewedAt: item.viewedAt || new Date().toISOString(),
      };

      if (itemMap.has(numId)) {
        const existing = itemMap.get(numId);
        // Keep the newest timestamp
        if (new Date(cleanItem.viewedAt) > new Date(existing.viewedAt)) {
          itemMap.set(numId, cleanItem);
        }
      } else {
        itemMap.set(numId, cleanItem);
      }
    }

    // Sort descending by viewedAt and limit to 20 items
    const cleanItems = Array.from(itemMap.values())
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
      .slice(0, 20);

    const payload = {
      items: cleanItems,
      updatedAt: new Date().toISOString(),
      itemCount: cleanItems.length,
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("recently_viewed");
        await docRef.set(payload, { merge: true });
        return { success: true, count: cleanItems.length };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveRecentlyViewed error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.recentlyViewed = cleanItems;
    userData.recentlyViewedUpdatedAt = payload.updatedAt;
    this._writeUserDisk(uid, userData);

    return { success: true, count: cleanItems.length };
  }

  // ==========================================
  // SAVED / FOLLOWED ARTISTS
  // ==========================================

  /**
   * Retrieves UID-scoped saved artist IDs.
   */
  async getSavedArtists(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("saved_artists");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.artistIds || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getSavedArtists error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.savedArtists || [];
  }

  /**
   * Persists UID-scoped saved artist IDs with deduplication.
   */
  async saveSavedArtists(uid, rawArtistIds) {
    if (!uid) throw new Error("UID is required to save artists.");
    if (!Array.isArray(rawArtistIds)) throw new Error("Saved artists must be an array of IDs.");

    // Deduplicate and sanitize IDs
    const seen = new Set();
    const cleanIds = [];

    for (const rawId of rawArtistIds) {
      if (rawId === undefined || rawId === null) continue;
      const strId = String(rawId).trim();
      if (!strId || seen.has(strId)) continue;
      seen.add(strId);
      cleanIds.push(strId);
    }

    const payload = {
      artistIds: cleanIds,
      count: cleanIds.length,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("saved_artists");
        await docRef.set(payload, { merge: true });
        return { success: true, count: cleanIds.length, artistIds: cleanIds };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveSavedArtists error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.savedArtists = cleanIds;
    userData.savedArtistsUpdatedAt = payload.updatedAt;
    this._writeUserDisk(uid, userData);

    return { success: true, count: cleanIds.length, artistIds: cleanIds };
  }

  // ==========================================
  // ARTWORK ENQUIRIES (artworks_enquiries)
  // ==========================================

  /**
   * Persists an artwork acquisition enquiry to Firestore / local disk.
   */
  async saveEnquiry(enquiryData) {
    if (!enquiryData || !enquiryData.artworkId || !enquiryData.artworkTitle) {
      throw new Error("Invalid enquiry data payload.");
    }

    const enquiryId = `enq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      enquiryId,
      artworkId: Number(enquiryData.artworkId),
      artworkTitle: String(enquiryData.artworkTitle).trim(),
      collectorUid: enquiryData.collectorUid ? String(enquiryData.collectorUid).trim() : null,
      collectorName: String(enquiryData.collectorName).trim(),
      collectorEmail: String(enquiryData.collectorEmail).trim().toLowerCase(),
      collectorPhone: enquiryData.collectorPhone ? String(enquiryData.collectorPhone).trim() : null,
      message: String(enquiryData.message).trim(),
      status: "pending_review",
      createdAt: new Date().toISOString(),
      source: "mobile_app",
      clientIp: enquiryData.clientIp || "unknown",
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("artworks_enquiries").doc(enquiryId);
        await docRef.set(payload);
        return { success: true, enquiryId, enquiry: payload };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveEnquiry error, fallback to disk:`, err.message);
      }
    }

    // Disk fallback for local testing
    try {
      this._ensureStorage();
      const enquiriesFile = path.join(this.dataDir, "artworks_enquiries.json");
      let allEnquiries = [];
      if (fs.existsSync(enquiriesFile)) {
        try {
          allEnquiries = JSON.parse(fs.readFileSync(enquiriesFile, "utf8"));
        } catch {}
      }
      allEnquiries.push(payload);
      fs.writeFileSync(enquiriesFile, JSON.stringify(allEnquiries, null, 2), "utf8");
    } catch (diskErr) {
      console.error("[CollectorStore] Disk saveEnquiry notice:", diskErr.message);
    }

    return { success: true, enquiryId, enquiry: payload };
  }
}

const collectorStore = new CollectorStore();
module.exports = collectorStore;
