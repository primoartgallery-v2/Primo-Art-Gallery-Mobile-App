import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getLocalSavedArtists } from "@/services/savedArtistsStorage";
import {
  extractProductArtistIds,
  getCategories,
  getProducts,
  type WooCommerceCategory,
  type WooCommerceProduct,
} from "@/services/woocommerce";

type SortOption = "featured" | "price_asc" | "price_desc" | "title_asc";

type PricePreset = {
  id: string;
  label: string;
  minPrice?: number;
  maxPrice?: number;
};

const PRICE_PRESETS: PricePreset[] = [
  { id: "all", label: "All Prices" },
  { id: "under_50k", label: "Under ₹50,000", maxPrice: 50000 },
  { id: "50k_200k", label: "₹50,000 – ₹2,00,000", minPrice: 50000, maxPrice: 200000 },
  { id: "200k_1000k", label: "₹2,00,000 – ₹10,00,000", minPrice: 200000, maxPrice: 1000000 },
  { id: "above_1000k", label: "₹10,00,000+", minPrice: 1000000 },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    artistId?: string;
    artistName?: string;
    category?: string;
  }>();
  const { isSaved, toggleWishlist } = useWishlist();

  // Product and Category State
  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [categories, setCategories] = useState<WooCommerceCategory[]>([]);
  const [savedArtistIds, setSavedArtistIds] = useState<string[]>([]);
  const [onlyFollowedArtists, setOnlyFollowedArtists] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | undefined>(params.artistId);
  const [selectedArtistName, setSelectedArtistName] = useState<string | undefined>(params.artistName);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // Price Filter State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [customMinInput, setCustomMinInput] = useState("");
  const [customMaxInput, setCustomMaxInput] = useState("");

  // Pagination & Loading State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Saved Artists for active collector session
  useEffect(() => {
    getLocalSavedArtists(user?.id)
      .then(setSavedArtistIds)
      .catch(() => {});
  }, [user?.id]);

  // Load Real Categories on Mount
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((cats) => {
        if (isMounted) {
          setCategories(cats);
          // If category name passed via router params, match to ID
          if (params.category && params.category !== "All") {
            const matched = cats.find(
              (c) => c.name.toLowerCase() === params.category?.toLowerCase()
            );
            if (matched) {
              setSelectedCategoryId(matched.id);
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [params.category]);

  // Sync params when navigating with new artist
  useEffect(() => {
    if (params.artistId) setSelectedArtistId(params.artistId);
    if (params.artistName) setSelectedArtistName(params.artistName);
  }, [params.artistId, params.artistName]);

  // Debounce search query (~250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Map sort option to WooCommerce parameters
  const sortParams = useMemo(() => {
    switch (sortBy) {
      case "price_asc":
        return { orderby: "price", order: "asc" };
      case "price_desc":
        return { orderby: "price", order: "desc" };
      case "title_asc":
        return { orderby: "title", order: "asc" };
      case "featured":
      default:
        return { orderby: "date", order: "desc" };
    }
  }, [sortBy]);

  const isArtistFilterActive = Boolean(
    selectedArtistId || selectedArtistName || onlyFollowedArtists
  );

  // Core Data Fetcher
  const fetchArtworks = useCallback(
    async (targetPage = 1, isRefresh = false) => {
      if (targetPage === 1) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        if (isArtistFilterActive) {
          // When an artist or followed-artist filter is active, fetch all catalogue pages
          // so client-side artist extraction & filtering is authoritative across the full collection.
          const firstPageResult = await getProducts({
            page: 1,
            perPage: 50,
            category: selectedCategoryId ?? undefined,
            search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
            minPrice: minPrice !== undefined ? minPrice : undefined,
            maxPrice: maxPrice !== undefined ? maxPrice : undefined,
            orderby: sortParams.orderby,
            order: sortParams.order,
            forceRefresh: isRefresh,
          });

          const allFetched: WooCommerceProduct[] = [...firstPageResult.products];
          const totalPagesToFetch = Math.min(firstPageResult.totalPages || 1, 20);

          if (totalPagesToFetch > 1) {
            const pageRequests = [];
            for (let p = 2; p <= totalPagesToFetch; p++) {
              pageRequests.push(
                getProducts({
                  page: p,
                  perPage: 50,
                  category: selectedCategoryId ?? undefined,
                  search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
                  minPrice: minPrice !== undefined ? minPrice : undefined,
                  maxPrice: maxPrice !== undefined ? maxPrice : undefined,
                  orderby: sortParams.orderby,
                  order: sortParams.order,
                  forceRefresh: isRefresh,
                }).catch(() => null)
              );
            }
            const subsequentResults = await Promise.all(pageRequests);
            for (const res of subsequentResults) {
              if (res?.products) {
                allFetched.push(...res.products);
              }
            }
          }

          // Deduplicate products by id
          const seenIds = new Set<number>();
          const uniqueProducts = allFetched.filter((p) => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
          });

          setProducts(uniqueProducts);
          setPage(firstPageResult.totalPages || 1);
          setTotalPages(firstPageResult.totalPages || 1);
          setTotalCount(firstPageResult.total);
        } else {
          // General Explore browsing: standard single-page incremental pagination
          const result = await getProducts({
            page: targetPage,
            perPage: 20,
            category: selectedCategoryId ?? undefined,
            search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
            minPrice: minPrice !== undefined ? minPrice : undefined,
            maxPrice: maxPrice !== undefined ? maxPrice : undefined,
            orderby: sortParams.orderby,
            order: sortParams.order,
            forceRefresh: isRefresh,
          });

          if (targetPage === 1) {
            setProducts(result.products);
          } else {
            setProducts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newItems = result.products.filter((p) => !existingIds.has(p.id));
              return [...prev, ...newItems];
            });
          }

          setPage(result.page);
          setTotalPages(result.totalPages);
          setTotalCount(result.total);
        }
      } catch (err: any) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load artworks. Please check connection."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [
      isArtistFilterActive,
      selectedCategoryId,
      debouncedSearch,
      minPrice,
      maxPrice,
      sortParams,
    ]
  );

  // Trigger search / filter update whenever filter parameters change
  useEffect(() => {
    fetchArtworks(1);
  }, [fetchArtworks]);

  // Client-side artist filtering when an artist was explicitly chosen or Followed Artists quick filter is active
  const visibleProducts = useMemo(() => {
    let list = products;

    if (onlyFollowedArtists && savedArtistIds.length > 0) {
      list = list.filter((p) => {
        const productArtistIds = extractProductArtistIds(p);
        return productArtistIds.some((id) => savedArtistIds.includes(String(id)));
      });
    }

    if (!selectedArtistId && !selectedArtistName) {
      return list;
    }

    const targetId = selectedArtistId ? String(selectedArtistId).trim() : "";
    const targetName = (selectedArtistName || "").toLowerCase().trim();

    return list.filter((p) => {
      const productArtistIds = extractProductArtistIds(p);
      if (targetId && productArtistIds.includes(targetId)) return true;
      if (targetName) {
        if (p.name.toLowerCase().includes(targetName)) return true;
        if (p.description?.toLowerCase().includes(targetName)) return true;
        if (p.short_description?.toLowerCase().includes(targetName)) return true;
        if (
          p.attributes?.some(
            (a) =>
              a.name.toLowerCase().includes("artist") &&
              a.options.some((opt) => {
                const optLower = opt.toLowerCase().trim();
                return (
                  optLower.includes(targetName) ||
                  targetName.includes(optLower)
                );
              })
          )
        ) {
          return true;
        }
        if (
          p.meta_data?.some((m) => {
            const k = m.key.toLowerCase();
            if (k.includes("artist") && typeof m.value === "string") {
              const v = m.value.toLowerCase().trim();
              return v.includes(targetName) || (v.length > 3 && targetName.includes(v));
            }
            return false;
          })
        ) {
          return true;
        }
      }
      return false;
    });
  }, [products, savedArtistIds, onlyFollowedArtists, selectedArtistId, selectedArtistName]);

  const handleCategorySelect = (catId: number | null) => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setSelectedCategoryId(catId);
  };

  const handleSortSelect = (option: SortOption) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSortBy(option);
    setShowSortMenu(false);
  };

  const handlePresetSelect = (preset: PricePreset) => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setSelectedPresetId(preset.id);
    setMinPrice(preset.minPrice);
    setMaxPrice(preset.maxPrice);
    setCustomMinInput(preset.minPrice !== undefined ? String(preset.minPrice) : "");
    setCustomMaxInput(preset.maxPrice !== undefined ? String(preset.maxPrice) : "");
  };

  const applyCustomPrice = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const parsedMin = customMinInput.trim() ? Number(customMinInput.trim()) : undefined;
    const parsedMax = customMaxInput.trim() ? Number(customMaxInput.trim()) : undefined;

    if (parsedMin !== undefined && isNaN(parsedMin)) return;
    if (parsedMax !== undefined && isNaN(parsedMax)) return;
    if (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax) return;

    setSelectedPresetId("custom");
    setMinPrice(parsedMin);
    setMaxPrice(parsedMax);
    setShowPriceModal(false);
  };

  const clearAllFilters = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedCategoryId(null);
    setSelectedPresetId("all");
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setCustomMinInput("");
    setCustomMaxInput("");
    setSortBy("featured");
    setSelectedArtistId(undefined);
    setSelectedArtistName(undefined);
    setOnlyFollowedArtists(false);
  };

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    selectedCategoryId !== null ||
    selectedPresetId !== "all" ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    sortBy !== "featured" ||
    !!selectedArtistName ||
    onlyFollowedArtists;

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === null) return "All Artworks";
    const found = categories.find((c) => c.id === selectedCategoryId);
    return found ? found.name : "Category";
  }, [categories, selectedCategoryId]);

  const activePriceLabel = useMemo(() => {
    if (selectedPresetId === "all" && minPrice === undefined && maxPrice === undefined) {
      return null;
    }
    if (selectedPresetId !== "all" && selectedPresetId !== "custom") {
      const p = PRICE_PRESETS.find((preset) => preset.id === selectedPresetId);
      return p ? p.label : null;
    }
    if (minPrice !== undefined && maxPrice !== undefined) {
      return `₹${minPrice.toLocaleString("en-IN")} – ₹${maxPrice.toLocaleString("en-IN")}`;
    }
    if (minPrice !== undefined) {
      return `₹${minPrice.toLocaleString("en-IN")}+`;
    }
    if (maxPrice !== undefined) {
      return `Up to ₹${maxPrice.toLocaleString("en-IN")}`;
    }
    return null;
  }, [selectedPresetId, minPrice, maxPrice]);

  const sortLabel = {
    featured: "Featured",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    title_asc: "Title: A to Z",
  }[sortBy];

  const displayCount =
    selectedArtistId || selectedArtistName || onlyFollowedArtists
      ? visibleProducts.length
      : (totalCount || visibleProducts.length);

  const onEndReached = () => {
    if (
      !loading &&
      !loadingMore &&
      !isArtistFilterActive &&
      page < totalPages
    ) {
      fetchArtworks(page + 1);
    }
  };

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

      {/* ACTIVE ARTIST BANNER */}
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
            onPress={() => {
              setSelectedArtistId(undefined);
              setSelectedArtistName(undefined);
            }}
          >
            <Text style={[styles.clearArtistBtnText, { color: colors.gold }]}>All Artists</Text>
            <Ionicons name="close-circle" size={16} color={colors.gold} />
          </Pressable>
        </View>
      ) : null}

      {/* SEARCH BAR, PRICE FILTER & SORT */}
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
                : "Search artworks, styles, mediums…"
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

        {/* PRICE FILTER BUTTON */}
        <Pressable
          style={[
            styles.iconButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            activePriceLabel !== null && { borderColor: colors.gold, backgroundColor: colors.goldSoft },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowPriceModal(true);
          }}
          accessibilityLabel="Filter by Price"
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activePriceLabel !== null ? colors.gold : colors.text}
          />
        </Pressable>

        {/* SORT BUTTON */}
        <Pressable
          style={[
            styles.iconButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            sortBy !== "featured" && { borderColor: colors.gold, backgroundColor: colors.goldSoft },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowSortMenu((prev) => !prev);
          }}
          accessibilityLabel="Sort Artworks"
        >
          <Ionicons
            name="swap-vertical-outline"
            size={18}
            color={sortBy !== "featured" ? colors.gold : colors.text}
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
              { id: "featured", label: "Featured (Newest)" },
              { id: "price_asc", label: "Price: Low to High" },
              { id: "price_desc", label: "Price: High to Low" },
              { id: "title_asc", label: "Title: A to Z" },
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

      {/* REAL CATEGORY FILTER CHIPS & FOLLOWED ARTISTS CHIP */}
      <View style={styles.categoryFiltersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {/* ALL CATEGORIES CHIP */}
          <Pressable
            onPress={() => {
              handleCategorySelect(null);
              setOnlyFollowedArtists(false);
            }}
            style={[
              styles.filter,
              {
                backgroundColor:
                  selectedCategoryId === null && !onlyFollowedArtists
                    ? colors.goldSoft
                    : colors.card,
                borderColor:
                  selectedCategoryId === null && !onlyFollowedArtists
                    ? colors.gold
                    : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color:
                    selectedCategoryId === null && !onlyFollowedArtists
                      ? colors.gold
                      : colors.textSecondary,
                },
                selectedCategoryId === null && !onlyFollowedArtists && { fontFamily: FONTS.sansBold },
              ]}
            >
              All Artworks
            </Text>
          </Pressable>

          {/* FOLLOWED ARTISTS QUICK FILTER CHIP */}
          {savedArtistIds.length > 0 ? (
            <Pressable
              onPress={() => {
                try {
                  void Haptics.selectionAsync();
                } catch {}
                setOnlyFollowedArtists((prev) => !prev);
              }}
              style={[
                styles.filter,
                {
                  backgroundColor: onlyFollowedArtists ? colors.goldSoft : colors.card,
                  borderColor: onlyFollowedArtists ? colors.gold : colors.border,
                },
              ]}
            >
              <Ionicons
                name={onlyFollowedArtists ? "bookmark" : "bookmark-outline"}
                size={13}
                color={onlyFollowedArtists ? colors.gold : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: onlyFollowedArtists ? colors.gold : colors.textSecondary },
                  onlyFollowedArtists && { fontFamily: FONTS.sansBold },
                ]}
              >
                Followed Artists ({savedArtistIds.length})
              </Text>
            </Pressable>
          ) : null}

          {/* REAL DYNAMIC CATEGORIES */}
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => handleCategorySelect(cat.id)}
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
                  {cat.name} {cat.count ? `(${cat.count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ACTIVE FILTERS & COUNT BAR */}
      <View style={styles.resultsInfoRow}>
        <View style={styles.resultsLeft}>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {loading ? "Discovering…" : `${displayCount} Artworks`}
          </Text>
          {sortBy !== "featured" ? (
            <Text style={[styles.activeBadge, { color: colors.gold }]}>• {sortLabel}</Text>
          ) : null}
        </View>

        {hasActiveFilters ? (
          <Pressable onPress={clearAllFilters} style={styles.clearAllBtn}>
            <Text style={[styles.clearAllText, { color: colors.gold }]}>Clear Filters</Text>
            <Ionicons name="refresh-outline" size={13} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>

      {/* ACTIVE FILTER BADGES ROW */}
      {hasActiveFilters && (activePriceLabel || selectedCategoryId !== null || debouncedSearch || onlyFollowedArtists) ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeTagsRow}
        >
          {onlyFollowedArtists ? (
            <View style={[styles.tagBadge, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
              <Text style={[styles.tagText, { color: colors.gold }]}>★ Followed Artists</Text>
              <Pressable onPress={() => setOnlyFollowedArtists(false)}>
                <Ionicons name="close" size={13} color={colors.gold} />
              </Pressable>
            </View>
          ) : null}

          {debouncedSearch ? (
            <View style={[styles.tagBadge, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
              <Text style={[styles.tagText, { color: colors.gold }]}>"{debouncedSearch}"</Text>
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close" size={13} color={colors.gold} />
              </Pressable>
            </View>
          ) : null}

          {selectedCategoryId !== null ? (
            <View style={[styles.tagBadge, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
              <Text style={[styles.tagText, { color: colors.gold }]}>{selectedCategoryName}</Text>
              <Pressable onPress={() => setSelectedCategoryId(null)}>
                <Ionicons name="close" size={13} color={colors.gold} />
              </Pressable>
            </View>
          ) : null}

          {activePriceLabel ? (
            <View style={[styles.tagBadge, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
              <Text style={[styles.tagText, { color: colors.gold }]}>{activePriceLabel}</Text>
              <Pressable
                onPress={() => {
                  setSelectedPresetId("all");
                  setMinPrice(undefined);
                  setMaxPrice(undefined);
                  setCustomMinInput("");
                  setCustomMaxInput("");
                }}
              >
                <Ionicons name="close" size={13} color={colors.gold} />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      ) : null}

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
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => (
          <ArtworkGridCard
            product={item}
            index={index}
            isSaved={isSaved(item.id)}
            onToggleWishlist={() => toggleWishlist(item)}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
                Loading curated collection…
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View
                    style={[
                      styles.skeletonImage,
                      { backgroundColor: isDark ? "#20222C" : "#E8E2D6" },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonTitle,
                      { backgroundColor: isDark ? "#20222C" : "#E8E2D6" },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonPrice,
                      { backgroundColor: isDark ? "#20222C" : "#E8E2D6" },
                    ]}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons
                name={error ? "cloud-offline-outline" : "images-outline"}
                size={38}
                color={colors.gold}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                {error ??
                  (debouncedSearch
                    ? `No artworks found for "${debouncedSearch}".`
                    : "No artworks match the selected filters.")}
              </Text>
              {hasActiveFilters ? (
                <Pressable
                  style={[styles.clearSearchBtn, { backgroundColor: colors.gold }]}
                  onPress={clearAllFilters}
                >
                  <Text style={styles.clearSearchBtnText}>RESET ALL FILTERS</Text>
                </Pressable>
              ) : null}
              {error ? (
                <Pressable
                  style={[styles.retry, { backgroundColor: colors.gold }]}
                  onPress={() => fetchArtworks(1, true)}
                >
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchArtworks(1, true)}
            colors={[colors.gold]}
            tintColor={colors.gold}
          />
        }
      />

      {/* LUXURY INR PRICE FILTER MODAL */}
      <Modal
        visible={showPriceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPriceModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPriceModal(false)}>
          <Pressable
            style={[
              styles.priceSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.priceSheetHeader}>
              <View>
                <Text style={[styles.priceSheetEyebrow, { color: colors.gold }]}>PRICE RANGE (INR ₹)</Text>
                <Text style={[styles.priceSheetTitle, { color: colors.text }]}>Filter by Value</Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { borderColor: colors.border }]}
                onPress={() => setShowPriceModal(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* PRESETS LIST */}
            <Text style={[styles.priceSectionLabel, { color: colors.textSecondary }]}>
              CURATED PRESETS
            </Text>
            <View style={styles.presetsGrid}>
              {PRICE_PRESETS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => handlePresetSelect(preset)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: active ? colors.goldSoft : colors.background,
                        borderColor: active ? colors.gold : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: active ? colors.gold : colors.text },
                        active && { fontFamily: FONTS.sansBold },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* CUSTOM INR RANGE */}
            <Text style={[styles.priceSectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              CUSTOM INR RANGE
            </Text>
            <View style={styles.customPriceRow}>
              <View style={[styles.priceInputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Text style={[styles.currencyPrefix, { color: colors.gold }]}>₹</Text>
                <TextInput
                  style={[styles.priceInput, { color: colors.text }]}
                  placeholder="Min Price"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={customMinInput}
                  onChangeText={(val) => {
                    setCustomMinInput(val);
                    setSelectedPresetId("custom");
                  }}
                />
              </View>
              <Text style={[styles.priceDivider, { color: colors.textSecondary }]}>–</Text>
              <View style={[styles.priceInputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Text style={[styles.currencyPrefix, { color: colors.gold }]}>₹</Text>
                <TextInput
                  style={[styles.priceInput, { color: colors.text }]}
                  placeholder="Max Price"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={customMaxInput}
                  onChangeText={(val) => {
                    setCustomMaxInput(val);
                    setSelectedPresetId("custom");
                  }}
                />
              </View>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.priceActionRow}>
              <Pressable
                style={[styles.resetPriceBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setSelectedPresetId("all");
                  setMinPrice(undefined);
                  setMaxPrice(undefined);
                  setCustomMinInput("");
                  setCustomMaxInput("");
                  setShowPriceModal(false);
                }}
              >
                <Text style={[styles.resetPriceBtnText, { color: colors.textSecondary }]}>RESET</Text>
              </Pressable>
              <Pressable
                style={[styles.applyPriceBtn, { backgroundColor: colors.gold }]}
                onPress={applyCustomPrice}
              >
                <Text style={styles.applyPriceBtnText}>APPLY PRICE FILTER</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  const image = product.images?.[0];
  const price = product.price || product.regular_price;

  const heightPatterns = [220, 250, 205, 235];
  const frameHeight = heightPatterns[index % heightPatterns.length];

  return (
    <Pressable
      style={({ pressed }) => [styles.gridCard, pressed && styles.cardPressed]}
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
        {image?.src ? (
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

      <Text style={[styles.productName, { color: isDark ? colors.gold : colors.text }]} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={[styles.productMeta, { color: colors.textSecondary }]}>
        {product.categories?.[0]?.name ?? "Original artwork"}
      </Text>
      <Text style={[styles.price, { color: colors.gold }]}>
        {price ? `₹ ${Number(price).toLocaleString("en-IN")}` : "Price on request"}
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
    fontSize: 28,
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
    gap: 8,
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    alignItems: "center",
    justifyContent: "center",
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
  filterText: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  resultsInfoRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  resultsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultsCount: {
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  activeBadge: {
    color: "#B8964E",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearAllText: {
    color: "#B8964E",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  activeTagsRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
    flexDirection: "row",
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
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
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loadingMoreText: {
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
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

  // Price Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  priceSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  priceSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  priceSheetEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  priceSheetTitle: {
    fontSize: 20,
    fontFamily: FONTS.serifBold,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  priceSectionLabel: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
  },
  customPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceInputBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  priceDivider: {
    fontSize: 16,
    fontFamily: FONTS.sansBold,
  },
  priceActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    marginBottom: Platform.OS === "ios" ? 16 : 6,
  },
  resetPriceBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetPriceBtnText: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  applyPriceBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyPriceBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
});
