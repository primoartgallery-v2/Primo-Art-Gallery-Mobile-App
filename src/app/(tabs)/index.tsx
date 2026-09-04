import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AboutContactModal } from "@/components/AboutContactModal";
import { HomeArtworkCard } from "@/components/home/HomeArtworkCard";
import { HomeCuratedHero } from "@/components/home/HomeCuratedHero";
import { HomeFeaturedArtists } from "@/components/home/HomeFeaturedArtists";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeRecentlyViewed } from "@/components/home/HomeRecentlyViewed";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getCloudRecentlyViewed,
  getLocalRecentlyViewed,
  type RecentlyViewedItem,
} from "@/services/recentlyViewedStorage";
import {
  getArtistsList,
  getPersistentArtistsList,
  getPersistentPrimaryProducts,
  getProducts,
  type ArtistItem,
  type WooCommerceProduct,
} from "@/services/woocommerce";

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const { isSaved, toggleWishlist } = useWishlist();

  // Primary State
  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // 1. Initial Page Loader (SWR with Cached Primary Products + Fresh Background Revalidation)
  const loadFirstPage = useCallback(async () => {
    setErrorMessage(null);

    // Instant Cached Render (if available from previous session)
    try {
      const cached = await getPersistentPrimaryProducts();
      if (cached && cached.products && cached.products.length > 0) {
        setProducts(cached.products);
        setCurrentPage(cached.page);
        setTotalPages(cached.totalPages);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    } catch {
      setIsLoading(true);
    }

    // Fresh Background Revalidation
    try {
      const result = await getProducts({ page: 1, perPage: 12, forceRefresh: true });
      setProducts(result.products);
      setCurrentPage(result.page);
      setTotalPages(result.totalPages);
    } catch (error) {
      setProducts((current) => {
        // If we have no cached data, display the retry message
        if (current.length === 0) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load artworks. Please try again."
          );
        }
        // If cached artworks are already visible, keep them visible gracefully
        return current;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Incremental Pagination
  const loadMoreProducts = useCallback(async () => {
    if (isLoading || isLoadingMore || currentPage >= totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const result = await getProducts({ page: nextPage, perPage: 10 });

      setProducts((currentProducts) => [
        ...currentProducts,
        ...result.products,
      ]);
      setCurrentPage(result.page);
      setTotalPages(result.totalPages);
    } catch {
      // Existing artworks remain visible if loading another page fails.
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, isLoading, isLoadingMore, totalPages]);

  useEffect(() => {
    loadFirstPage();

    // Instant cached artists + background refresh
    getPersistentArtistsList()
      .then((cachedArtists) => {
        if (cachedArtists && cachedArtists.length > 0) {
          setArtists(cachedArtists);
        }
      })
      .catch(() => {})
      .finally(() => {
        getArtistsList(true)
          .then(setArtists)
          .catch(() => {});
      });

    // Load recently viewed artworks for active collector session (or guest)
    getLocalRecentlyViewed(user?.id)
      .then((items) => {
        setRecentlyViewed(items);
        if (user?.id) {
          getCloudRecentlyViewed()
            .then((cloudItems) => {
              if (cloudItems && cloudItems.length > 0) {
                setRecentlyViewed(cloudItems);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [loadFirstPage, user?.id]);

  const handleActionPress = (callback: () => void) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    callback();
  };

  // Universal Search Categorized Results
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;

    // 1. Artworks
    const matchingArtworks = products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const catMatch = p.categories.some((c) =>
          c.name.toLowerCase().includes(q)
        );
        const descMatch =
          p.short_description?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q);
        return nameMatch || catMatch || descMatch;
      })
      .slice(0, 4);

    // 2. Artists
    const matchingArtists = artists
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.category && a.category.toLowerCase().includes(q))
      )
      .slice(0, 4);

    // 3. Quick Shortcuts
    const shortcuts = [];
    if (/auc|bid|live|hammer/i.test(q)) {
      shortcuts.push({
        id: "auction",
        icon: "hammer-outline" as const,
        title: "Live Art Auctions",
        subtitle: "Bid on curated contemporary masterworks",
        action: () => router.push("/auctions" as any),
      });
    }
    if (/exh|event|show|habitat/i.test(q)) {
      shortcuts.push({
        id: "exhibitions",
        icon: "calendar-outline" as const,
        title: "Upcoming Exhibitions",
        subtitle: "India Habitat Centre events & showcases",
        action: () => router.push("/exhibitions" as any),
      });
    }
    if (/art|creator|paint|master/i.test(q)) {
      shortcuts.push({
        id: "artists-dir",
        icon: "people-outline" as const,
        title: "Gallery Artists Directory",
        subtitle: "Meet 32 verified contemporary creators",
        action: () => router.push("/artists" as any),
      });
    }
    if (/save|wish|fav/i.test(q)) {
      shortcuts.push({
        id: "wishlist",
        icon: "heart-outline" as const,
        title: "Saved Artworks & Wishlist",
        subtitle: "View your saved private collection",
        action: () => router.push("/profile" as any),
      });
    }
    if (/cont|help|phone|call|what|advis/i.test(q)) {
      shortcuts.push({
        id: "whatsapp",
        icon: "logo-whatsapp" as const,
        title: "WhatsApp Art Advisory",
        subtitle: `Instant curator assistance: ${GALLERY_CONFIG.phone}`,
        action: () => {
          Linking.openURL(
            `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hello%20Primo%20Art%20Gallery,%20I%20need%20advisory%20assistance.`
          ).catch(() => {});
        },
      });
    }
    if (/about|story|contact|map|loc|hour|address/i.test(q)) {
      shortcuts.push({
        id: "about-gallery",
        icon: "information-circle-outline" as const,
        title: "About & Contact Primo Gallery",
        subtitle: "Location map, hours, curators & authenticity",
        action: () => setShowAboutModal(true),
      });
    }

    return {
      artworks: matchingArtworks,
      artists: matchingArtists,
      shortcuts,
      hasResults:
        matchingArtworks.length > 0 ||
        matchingArtists.length > 0 ||
        shortcuts.length > 0,
    };
  }, [searchQuery, products, artists, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER & UNIVERSAL SEARCH */}
        <HomeHeader
          searchQuery={searchQuery}
          searchResults={searchResults}
          totalProductsCount={products.length}
          onChangeSearchQuery={setSearchQuery}
          onClearSearch={() => setSearchQuery("")}
          onOpenNotifications={() => router.push("/notifications")}
          onSelectArtwork={(id) => router.push(`/painting/${id}` as any)}
          onSelectArtist={(artist) =>
            router.push({
              pathname: "/explore",
              params: {
                artistId: String(artist.id),
                artistName: artist.name,
              },
            })
          }
          onSelectShortcut={(action) => action()}
          onBrowseAllCollection={() => router.push("/explore")}
        />

        {/* CURATED HERO */}
        <HomeCuratedHero onExplore={() => handleActionPress(() => router.push("/explore"))} />

        {/* RECENTLY VIEWED ARTWORKS CAROUSEL */}
        <HomeRecentlyViewed
          items={recentlyViewed}
          onBrowseAll={() => handleActionPress(() => router.push("/explore"))}
          onSelectArtwork={(id) => handleActionPress(() => router.push(`/painting/${id}` as any))}
        />

        {/* FEATURED ARTISTS LIST */}
        <HomeFeaturedArtists
          artists={artists}
          onSelectArtist={(artist) =>
            handleActionPress(() =>
              router.push({
                pathname: "/explore",
                params: {
                  artistId: String(artist.id),
                  artistName: artist.name,
                },
              })
            )
          }
          onViewAll={() => handleActionPress(() => router.push("/artists" as any))}
        />

        {/* LIVE WOO COMMERCE PRODUCTS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionSmall, { color: colors.gold }]}>CURATED FOR YOU</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Art</Text>
          </View>

          <Pressable onPress={() => handleActionPress(() => router.push("/explore"))}>
            <Text style={[styles.viewAll, { color: colors.gold }]}>View All</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ProductSkeleton />
        ) : errorMessage && products.length === 0 ? (
          <ProductError message={errorMessage} onRetry={loadFirstPage} />
        ) : (
          <FlatList
            horizontal
            data={products}
            keyExtractor={(product) => String(product.id)}
            renderItem={({ item }) => (
              <HomeArtworkCard
                product={item}
                isSaved={isSaved(item.id)}
                onToggleWishlist={toggleWishlist}
                onPress={(id) =>
                  router.push({
                    pathname: "/painting/[id]",
                    params: { id: String(id) },
                  })
                }
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCards}
            onEndReached={loadMoreProducts}
            onEndReachedThreshold={0.4}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={3}
            ListEmptyComponent={
              <View style={styles.emptyProducts}>
                <Text style={[styles.emptyProductsText, { color: colors.textSecondary }]}>
                  New artworks are coming soon.
                </Text>
              </View>
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadMoreIndicator}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null
            }
          />
        )}

        {/* QUICK ACCESS */}
        <Text style={[styles.sectionSmall, { color: colors.gold }]}>DISCOVER PRIMO</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore More</Text>

        <View style={styles.menuGrid}>
          <MenuItem
            icon="images-outline"
            title="Artworks"
            subtitle="Browse collection"
            onPress={() => handleActionPress(() => router.push("/explore"))}
          />

          <MenuItem
            icon="people-outline"
            title="Artists"
            subtitle="Meet the creators"
            onPress={() => handleActionPress(() => router.push("/artists" as any))}
          />

          <MenuItem
            icon="hammer-outline"
            title="Live Auction"
            subtitle="Bid for original art"
            onPress={() => handleActionPress(() => router.push("/auctions"))}
          />

          <MenuItem
            icon="calendar-outline"
            title="Exhibitions"
            subtitle="Upcoming events"
            onPress={() => handleActionPress(() => router.push("/exhibitions" as any))}
          />
        </View>

        {/* TRUST SECTION */}
        <Pressable
          style={({ pressed }) => [
            styles.trustCard,
            {
              backgroundColor: colors.cardAlt,
              borderColor: colors.border,
            },
            pressed && styles.scalePressed,
          ]}
          onPress={() => handleActionPress(() => setShowAboutModal(true))}
        >
          <Ionicons name="shield-checkmark-outline" size={34} color={colors.gold} />

          <View style={styles.trustTextContainer}>
            <Text style={[styles.trustTitle, { color: colors.text }]}>100% Original Artwork</Text>

            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              Authentic handmade paintings carefully curated by Primo Art
              Gallery. Tap to view gallery story & authenticity details.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.gold} />
        </Pressable>

        {/* CTA */}
        <View
          style={[
            styles.bottomCTA,
            {
              backgroundColor: isDark ? "#1A1B24" : "#EFE8D8",
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <Text style={[styles.ctaSmall, { color: colors.gold }]}>LOOKING FOR SOMETHING SPECIAL?</Text>

          <Text style={[styles.ctaTitle, { color: colors.text }]}>Find Art That Speaks To You.</Text>

          <Pressable
            style={({ pressed }) => [
              styles.outlineButton,
              { borderColor: colors.gold },
              pressed && styles.scalePressed,
            ]}
            onPress={() => handleActionPress(() => setShowAboutModal(true))}
          >
            <Text style={[styles.outlineButtonText, { color: colors.gold }]}>ABOUT & CONTACT GALLERY</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.gold} />
          </Pressable>
        </View>

        <Text style={[styles.footerText, { color: colors.text }]}>PRIMO ART GALLERY</Text>

        <Text style={[styles.footerTagline, { color: colors.gold }]}>Where Art Meets Elegance</Text>
      </ScrollView>

      {/* ABOUT & CONTACT MODAL */}
      <AboutContactModal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </View>
  );
}

function ProductSkeleton() {
  const { colors } = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.horizontalCards}>
      {[1, 2, 3].map((item) => (
        <Animated.View
          key={item}
          style={[
            styles.productCardSkeleton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pulseAnim },
          ]}
        >
          <View
            style={[
              styles.productImageSkeleton,
              { backgroundColor: colors.backgroundElement },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              styles.skeletonTitle,
              { backgroundColor: colors.backgroundElement },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              styles.skeletonPrice,
              { backgroundColor: colors.backgroundElement },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function ProductError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.productsError,
        {
          backgroundColor: colors.cardAlt,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={28} color={colors.gold} />

      <Text style={[styles.productsErrorText, { color: colors.textSecondary }]}>
        {message}
      </Text>

      <Pressable
        style={[styles.retryButton, { backgroundColor: colors.gold }]}
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

const MenuItem = React.memo(function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        pressed && styles.scalePressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIcon,
          {
            backgroundColor: isDark ? "#2A2518" : "#F8F0DC",
          },
        ]}
      >
        <Ionicons name={icon} size={25} color={colors.gold} />
      </View>

      <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textMuted}
        style={styles.menuArrow}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F2",
  },
  scrollContent: {
    paddingBottom: 110,
  },
  sectionHeader: {
    marginTop: 34,
    marginHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionSmall: {
    marginTop: 32,
    marginHorizontal: 22,
    color: "#B8860B",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONTS.sansExtraBold,
  },
  sectionTitle: {
    marginHorizontal: 22,
    marginTop: 5,
    color: "#17202A",
    fontSize: 27,
    fontFamily: FONTS.serifBold,
  },
  viewAll: {
    color: "#B8860B",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    marginBottom: 3,
  },
  horizontalCards: {
    paddingHorizontal: 22,
    paddingTop: 17,
    paddingBottom: 5,
    flexDirection: "row",
    gap: 14,
  },
  productCardSkeleton: {
    width: 190,
    minHeight: 270,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
  },
  productImageSkeleton: {
    width: "100%",
    height: 175,
    borderRadius: 14,
  },
  skeletonLine: {
    backgroundColor: "#EDE7DA",
    borderRadius: 5,
  },
  skeletonTitle: {
    width: "82%",
    height: 14,
    marginTop: 14,
  },
  skeletonPrice: {
    width: "48%",
    height: 13,
    marginTop: 10,
  },
  productsError: {
    marginHorizontal: 22,
    marginTop: 17,
    padding: 22,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#E5D5A9",
  },
  productsErrorText: {
    color: "#777777",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#B8860B",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  emptyProducts: {
    width: 250,
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyProductsText: {
    color: "#777777",
    fontSize: 13,
    textAlign: "center",
  },
  loadMoreIndicator: {
    width: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  menuGrid: {
    marginHorizontal: 22,
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  menuItem: {
    width: "48%",
    minHeight: 145,
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E2D4",
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#F8F0DC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  menuTitle: {
    color: "#17202A",
    fontSize: 15,
    fontFamily: FONTS.sansBold,
  },
  menuSubtitle: {
    color: "#888888",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    marginTop: 5,
    lineHeight: 16,
    paddingRight: 10,
  },
  menuArrow: {
    position: "absolute",
    right: 14,
    bottom: 14,
  },
  trustCard: {
    marginHorizontal: 22,
    marginTop: 25,
    padding: 19,
    borderRadius: 18,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#E5D5A9",
    flexDirection: "row",
    alignItems: "center",
  },
  trustTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  trustTitle: {
    color: "#17202A",
    fontSize: 15,
    fontFamily: FONTS.sansBold,
    marginBottom: 5,
  },
  trustText: {
    color: "#777777",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 17,
  },
  bottomCTA: {
    marginHorizontal: 22,
    marginTop: 35,
    padding: 25,
    borderRadius: 22,
    backgroundColor: "#EFE8D8",
    alignItems: "center",
  },
  ctaSmall: {
    color: "#B8860B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
  },
  ctaTitle: {
    color: "#17202A",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  outlineButton: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: "#B8860B",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  outlineButtonText: {
    color: "#B8860B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  footerText: {
    textAlign: "center",
    marginTop: 35,
    color: "#17202A",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },
  footerTagline: {
    textAlign: "center",
    marginTop: 5,
    color: "#B8860B",
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 10,
  },
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
