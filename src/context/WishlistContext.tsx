import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  deduplicateProducts,
  fetchCloudWishlist,
  flushPendingWishlistSync,
  getWishlistStorageKey,
  mergeGuestWishlistIntoUser,
  syncWishlistToCloud,
} from "@/services/collectorStorage";
import type { WooCommerceProduct } from "@/services/woocommerce";
import { useAuth } from "./AuthContext";

export { getWishlistStorageKey };

type WishlistContextType = {
  savedProducts: WooCommerceProduct[];
  isSaved: (productId: number | string) => boolean;
  toggleWishlist: (product: WooCommerceProduct) => Promise<void>;
  removeFromWishlist: (productId: number | string) => Promise<void>;
  syncWishlist: () => Promise<void>;
  isSyncing: boolean;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedProducts, setSavedProducts] = useState<WooCommerceProduct[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const currentUserId = user?.id || null;

  // Load wishlist whenever the active user changes (or resets on logout)
  useEffect(() => {
    let isMounted = true;
    const storageKey = getWishlistStorageKey(currentUserId);

    // 1. Instant local cache load for instantaneous UI rendering
    AsyncStorage.getItem(storageKey)
      .then(async (data) => {
        if (!isMounted) return;
        let localList: WooCommerceProduct[] = [];
        if (data) {
          try {
            localList = deduplicateProducts(JSON.parse(data));
            setSavedProducts(localList);
          } catch {
            localList = [];
            setSavedProducts([]);
          }
        } else {
          setSavedProducts([]);
        }

        // 2. If authenticated, merge guest items and sync with Cloud Firestore
        if (currentUserId) {
          setIsSyncing(true);
          try {
            // Merge any local guest items accumulated prior to login
            const mergedList = await mergeGuestWishlistIntoUser(currentUserId, localList);
            if (isMounted && mergedList.length !== localList.length) {
              setSavedProducts(mergedList);
              localList = mergedList;
            }

            // Fetch latest cloud state from Firestore
            const cloudItems = await fetchCloudWishlist();
            if (isMounted && cloudItems && cloudItems.length >= 0) {
              // Merge cloud items with local state (deduplicated)
              const combined = deduplicateProducts([...cloudItems, ...localList]);
              setSavedProducts(combined);
              await AsyncStorage.setItem(storageKey, JSON.stringify(combined));

              // If local had new items not yet in cloud, sync up
              if (combined.length > cloudItems.length) {
                void syncWishlistToCloud(combined, currentUserId);
              }
            }

            // Flush any pending offline sync changes
            await flushPendingWishlistSync(currentUserId);
          } catch (syncErr) {
            console.warn("[WishlistContext] Cloud sync notice:", syncErr);
          } finally {
            if (isMounted) setIsSyncing(false);
          }
        }
      })
      .catch(() => {
        if (isMounted) setSavedProducts([]);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const isSaved = useCallback(
    (productId: number | string) => {
      const idNum = Number(productId);
      return savedProducts.some((p) => p.id === idNum);
    },
    [savedProducts]
  );

  const toggleWishlist = useCallback(
    async (product: WooCommerceProduct) => {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // haptics
      }

      const storageKey = getWishlistStorageKey(currentUserId);

      setSavedProducts((current) => {
        const exists = current.some((p) => p.id === product.id);
        const updated = exists
          ? current.filter((p) => p.id !== product.id)
          : deduplicateProducts([product, ...current]);

        // 1. Optimistic write to local cache
        void AsyncStorage.setItem(storageKey, JSON.stringify(updated));

        // 2. Dispatch background cloud sync / offline enqueue
        if (currentUserId) {
          void syncWishlistToCloud(updated, currentUserId);
        }

        return updated;
      });
    },
    [currentUserId]
  );

  const removeFromWishlist = useCallback(
    async (productId: number | string) => {
      const idNum = Number(productId);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // haptics
      }

      const storageKey = getWishlistStorageKey(currentUserId);

      setSavedProducts((current) => {
        const updated = current.filter((p) => p.id !== idNum);

        // 1. Optimistic write to local cache
        void AsyncStorage.setItem(storageKey, JSON.stringify(updated));

        // 2. Dispatch background cloud sync / offline enqueue
        if (currentUserId) {
          void syncWishlistToCloud(updated, currentUserId);
        }

        return updated;
      });
    },
    [currentUserId]
  );

  const syncWishlist = useCallback(async () => {
    if (!currentUserId) return;
    setIsSyncing(true);
    try {
      const cloudItems = await fetchCloudWishlist();
      if (cloudItems) {
        setSavedProducts(cloudItems);
        await AsyncStorage.setItem(getWishlistStorageKey(currentUserId), JSON.stringify(cloudItems));
      }
      await flushPendingWishlistSync(currentUserId);
    } catch {
      // offline
    } finally {
      setIsSyncing(false);
    }
  }, [currentUserId]);

  return (
    <WishlistContext.Provider
      value={{
        savedProducts,
        isSaved,
        toggleWishlist,
        removeFromWishlist,
        syncWishlist,
        isSyncing,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
