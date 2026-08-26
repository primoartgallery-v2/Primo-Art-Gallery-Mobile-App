import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { WooCommerceProduct } from "@/services/woocommerce";
import { useAuth } from "./AuthContext";

export function getWishlistStorageKey(userId: string | number | null | undefined): string {
  if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
    return `@primo_gallery_wishlist_${String(userId).trim()}`;
  }
  return "@primo_gallery_wishlist_guest";
}

type WishlistContextType = {
  savedProducts: WooCommerceProduct[];
  isSaved: (productId: number | string) => boolean;
  toggleWishlist: (product: WooCommerceProduct) => Promise<void>;
  removeFromWishlist: (productId: number | string) => Promise<void>;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedProducts, setSavedProducts] = useState<WooCommerceProduct[]>([]);
  const currentUserId = user?.id || null;

  // Load wishlist whenever the active user changes (or resets on logout)
  useEffect(() => {
    let isMounted = true;
    const storageKey = getWishlistStorageKey(currentUserId);

    // Reset memory state immediately on user change
    setSavedProducts([]);

    AsyncStorage.getItem(storageKey)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          try {
            setSavedProducts(JSON.parse(data));
          } catch {
            setSavedProducts([]);
          }
        } else {
          setSavedProducts([]);
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
          : [product, ...current];
        void AsyncStorage.setItem(storageKey, JSON.stringify(updated));
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
        void AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [currentUserId]
  );

  return (
    <WishlistContext.Provider
      value={{
        savedProducts,
        isSaved,
        toggleWishlist,
        removeFromWishlist,
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
