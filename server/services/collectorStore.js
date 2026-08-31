const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

  // ==========================================
  // COLLECTOR ADDRESS BOOK (users/{uid}/collector_data/addresses)
  // ==========================================

  /**
   * Retrieves UID-scoped collector shipping addresses.
   */
  async getAddresses(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("addresses");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.addresses || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getAddresses error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.addresses || [];
  }

  /**
   * Persists UID-scoped collector shipping addresses with validation and default-address invariant.
   */
  async saveAddresses(uid, rawAddresses) {
    if (!uid) throw new Error("UID is required to save addresses.");
    if (!Array.isArray(rawAddresses)) throw new Error("Addresses must be an array.");

    const cleanAddresses = [];
    const seenIds = new Set();
    let hasDefault = false;

    for (const raw of rawAddresses) {
      if (!raw || typeof raw !== "object") continue;
      const addrId = String(raw.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).trim();
      if (!addrId || seenIds.has(addrId)) continue;
      seenIds.add(addrId);

      const fullName = String(raw.fullName || "").trim();
      const phone = String(raw.phone || "").trim();
      const addressLine1 = String(raw.addressLine1 || "").trim();
      const city = String(raw.city || "").trim();
      const state = String(raw.state || "").trim();
      const pincode = String(raw.pincode || "").trim();

      // Skip address entries missing essential location information
      if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
        continue;
      }

      const isDefault = Boolean(raw.isDefault);
      if (isDefault && !hasDefault) {
        hasDefault = true;
      }

      cleanAddresses.push({
        id: addrId,
        title: String(raw.title || "Home").trim().slice(0, 50),
        fullName: fullName.slice(0, 100),
        phone: phone.slice(0, 30),
        addressLine1: addressLine1.slice(0, 200),
        addressLine2: String(raw.addressLine2 || "").trim().slice(0, 200),
        city: city.slice(0, 100),
        state: state.slice(0, 100),
        pincode: pincode.slice(0, 20),
        country: String(raw.country || "India").trim().slice(0, 50),
        isDefault: isDefault && hasDefault,
      });
    }

    // Invariant: If addresses exist but none was marked default, designate the first as default
    if (cleanAddresses.length > 0 && !cleanAddresses.some((a) => a.isDefault)) {
      cleanAddresses[0].isDefault = true;
    }

    const payload = {
      addresses: cleanAddresses,
      count: cleanAddresses.length,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("addresses");
        await docRef.set(payload, { merge: true });
        return { success: true, count: cleanAddresses.length, addresses: cleanAddresses };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveAddresses error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.addresses = cleanAddresses;
    userData.addressesUpdatedAt = payload.updatedAt;
    this._writeUserDisk(uid, userData);

    return { success: true, count: cleanAddresses.length, addresses: cleanAddresses };
  }

  // ==========================================
  // COLLECTOR PROFILE (users/{uid})
  // ==========================================

  /**
   * Retrieves UID-scoped collector profile customizations.
   */
  async getProfile(uid) {
    if (!uid) return null;

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("users").doc(String(uid));
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data() || {};
          return {
            firstName: data.firstName || data.first_name || "",
            lastName: data.lastName || data.last_name || "",
            email: data.email || "",
            phone: data.phone || data.billing?.phone || "",
            avatarUrl: data.avatarUrl || data.avatar_url || "avatar_1",
            updatedAt: data.updatedAt || null,
          };
        }
        return null;
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getProfile error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.profile || null;
  }

  /**
   * Persists UID-scoped collector profile customizations.
   */
  async saveProfile(uid, profileData) {
    if (!uid) throw new Error("UID is required to save profile.");
    if (!profileData || typeof profileData !== "object") throw new Error("Profile data is required.");

    const firstName = String(profileData.firstName || "").trim().slice(0, 80);
    const lastName = String(profileData.lastName || "").trim().slice(0, 80);
    const email = String(profileData.email || "").trim().toLowerCase().slice(0, 100);
    const phone = String(profileData.phone || "").trim().slice(0, 30);
    const avatarUrl = String(profileData.avatarUrl || "avatar_1").trim().slice(0, 50);

    const payload = {
      firstName,
      lastName,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      avatarUrl,
      avatar_url: avatarUrl,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("users").doc(String(uid));
        await docRef.set(payload, { merge: true });
        return { success: true, profile: payload };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveProfile error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.profile = payload;
    this._writeUserDisk(uid, userData);

    return { success: true, profile: payload };
  }

  // ==========================================
  // EXHIBITION VIP RSVPS & PASSES
  // ==========================================

  /**
   * Persists an exhibition VIP RSVP record to exhibitions_rsvps and, if authenticated,
   * saves the issued pass to the collector's UID-scoped collector_data/exhibition_passes.
   */
  async saveExhibitionRsvp(rsvpData) {
    if (!rsvpData || !rsvpData.exhibitionId || !rsvpData.collectorName || !rsvpData.collectorEmail) {
      throw new Error("Invalid exhibition RSVP payload.");
    }

    const exhibitionId = Number(rsvpData.exhibitionId);
    const collectorUid = rsvpData.collectorUid ? String(rsvpData.collectorUid).trim() : null;
    const rsvpId = `rsvp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const passCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const passId = `VIP-EHB-${exhibitionId}-${passCode}`;
    const guestCount = Math.min(Math.max(Number(rsvpData.guestCount || 1), 1), 4);
    const collectorEmail = String(rsvpData.collectorEmail).trim().toLowerCase();

    const payload = {
      rsvpId,
      passId,
      exhibitionId,
      exhibitionTitle: String(rsvpData.exhibitionTitle || "The Emerging Perspectives").trim(),
      exhibitionDates: String(rsvpData.exhibitionDates || "27–30 September 2026").trim(),
      exhibitionTimings: String(rsvpData.exhibitionTimings || "11:00 AM – 7:00 PM").trim(),
      exhibitionVenue: String(rsvpData.exhibitionVenue || "India Habitat Centre, Lodhi Road, New Delhi").trim(),
      collectorUid,
      collectorName: String(rsvpData.collectorName).trim(),
      collectorEmail,
      collectorPhone: rsvpData.collectorPhone ? String(rsvpData.collectorPhone).trim() : null,
      guestCount,
      message: rsvpData.message ? String(rsvpData.message).trim().slice(0, 1000) : "",
      status: "confirmed",
      source: "mobile_app",
      qrCodeData: `PAG:RSVP:${passId}:${exhibitionId}:${collectorEmail}`,
      createdAt: new Date().toISOString(),
      clientIp: rsvpData.clientIp || "unknown",
    };

    // 1. Save canonical RSVP record to exhibitions_rsvps/{rsvpId}
    if (this.firestore) {
      try {
        const docRef = this.firestore.collection("exhibitions_rsvps").doc(rsvpId);
        await docRef.set(payload);
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveExhibitionRsvp error, fallback to disk:`, err.message);
      }
    }

    // Disk fallback for local testing
    try {
      this._ensureStorage();
      const rsvpsFile = path.join(this.dataDir, "exhibitions_rsvps.json");
      let allRsvps = [];
      if (fs.existsSync(rsvpsFile)) {
        try {
          allRsvps = JSON.parse(fs.readFileSync(rsvpsFile, "utf8"));
        } catch {}
      }
      allRsvps.push(payload);
      fs.writeFileSync(rsvpsFile, JSON.stringify(allRsvps, null, 2), "utf8");
    } catch (diskErr) {
      console.error("[CollectorStore] Disk saveExhibitionRsvp notice:", diskErr.message);
    }

    // 2. If collector is authenticated, persist pass to users/{uid}/collector_data/exhibition_passes
    if (collectorUid) {
      const passRecord = {
        passId,
        rsvpId,
        exhibitionId,
        exhibitionTitle: payload.exhibitionTitle,
        exhibitionDates: payload.exhibitionDates,
        exhibitionTimings: payload.exhibitionTimings,
        exhibitionVenue: payload.exhibitionVenue,
        collectorName: payload.collectorName,
        collectorEmail: payload.collectorEmail,
        guestCount: payload.guestCount,
        status: payload.status,
        qrCodeData: payload.qrCodeData,
        issuedAt: payload.createdAt,
      };

      if (this.firestore) {
        try {
          const passDocRef = this.firestore
            .collection("users")
            .doc(collectorUid)
            .collection("collector_data")
            .doc("exhibition_passes");
          
          const existingDoc = await passDocRef.get();
          let existingPasses = [];
          if (existingDoc.exists) {
            existingPasses = existingDoc.data()?.passes || [];
          }
          const updatedPasses = [passRecord, ...existingPasses.filter((p) => p.passId !== passId)];
          await passDocRef.set({ passes: updatedPasses, count: updatedPasses.length, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (passErr) {
          console.warn(`[CollectorStore] Firestore user pass save notice for ${collectorUid}:`, passErr.message);
        }
      }

      const userData = this._readUserDisk(collectorUid);
      userData.exhibitionPasses = userData.exhibitionPasses || [];
      userData.exhibitionPasses = [passRecord, ...userData.exhibitionPasses.filter((p) => p.passId !== passId)];
      this._writeUserDisk(collectorUid, userData);
    }

    return { success: true, rsvpId, passId, pass: payload };
  }

  /**
   * Retrieves UID-scoped exhibition VIP passes for an authenticated collector.
   */
  async getExhibitionPasses(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("exhibition_passes");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.passes || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getExhibitionPasses error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.exhibitionPasses || [];
  }

  // ==========================================
  // AUCTION BIDS (auctions_bids/{bidId} & users/{uid}/collector_data/my_bids)
  // ==========================================

  /**
   * Persists an auction VIP bid record canonically to Firestore and UID subcollection.
   */
  async saveAuctionBid(bidData) {
    const {
      lotId,
      lotTitle,
      artist,
      bidAmount,
      previousBid,
      collectorUid,
      collectorName,
      collectorEmail,
      collectorPhone,
      clientIp,
      wpUserId,
      idempotencyKey,
      status,
    } = bidData;

    const bidId = `bid_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const bidReference = `PAG-BID-${lotId}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const finalStatus = status || "accepted";

    const payload = {
      bidId,
      bidReference,
      lotId: Number(lotId),
      lotTitle: String(lotTitle || "").trim().slice(0, 150),
      artist: String(artist || "").trim().slice(0, 100),
      bidAmount: Number(bidAmount),
      previousBid: Number(previousBid || 0),
      collectorUid: collectorUid ? String(collectorUid) : null,
      collectorName: String(collectorName || "").trim().slice(0, 80),
      collectorEmail: String(collectorEmail || "").trim().toLowerCase().slice(0, 100),
      collectorPhone: collectorPhone ? String(collectorPhone).trim().slice(0, 30) : null,
      wpUserId: wpUserId ? Number(wpUserId) : null,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).slice(0, 100) : null,
      status: finalStatus,
      source: "mobile_app",
      createdAt,
      clientIp: clientIp ? String(clientIp).slice(0, 50) : null,
    };

    // 1. Save to Canonical Collection: auctions_bids/{bidId}
    if (this.firestore) {
      try {
        await this.firestore.collection("auctions_bids").doc(bidId).set(payload);
      } catch (err) {
        console.warn(`[CollectorStore] Firestore saveAuctionBid error for ${bidId}, falling back to disk:`, err.message);
      }
    }

    // 2. Also persist to UID-isolated subcollection if authenticated
    if (collectorUid) {
      const bidRecord = {
        bidId,
        bidReference,
        lotId: Number(lotId),
        lotTitle: payload.lotTitle,
        artist: payload.artist,
        bidAmount: Number(bidAmount),
        status: finalStatus,
        placedAt: createdAt,
      };

      if (this.firestore) {
        try {
          const userBidsRef = this.firestore
            .collection("users")
            .doc(String(collectorUid))
            .collection("collector_data")
            .doc("my_bids");

          const userBidsDoc = await userBidsRef.get();
          const existingBids = userBidsDoc.exists ? userBidsDoc.data()?.bids || [] : [];
          const updatedBids = [bidRecord, ...existingBids.filter((b) => b.bidId !== bidId)];

          await userBidsRef.set(
            {
              bids: updatedBids,
              count: updatedBids.length,
              updatedAt: createdAt,
            },
            { merge: true }
          );
        } catch (err) {
          console.warn(`[CollectorStore] Firestore saveUserBid error for ${collectorUid}:`, err.message);
        }
      }

      const userData = this._readUserDisk(collectorUid);
      userData.myBids = userData.myBids || [];
      userData.myBids = [bidRecord, ...userData.myBids.filter((b) => b.bidId !== bidId)];
      this._writeUserDisk(collectorUid, userData);
    }

    return { success: true, bidId, bidReference, bid: payload };
  }

  /**
   * Retrieves UID-scoped auction bids for an authenticated collector.
   */
  async getCollectorBids(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("my_bids");
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data()?.bids || [];
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getCollectorBids error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    return userData.myBids || [];
  }

  // ==========================================
  // PUSH NOTIFICATION TOKENS (UID-SCOPED)
  // ==========================================

  /**
   * Saves or updates a UID-scoped push notification device token.
   * Supports multiple devices per user and prevents duplicate token records.
   */
  async savePushToken(uid, { token, platform = "mobile", deviceName = "Collector Device" } = {}) {
    if (!uid) throw new Error("UID is required to save push token.");
    if (!token || typeof token !== "string") throw new Error("A valid push token string is required.");

    const cleanToken = token.trim();
    const now = new Date().toISOString();

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("push_tokens");

        const doc = await docRef.get();
        const existingTokens = doc.exists ? doc.data()?.tokens || [] : [];

        // Check if token already registered for this UID (update metadata idempotently)
        let updatedTokens;
        const foundIndex = existingTokens.findIndex((t) => (typeof t === "string" ? t === cleanToken : t.token === cleanToken));

        if (foundIndex >= 0) {
          const prev = typeof existingTokens[foundIndex] === "string" ? { token: existingTokens[foundIndex] } : existingTokens[foundIndex];
          updatedTokens = [...existingTokens];
          updatedTokens[foundIndex] = {
            ...prev,
            token: cleanToken,
            platform: platform || prev.platform || "mobile",
            deviceName: deviceName || prev.deviceName || "Collector Device",
            updatedAt: now,
            lastUsedAt: now,
          };
        } else {
          const newTokenRecord = {
            token: cleanToken,
            platform: String(platform || "mobile").slice(0, 20),
            deviceName: String(deviceName || "Collector Device").slice(0, 50),
            createdAt: now,
            updatedAt: now,
            lastUsedAt: now,
          };
          updatedTokens = [...existingTokens, newTokenRecord];
        }

        await docRef.set({
          tokens: updatedTokens,
          count: updatedTokens.length,
          updatedAt: now,
        });

        return { success: true, count: updatedTokens.length };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore savePushToken error for ${uid}, fallback to disk:`, err.message);
      }
    }

    // Disk fallback
    const userData = this._readUserDisk(uid);
    userData.pushTokens = userData.pushTokens || [];

    const foundIndex = userData.pushTokens.findIndex((t) => (typeof t === "string" ? t === cleanToken : t.token === cleanToken));
    if (foundIndex >= 0) {
      const prev = typeof userData.pushTokens[foundIndex] === "string" ? { token: userData.pushTokens[foundIndex] } : userData.pushTokens[foundIndex];
      userData.pushTokens[foundIndex] = {
        ...prev,
        token: cleanToken,
        platform: platform || prev.platform || "mobile",
        deviceName: deviceName || prev.deviceName || "Collector Device",
        updatedAt: now,
        lastUsedAt: now,
      };
    } else {
      userData.pushTokens.push({
        token: cleanToken,
        platform: String(platform || "mobile").slice(0, 20),
        deviceName: String(deviceName || "Collector Device").slice(0, 50),
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      });
    }

    this._writeUserDisk(uid, userData);
    return { success: true, count: userData.pushTokens.length };
  }

  /**
   * Retrieves all active push notification tokens for a verified UID.
   */
  async getPushTokens(uid) {
    if (!uid) return [];

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("push_tokens");

        const doc = await docRef.get();
        if (doc.exists) {
          const raw = doc.data()?.tokens || [];
          return raw.map((t) => (typeof t === "string" ? { token: t } : t));
        }
        return [];
      } catch (err) {
        console.warn(`[CollectorStore] Firestore getPushTokens error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    const raw = userData.pushTokens || [];
    return raw.map((t) => (typeof t === "string" ? { token: t } : t));
  }

  /**
   * Unregisters/removes a specific device push token for a verified UID.
   */
  async removePushToken(uid, token) {
    if (!uid || !token) return { success: false, removed: false };
    const cleanToken = String(token).trim();
    const now = new Date().toISOString();

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection("users")
          .doc(String(uid))
          .collection("collector_data")
          .doc("push_tokens");

        const doc = await docRef.get();
        if (doc.exists) {
          const existing = doc.data()?.tokens || [];
          const filtered = existing.filter((t) => (typeof t === "string" ? t !== cleanToken : t.token !== cleanToken));
          const removed = filtered.length < existing.length;

          await docRef.set({
            tokens: filtered,
            count: filtered.length,
            updatedAt: now,
          });

          return { success: true, removed, remainingCount: filtered.length };
        }
        return { success: true, removed: false, remainingCount: 0 };
      } catch (err) {
        console.warn(`[CollectorStore] Firestore removePushToken error for ${uid}, fallback to disk:`, err.message);
      }
    }

    const userData = this._readUserDisk(uid);
    userData.pushTokens = userData.pushTokens || [];
    const prevCount = userData.pushTokens.length;
    userData.pushTokens = userData.pushTokens.filter((t) => (typeof t === "string" ? t !== cleanToken : t.token !== cleanToken));
    const removed = userData.pushTokens.length < prevCount;
    this._writeUserDisk(uid, userData);

    return { success: true, removed, remainingCount: userData.pushTokens.length };
  }
}

const collectorStore = new CollectorStore();
module.exports = collectorStore;

