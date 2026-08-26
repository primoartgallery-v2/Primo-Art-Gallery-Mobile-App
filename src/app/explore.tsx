import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { FONTS } from "@/constants/typography";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  extractProductArtistIds,
  getProducts,
  type WooCommerceProduct,
} from "@/services/woocommerce";

type SortOption = "featured" | "price_asc" | "price_desc" | "name_asc";

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{
    artistId?: string;
    artistName?: string;
    category?: string;
  }>();
  const { isSaved, toggleWishlist } = useWishlist();

  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(
    params.category || "All"
  );
  const [selectedArtistId, setSelectedArtistId] = useState<string | undefined>(
    params.artistId
  );
  const [selectedArtistName, setSelectedArtistName] = useState<
    string | undefined
  >(params.artistName);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync params when navigating with new artist/category filters
  useEffect(() => {
    if (params.artistId) {
      setSelectedArtistId(params.artistId);
    }
    if (params.artistName) {
      setSelectedArtistName(params.artistName);
    }
    if (params.category) {
      setSelectedCategory(params.category);
    }
  }, [params.artistId, params.artistName, params.category]);

  // Debounce search query to prevent typing lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      // Fetch up to 100 products to capture all artworks across catalog
      const result = await getProducts({
        page: 1,
        perPage: 100,
        forceRefresh: refresh,
      });
      setProducts(result.products);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load artworks."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(
      products.flatMap((product) => product.categories.map((c) => c.name))
    );
    return ["All", ...Array.from(set).filter(Boolean)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    let list = [...products];

    // 1. Filter by Artist ID or Artist Name (when clicked from Artists screen)
    if (selectedArtistId || selectedArtistName) {
      const targetId = selectedArtistId ? String(selectedArtistId).trim() : "";
      const targetName = (selectedArtistName || "").toLowerCase().trim();

      list = list.filter((p) => {
        const productArtistIds = extractProductArtistIds(p);

        // Direct ID match in egns metadata or attributes
        if (targetId && productArtistIds.includes(targetId)) {
          return true;
        }

        // Match by artist name in product title, descriptions, or attributes
        if (targetName) {
          if (p.name.toLowerCase().includes(targetName)) return true;
          if (p.description?.toLowerCase().includes(targetName)) return true;
          if (p.short_description?.toLowerCase().includes(targetName)) return true;
          if (
            p.attributes?.some(
              (a) =>
                a.name.toLowerCase().includes("artist") &&
                a.options.some((opt) => opt.toLowerCase().includes(targetName))
            )
          ) {
            return true;
          }
        }

        return false;
      });
    }

    // 2. Filter by Category
    if (selectedCategory !== "All") {
      list = list.filter((product) =>
        product.categories.some((c) => c.name === selectedCategory)
      );
    }

    // 3. Filter by Search Query
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter((product) => {
        const nameMatch = product.name.toLowerCase().includes(q);
        const catMatch = product.categories.some((c) =>
          c.name.toLowerCase().includes(q)
        );
        const descMatch =
          product.short_description?.toLowerCase().includes(q) ||
          product.description?.toLowerCase().includes(q);
        return nameMatch || catMatch || descMatch;
      });
    }

    // 4. Sort
    switch (sortBy) {
      case "price_asc":
        return list.sort((a, b) => {
          const pa = Number(a.price || a.regular_price) || 0;
          const pb = Number(b.price || b.regular_price) || 0;
          return pa - pb;
        });
      case "price_desc":
        return list.sort((a, b) => {
          const pa = Number(a.price || a.regular_price) || 0;
          const pb = Number(b.price || b.regular_price) || 0;
          return pb - pa;
        });
      case "name_asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [
    products,
    selectedArtistId,
    selectedArtistName,
    selectedCategory,
    debouncedSearch,
    sortBy,
  ]);

  const handleCategorySelect = (item: string) => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setSelectedCategory(item);
  };

  const handleSortSelect = (option: SortOption) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSortBy(option);
    setShowSortMenu(false);
  };

  const clearArtistFilter = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedArtistId(undefined);
    setSelectedArtistName(undefined);
  };

  const sortLabel = {
    featured: "Featured",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc: "Title: A to Z",
  }[sortBy];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {selectedArtistName ? selectedArtistName : "Explore Collection"}
          </Text>
        </View>
        <Pressable
          style={[
            styles.bell,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/notifications" as any)}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
        </Pressable>
      </View>

      {/* ACTIVE ARTIST FILTER BANNER */}
      {selectedArtistName ? (
        <View
          style={[
            styles.artistBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.artistBannerLeft}>
            <View
              style={[
                styles.artistAvatarPill,
                { backgroundColor: colors.goldSoft, borderColor: colors.border },
              ]}
            >
              <Ionicons name="color-palette" size={16} color={colors.gold} />
            </View>
            <View>
              <Text style={[styles.artistBannerEyebrow, { color: colors.gold }]}>CURATED BY ARTIST</Text>
              <Text style={[styles.artistBannerTitle, { color: colors.text }]}>{selectedArtistName}</Text>
            </View>
          </View>
          <Pressable
            style={[
              styles.clearArtistBtn,
              { backgroundColor: colors.goldSoft, borderColor: colors.border },
            ]}
            onPress={clearArtistFilter}
          >
            <Text style={[styles.clearArtistBtnText, { color: colors.gold }]}>All Artists</Text>
            <Ionicons name="close-circle" size={16} color={colors.gold} />
          </Pressable>
        </View>
      ) : null}

      {/* SEARCH BAR & SORT */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.gold} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              selectedArtistName
                ? `Search in ${selectedArtistName} works…`
                : "Search artworks, artists, styles…"
            }
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
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.sortButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            showSortMenu && { borderColor: colors.gold, backgroundColor: colors.goldSoft },
          ]}
          onPress={() => setShowSortMenu((prev) => !prev)}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={18}
            color={showSortMenu ? colors.gold : colors.text}
          />
        </Pressable>
      </View>

      {/* SORT MENU POPOVER */}
      {showSortMenu ? (
        <View
          style={[
            styles.sortMenu,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sortMenuTitle, { color: colors.gold }]}>SORT BY</Text>
          {(
            [
              { id: "featured", label: "Featured" },
              { id: "price_asc", label: "Price: Low to High" },
              { id: "price_desc", label: "Price: High to Low" },
              { id: "name_asc", label: "Title: A to Z" },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              style={[
                styles.sortOptionRow,
                { borderBottomColor: colors.borderLight },
                sortBy === opt.id && styles.sortOptionRowSelected,
              ]}
              onPress={() => handleSortSelect(opt.id)}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  { color: colors.textSecondary },
                  sortBy === opt.id && { color: colors.text, fontFamily: FONTS.sansBold },
                ]}
              >
                {opt.label}
              </Text>
              {sortBy === opt.id ? (
                <Ionicons name="checkmark" size={16} color={colors.gold} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* CATEGORY FILTER CHIPS */}
      <View style={styles.categoryFiltersContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            return (
              <Pressable
                onPress={() => handleCategorySelect(item)}
                style={[
                  styles.filter,
                  {
                    backgroundColor: active ? colors.goldSoft : colors.card,
                    borderColor: active ? colors.gold : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? colors.gold : colors.textSecondary },
                    active && { fontFamily: FONTS.sansBold },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* RESULTS COUNT & ACTIVE FILTER BAR */}
      <View style={styles.resultsInfoRow}>
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {visibleProducts.length}{" "}
          {visibleProducts.length === 1 ? "Artwork" : "Artworks"}
          {selectedArtistName ? ` by ${selectedArtistName}` : ""}
        </Text>
        {sortBy !== "featured" ? (
          <Text style={[styles.activeSortBadge, { color: colors.gold }]}>• {sortLabel}</Text>
        ) : null}
      </View>

      {/* ARTWORKS 2-COLUMN GRID */}
      <FlatList
        data={loading ? [] : visibleProducts}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <ArtworkGridCard
            product={item}
            index={index}
            isSaved={isSaved(item.id)}
            onToggleWishlist={() => toggleWishlist(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={[styles.skeletonImage, { backgroundColor: colors.backgroundElement }]} />
                  <View style={[styles.skeletonTitle, { backgroundColor: colors.backgroundElement }]} />
                  <View style={[styles.skeletonPrice, { backgroundColor: colors.backgroundElement }]} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons
                name={error ? "cloud-offline-outline" : "images-outline"}
                size={36}
                color={colors.gold}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                {error ??
                  (debouncedSearch
                    ? `No artworks found for "${debouncedSearch}".`
                    : "No artworks in this collection yet.")}
              </Text>
              {debouncedSearch ? (
                <Pressable
                  style={[styles.clearSearchBtn, { backgroundColor: colors.gold }]}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                >
                  <Text style={styles.clearSearchBtnText}>SHOW ALL ARTWORKS</Text>
                </Pressable>
              ) : null}
              {error ? (
                <Pressable style={[styles.retry, { backgroundColor: colors.gold }]} onPress={() => load()}>
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.gold]}
            tintColor={colors.gold}
          />
        }
      />

      <AppBottomNav />
    </SafeAreaView>
  );
}

const ArtworkGridCard = React.memo(function ArtworkGridCard({
  product,
  index,
  isSaved,
  onToggleWishlist,
}: {
  product: WooCommerceProduct;
  index: number;
  isSaved: boolean;
  onToggleWishlist: () => void;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const image = product.images[0];
  const price = product.price || product.regular_price;

  const heightPatterns = [220, 250, 205, 235];
  const frameHeight = heightPatterns[index % heightPatterns.length];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.gridCard,
        pressed && styles.cardPressed,
      ]}
      onPress={() =>
        router.push({
          pathname: "/painting/[id]",
          params: { id: String(product.id) },
        })
      }
    >
      <View
        style={[
          styles.imageFrame,
          {
            height: frameHeight,
            backgroundColor: isDark ? "#20222C" : "#ECE5D8",
          },
        ]}
      >
        {image ? (
          <ExpoImage
            source={{ uri: image.src }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <Ionicons name="image-outline" size={30} color={colors.gold} />
        )}

        {/* WISHLIST BUTTON */}
        <Pressable
          style={styles.wishlistBtn}
          onPress={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
          accessibilityLabel={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={16}
            color={isSaved ? "#E74C3C" : "#FFFFFF"}
          />
        </Pressable>
      </View>

      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={[styles.productMeta, { color: colors.textSecondary }]}>
        {product.categories[0]?.name ?? "Original artwork"}
      </Text>
      <Text style={[styles.price, { color: colors.gold }]}>
        {price ? `₹ ${price}` : "Price on request"}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF8F3" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.7,
  },
  title: {
    marginTop: 4,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 29,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  artistBanner: {
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EADCC2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  artistBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  artistAvatarPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
    alignItems: "center",
    justifyContent: "center",
  },
  artistBannerEyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  artistBannerTitle: {
    color: "#252525",
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  clearArtistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
  },
  clearArtistBtnText: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansBold,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    color: "#252525",
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    alignItems: "center",
    justifyContent: "center",
  },
  sortButtonActive: {
    borderColor: "#B8964E",
    backgroundColor: "#FDFBF7",
  },
  sortMenu: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  sortMenuTitle: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  sortOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4EFE6",
  },
  sortOptionRowSelected: {
    backgroundColor: "transparent",
  },
  sortOptionText: {
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  sortOptionTextSelected: {
    color: "#252525",
    fontFamily: FONTS.sansBold,
  },
  categoryFiltersContainer: {
    paddingVertical: 4,
  },
  filters: { paddingHorizontal: 20, paddingVertical: 4, gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  filterActive: { borderColor: "#B8964E", backgroundColor: "#F3EAD7" },
  filterText: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  filterTextActive: { color: "#6D5421" },
  resultsInfoRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  resultsCount: {
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  activeSortBadge: {
    color: "#B8964E",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  columnWrapper: {
    justifyContent: "space-between",
    gap: 12,
  },
  gridCard: {
    flex: 1,
    maxWidth: "48.5%",
    marginBottom: 16,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  imageFrame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#ECE5D8",
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  wishlistBtn: {
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
  productName: {
    marginTop: 8,
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    lineHeight: 18,
  },
  productMeta: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
  },
  price: {
    marginTop: 4,
    color: "#B8964E",
    fontSize: 13,
    fontFamily: FONTS.sansExtraBold,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  skeletonCard: {
    width: "48%",
    marginBottom: 16,
  },
  skeletonImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#E8E2D6",
  },
  skeletonTitle: {
    width: "80%",
    height: 14,
    borderRadius: 6,
    backgroundColor: "#E8E2D6",
    marginTop: 8,
  },
  skeletonPrice: {
    width: "50%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E8E2D6",
    marginTop: 6,
  },
  state: { paddingTop: 60, alignItems: "center", paddingHorizontal: 30 },
  stateText: {
    marginTop: 12,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 20,
    textAlign: "center",
  },
  clearSearchBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#B8964E",
  },
  clearSearchBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  retry: {
    marginTop: 16,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#B8964E",
  },
  retryText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONTS.sansExtraBold, letterSpacing: 1 },
});
