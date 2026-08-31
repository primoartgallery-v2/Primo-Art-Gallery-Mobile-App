import {
  getArtistsList,
  getPersistentArtistsList,
  getPersistentPrimaryProducts,
  getProducts,
  type ArtistItem,
  type WooCommerceProduct,
} from "@/services/woocommerce";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AboutContactModal } from "@/components/AboutContactModal";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getLocalRecentlyViewed,
  getCloudRecentlyViewed,
  type RecentlyViewedItem,
} from "@/services/recentlyViewedStorage";

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
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

  const loadFirstPage = useCallback(async () => {
    setErrorMessage(null);

    // 1. Instant Cached Render (if available from previous session)
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

    // 2. Fresh Background Revalidation
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
          getCloudRecentlyViewed().then((cloudItems) => {
            if (cloudItems && cloudItems.length > 0) {
              setRecentlyViewed(cloudItems);
            }
          }).catch(() => {});
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
        {/* HEADER */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Image
            source={require("../../assets/images/primo-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Pressable
            style={({ pressed }) => [
              styles.notificationButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              pressed && styles.scalePressed,
            ]}
            onPress={() => handleActionPress(() => router.push("/notifications"))}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={23} color={colors.text} />
          </Pressable>
        </View>

        {/* UNIVERSAL SEARCH BAR */}
        <View style={styles.universalSearchContainer}>
          <View
            style={[
              styles.universalSearchBar,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="search" size={19} color={colors.gold} />
            <TextInput
              style={[styles.universalSearchInput, { color: colors.text }]}
              placeholder="Search paintings, artists, auctions, exhibitions…"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSearchQuery("");
                }}
                style={styles.searchClearBtn}
              >
                <Ionicons name="close-circle" size={19} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* UNIVERSAL SEARCH RESULTS OVERLAY */}
        {searchQuery.trim() ? (
          <View
            style={[
              styles.searchResultsPanel,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {searchResults?.hasResults ? (
              <>
                {/* 1. ARTWORK RESULTS */}
                {searchResults.artworks.length > 0 ? (
                  <View style={styles.resultGroup}>
                    <Text style={[styles.resultGroupTitle, { color: colors.gold }]}>
                      🎨 MATCHING ARTWORKS ({searchResults.artworks.length})
                    </Text>
                    {searchResults.artworks.map((item) => (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.searchResultItem,
                          { borderBottomColor: colors.borderLight },
                          pressed && styles.scalePressed,
                        ]}
                        onPress={() => {
                          handleActionPress(() =>
                            router.push(`/painting/${item.id}` as any)
                          );
                        }}
                      >
                        {item.images[0]?.src ? (
                          <ExpoImage
                            source={{ uri: item.images[0].src }}
                            style={styles.resultThumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.resultThumbFallback,
                              { backgroundColor: colors.goldSoft, borderColor: colors.border },
                            ]}
                          >
                            <Ionicons name="image" size={16} color={colors.gold} />
                          </View>
                        )}
                        <View style={styles.resultCopy}>
                          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.categories[0]?.name || "Original Artwork"}
                          </Text>
                        </View>
                        <Text style={[styles.resultPrice, { color: colors.gold }]}>
                          {item.price ? `₹ ${item.price}` : "Price on request"}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={15}
                          color={colors.gold}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* 2. ARTIST RESULTS */}
                {searchResults.artists.length > 0 ? (
                  <View style={styles.resultGroup}>
                    <Text style={[styles.resultGroupTitle, { color: colors.gold }]}>
                      👤 MASTER ARTISTS ({searchResults.artists.length})
                    </Text>
                    {searchResults.artists.map((artist) => (
                      <Pressable
                        key={artist.id}
                        style={({ pressed }) => [
                          styles.searchResultItem,
                          { borderBottomColor: colors.borderLight },
                          pressed && styles.scalePressed,
                        ]}
                        onPress={() => {
                          handleActionPress(() =>
                            router.push({
                              pathname: "/explore",
                              params: {
                                artistId: String(artist.id),
                                artistName: artist.name,
                              },
                            })
                          );
                        }}
                      >
                        {artist.imageUrl ? (
                          <ExpoImage
                            source={{ uri: artist.imageUrl }}
                            style={styles.resultArtistAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.resultArtistAvatarFallback,
                              { backgroundColor: colors.goldSoft, borderColor: colors.border },
                            ]}
                          >
                            <Ionicons name="person" size={16} color={colors.gold} />
                          </View>
                        )}
                        <View style={styles.resultCopy}>
                          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                            {artist.name}
                          </Text>
                          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {artist.category || "Curated Contemporary Artist"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.viewArtistPill,
                            { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                          ]}
                        >
                          <Text style={[styles.viewArtistPillText, { color: colors.gold }]}>
                            View Artworks
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={11}
                            color={colors.gold}
                          />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* 3. SHORTCUT RESULTS */}
                {searchResults.shortcuts.length > 0 ? (
                  <View style={styles.resultGroup}>
                    <Text style={[styles.resultGroupTitle, { color: colors.gold }]}>⚡ QUICK SHORTCUTS</Text>
                    {searchResults.shortcuts.map((sc) => (
                      <Pressable
                        key={sc.id}
                        style={({ pressed }) => [
                          styles.searchResultItem,
                          { borderBottomColor: colors.borderLight },
                          pressed && styles.scalePressed,
                        ]}
                        onPress={() => handleActionPress(sc.action)}
                      >
                        <View
                          style={[
                            styles.shortcutIconWrap,
                            { backgroundColor: colors.goldSoft, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons name={sc.icon} size={18} color={colors.gold} />
                        </View>
                        <View style={styles.resultCopy}>
                          <Text style={[styles.resultTitle, { color: colors.text }]}>{sc.title}</Text>
                          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                            {sc.subtitle}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={15}
                          color={colors.gold}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* ALL RESULTS BUTTON */}
                <Pressable
                  style={[styles.viewAllSearchBtn, { backgroundColor: colors.gold }]}
                  onPress={() => {
                    handleActionPress(() => router.push("/explore"));
                  }}
                >
                  <Text style={styles.viewAllSearchBtnText}>
                    BROWSE COMPLETE COLLECTION ({products.length} ARTWORKS) →
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.noSearchFound}>
                <Ionicons name="search-outline" size={32} color={colors.gold} />
                <Text style={[styles.noSearchTitle, { color: colors.text }]}>No Exact Matches Found</Text>
                <Text style={[styles.noSearchSubtitle, { color: colors.textSecondary }]}>
                  Try searching for an artist like &ldquo;Sabia&rdquo;,
                  &ldquo;Pardeep Kumar&rdquo;, or &ldquo;Auction&rdquo;.
                </Text>
                <Pressable
                  style={[styles.exploreAllFallback, { backgroundColor: colors.gold }]}
                  onPress={() => handleActionPress(() => router.push("/explore"))}
                >
                  <Text style={styles.exploreAllFallbackText}>
                    EXPLORE ALL ARTWORKS
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {/* HERO */}
        <View style={[styles.hero, { backgroundColor: isDark ? "#171821" : "#17202A" }]}>
          <Text style={[styles.smallTitle, { color: colors.gold }]}>WELCOME TO</Text>

          <Text style={styles.heroTitle}>PRIMO ART GALLERY</Text>

          <View style={[styles.goldLine, { backgroundColor: colors.gold }]} />

          <Text style={styles.heroSubtitle}>Where Art Meets Elegance</Text>

          <Text style={styles.heroDescription}>
            Discover original handmade artworks, thoughtfully curated from
            talented Indian artists.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.gold },
              pressed && styles.scalePressed,
            ]}
            onPress={() => handleActionPress(() => router.push("/explore"))}
          >
            <Text style={styles.primaryButtonText}>EXPLORE ARTWORKS</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* RECENTLY VIEWED ARTWORKS CAROUSEL */}
        {recentlyViewed.length > 0 ? (
          <View style={styles.recentlyViewedSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionSmall, { color: colors.gold }]}>CONTINUE EXPLORING</Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Viewed</Text>
              </View>
              <Pressable onPress={() => handleActionPress(() => router.push("/explore"))}>
                <Text style={[styles.viewAll, { color: colors.gold }]}>Browse All</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentCarouselContent}
            >
              {recentlyViewed.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.recentCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.scalePressed,
                  ]}
                  onPress={() => handleActionPress(() => router.push(`/painting/${item.id}` as any))}
                >
                  <View
                    style={[
                      styles.recentImageFrame,
                      { backgroundColor: isDark ? "#20222C" : "#ECE5D8" },
                    ]}
                  >
                    {item.imageUrl ? (
                      <ExpoImage
                        source={{ uri: item.imageUrl }}
                        style={styles.recentImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Ionicons name="image-outline" size={24} color={colors.gold} />
                    )}
                  </View>
                  <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.recentPrice, { color: colors.gold }]}>
                    {item.price ? `₹ ${Number(item.price).toLocaleString("en-IN")}` : "View Details"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
            renderItem={({ item }) => <ProductCard product={item} />}
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

      {/* BOTTOM NAVIGATION */}
      <AppBottomNav />

      {/* ABOUT & CONTACT MODAL */}
      <AboutContactModal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </View>
  );
}

const ProductCard = React.memo(function ProductCard({
  product,
}: {
  product: WooCommerceProduct;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { isSaved, toggleWishlist } = useWishlist();
  const imageUrl = product.images[0]?.src;
  const productPrice = product.price || product.regular_price;
  const saved = isSaved(product.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        pressed && styles.scalePressed,
      ]}
      onPress={() => {
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
        router.push({
          pathname: "/painting/[id]",
          params: { id: String(product.id) },
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={`View ${product.name}`}
    >
      <View
        style={[
          styles.productImageContainer,
          { backgroundColor: isDark ? "#232530" : "#F8F0DC" },
        ]}
      >
        {imageUrl ? (
          <ExpoImage
            source={{ uri: imageUrl }}
            style={styles.productImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={180}
            accessibilityLabel={product.images[0]?.alt || product.name}
          />
        ) : (
          <View style={styles.productImageFallback}>
            <Ionicons name="image-outline" size={30} color={colors.gold} />
          </View>
        )}

        <Pressable
          style={styles.cardWishlistBtn}
          onPress={(e) => {
            e.stopPropagation();
            void toggleWishlist(product);
          }}
          accessibilityLabel={saved ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={16}
            color={saved ? "#E74C3C" : "#FFFFFF"}
          />
        </Pressable>
      </View>

      <Text numberOfLines={2} style={[styles.productName, { color: colors.text }]}>
        {product.name}
      </Text>

      <Text style={[styles.productPrice, { color: colors.gold }]}>
        {productPrice ? `₹ ${productPrice}` : "Price on request"}
      </Text>
    </Pressable>
  );
});

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
            styles.productCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pulseAnim },
          ]}
        >
          <View
            style={[
              styles.productImageContainer,
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

  header: {
    height: 92,
    paddingHorizontal: 22,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9F7F2",
  },

  logo: {
    width: 135,
    height: 68,
  },

  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6DFD0",
  },

  universalSearchContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },

  universalSearchBar: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E6DFD0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  universalSearchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    color: "#252525",
  },

  searchClearBtn: {
    padding: 4,
  },

  searchResultsPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EADCC2",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    gap: 16,
  },

  resultGroup: {
    gap: 8,
  },

  resultGroupTitle: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
    marginBottom: 2,
  },

  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FAF6EC",
    gap: 12,
  },

  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FAF6EC",
  },

  resultThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FAF6EC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EADCC2",
  },

  resultArtistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FAF6EC",
    borderWidth: 1.5,
    borderColor: "#EADCC2",
  },

  resultArtistAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FAF6EC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#EADCC2",
  },

  shortcutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
    alignItems: "center",
    justifyContent: "center",
  },

  resultCopy: {
    flex: 1,
  },

  resultTitle: {
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },

  resultSubtitle: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
  },

  resultPrice: {
    color: "#B8964E",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
  },

  viewArtistPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#FAF6EC",
  },

  viewArtistPillText: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansBold,
  },

  viewAllSearchBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
    alignItems: "center",
    justifyContent: "center",
  },

  viewAllSearchBtnText: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },

  noSearchFound: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },

  noSearchTitle: {
    marginTop: 4,
    color: "#252525",
    fontSize: 15,
    fontFamily: FONTS.serifBold,
  },

  noSearchSubtitle: {
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },

  exploreAllFallback: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#B8964E",
  },

  exploreAllFallbackText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },

  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 27,
    borderRadius: 24,
    backgroundColor: "#17202A",
  },

  smallTitle: {
    color: "#C9A227",
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: FONTS.sansExtraBold,
    marginBottom: 10,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: FONTS.serifBold,
    letterSpacing: 1,
    lineHeight: 40,
  },

  goldLine: {
    width: 55,
    height: 2,
    backgroundColor: "#C9A227",
    marginVertical: 17,
  },

  heroSubtitle: {
    color: "#E5D6A3",
    fontSize: 18,
    fontFamily: FONTS.serifItalic,
    marginBottom: 12,
  },

  heroDescription: {
    color: "#D8D8D8",
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
    lineHeight: 22,
    marginBottom: 22,
  },

  primaryButton: {
    height: 50,
    paddingHorizontal: 19,
    borderRadius: 25,
    backgroundColor: "#B8860B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
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

  productCard: {
    width: 190,
    minHeight: 270,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E9E2D4",
  },

  productImageContainer: {
    width: "100%",
    height: 175,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F8F0DC",
    position: "relative",
  },

  cardWishlistBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(20, 20, 20, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  productImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  productName: {
    color: "#17202A",
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    lineHeight: 20,
    marginTop: 12,
    minHeight: 40,
  },

  productPrice: {
    color: "#B8860B",
    fontSize: 15,
    fontFamily: FONTS.sansExtraBold,
    marginTop: 6,
  },

  skeleton: {
    backgroundColor: "#EDE7DA",
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

  artCard: {
    width: 190,
    minHeight: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E9E2D4",
  },

  artIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F8F0DC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  artTitle: {
    color: "#17202A",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  artSubtitle: {
    color: "#777777",
    fontSize: 12,
    lineHeight: 18,
  },

  cardArrow: {
    position: "absolute",
    right: 16,
    bottom: 16,
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

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E6E0D5",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 7,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 75,
  },

  navLabel: {
    fontSize: 10,
    color: "#8A8A8A",
    marginTop: 4,
  },

  navLabelActive: {
    color: "#B8860B",
    fontWeight: "700",
  },

  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  recentlyViewedSection: {
    marginBottom: 8,
  },
  recentCarouselContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 6,
  },
  recentCard: {
    width: 140,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  recentImageFrame: {
    width: "100%",
    height: 125,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recentImage: {
    width: "100%",
    height: "100%",
  },
  recentName: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
    marginBottom: 3,
  },
  recentPrice: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
  },
});
