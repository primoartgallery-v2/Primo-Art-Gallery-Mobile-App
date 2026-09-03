import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getLocalSavedArtists,
  getCloudSavedArtists,
  toggleSavedArtist,
} from "@/services/savedArtistsStorage";
import {
  extractProductArtistIds,
  getArtistsList,
  getPersistentArtistsList,
  getProducts,
  type ArtistItem,
} from "@/services/woocommerce";

export default function ArtistsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [savedArtistIds, setSavedArtistIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "saved">("all");
  const [artistArtworksCount, setArtistArtworksCount] = useState<
    Record<string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadArtists = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      // Instant Cached Render if available
      try {
        const cached = await getPersistentArtistsList();
        if (cached && cached.length > 0) {
          setArtists(cached);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
      } catch {
        setIsLoading(true);
      }
    }
    setErrorMessage(null);

    try {
      const [list, productsRes] = await Promise.all([
        getArtistsList(refresh),
        getProducts({ page: 1, perPage: 30, forceRefresh: refresh }).catch(
          () => null
        ),
      ]);

      setArtists(list);

      if (productsRes?.products) {
        const counts: Record<string, number> = {};
        productsRes.products.forEach((p) => {
          const artistIds = extractProductArtistIds(p);
          artistIds.forEach((id) => {
            counts[id] = (counts[id] || 0) + 1;
          });
        });
        setArtistArtworksCount(counts);
      }
    } catch (err) {
      setArtists((current) => {
        if (current.length === 0) {
          setErrorMessage(
            err instanceof Error ? err.message : "Unable to load artists list."
          );
        }
        return current;
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadArtists();

    // Load saved artists for active user (or guest)
    getLocalSavedArtists(user?.id)
      .then((ids) => {
        setSavedArtistIds(ids);
        if (user?.id) {
          getCloudSavedArtists()
            .then((cloudIds) => {
              if (cloudIds) setSavedArtistIds(cloudIds);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [loadArtists, user?.id]);

  const handleToggleSaveArtist = useCallback(
    async (artistId: string | number) => {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      const { savedIds } = await toggleSavedArtist(artistId, user?.id);
      setSavedArtistIds(savedIds);
    },
    [user?.id]
  );

  const filteredArtists = useMemo(() => {
    let list = artists;

    // Apply Saved tab filter
    if (activeTab === "saved") {
      list = list.filter((a) => savedArtistIds.includes(String(a.id)));
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q))
    );
  }, [artists, savedArtistIds, activeTab, searchQuery]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            onPress={() => {
              try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              router.back();
            }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
            <Text style={[styles.title, { color: colors.text }]}>Gallery Artists</Text>
          </View>
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

      {/* TABS: ALL ARTISTS / SAVED ARTISTS */}
      <View style={styles.tabBar}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "all"
              ? [styles.activeTabButton, { backgroundColor: colors.gold }]
              : { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setActiveTab("all");
          }}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === "all" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            ALL ARTISTS ({artists.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === "saved"
              ? [styles.activeTabButton, { backgroundColor: colors.gold }]
              : { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setActiveTab("saved");
          }}
        >
          <Ionicons
            name={activeTab === "saved" ? "bookmark" : "bookmark-outline"}
            size={13}
            color={activeTab === "saved" ? "#FFFFFF" : colors.gold}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === "saved" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            SAVED ({savedArtistIds.length})
          </Text>
        </Pressable>
      </View>

      {/* SEARCH BAR */}
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
              activeTab === "saved"
                ? "Search saved artists…"
                : "Search artists by name or style…"
            }
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* COUNT BAR */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {filteredArtists.length}{" "}
          {filteredArtists.length === 1 ? "Artist" : "Artists"}
          {activeTab === "saved" ? " in your private collection" : " in gallery roster"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading master artists…</Text>
        </View>
      ) : errorMessage && artists.length === 0 ? (
        <View style={styles.stateContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.gold} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Unable to Load Artists</Text>
          <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>{errorMessage}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.gold }]} onPress={() => loadArtists(true)}>
            <Text style={styles.retryButtonText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredArtists}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadArtists(true)}
              colors={[colors.gold]}
              tintColor={colors.gold}
            />
          }
          renderItem={({ item }) => (
            <ArtistCard
              artist={item}
              artworksCount={artistArtworksCount[String(item.id)]}
              isSaved={savedArtistIds.includes(String(item.id))}
              onToggleSave={() => handleToggleSaveArtist(item.id)}
              onPress={() => {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.push({
                  pathname: "/explore",
                  params: {
                    artistId: String(item.id),
                    artistName: item.name,
                  },
                });
              }}
            />
          )}
          ListEmptyComponent={
            activeTab === "saved" && !searchQuery.trim() ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={38} color={colors.gold} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Saved Artists Yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Bookmark your favorite master artists to easily discover their original artworks.
                </Text>
                <Pressable
                  style={[styles.exploreBtn, { backgroundColor: colors.gold }]}
                  onPress={() => setActiveTab("all")}
                >
                  <Text style={styles.exploreBtnText}>EXPLORE ALL ARTISTS</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={38} color={colors.gold} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Artists Found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? `No artists matched "${searchQuery}".`
                    : "No artists available at this time."}
                </Text>
              </View>
            )
          }
        />
      )}

      <AppBottomNav />
    </SafeAreaView>
  );
}

const ArtistCard = React.memo(function ArtistCard({
  artist,
  artworksCount,
  isSaved,
  onToggleSave,
  onPress,
}: {
  artist: ArtistItem;
  artworksCount?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const count = artworksCount ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.artistCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${artist.name}`}
    >
      <View
        style={[
          styles.imageFrame,
          { backgroundColor: isDark ? "#232530" : "#F4EFE6" },
        ]}
      >
        {artist.imageUrl ? (
          <ExpoImage
            source={{ uri: artist.imageUrl }}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <Ionicons name="person" size={36} color={colors.gold} />
        )}

        {/* SAVE / BOOKMARK BUTTON */}
        {onToggleSave ? (
          <Pressable
            style={[
              styles.saveArtistBtn,
              {
                backgroundColor: isSaved
                  ? colors.gold
                  : isDark
                  ? "rgba(23, 24, 33, 0.85)"
                  : "rgba(255, 255, 255, 0.9)",
                borderColor: isSaved ? colors.gold : colors.border,
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            accessibilityLabel={isSaved ? "Unsave artist" : "Save artist"}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={14}
              color={isSaved ? "#FFFFFF" : colors.gold}
            />
          </Pressable>
        ) : null}
      </View>

      <Text
        style={[
          styles.artistName,
          { color: isDark ? colors.gold : "#252525" },
        ]}
        numberOfLines={1}
      >
        {artist.name}
      </Text>

      <Text style={styles.artistCategory} numberOfLines={1}>
        {artist.category || "Contemporary Artist"}
      </Text>

      <View style={styles.viewArtworksPill}>
        <Text style={styles.viewArtworksText}>
          {count > 0
            ? `${count} ${count === 1 ? "ARTWORK" : "ARTWORKS"}`
            : "VIEW COLLECTION"}
        </Text>
        <Ionicons name="chevron-forward" size={11} color="#B8964E" />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE0",
    backgroundColor: "#FAF8F3",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 2,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 24,
  },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
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
  countRow: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  countText: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    paddingTop: 4,
  },
  columnWrapper: {
    justifyContent: "space-between",
    gap: 12,
  },
  artistCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    alignItems: "center",
    marginBottom: 14,
  },
  cardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  imageFrame: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: "hidden",
    backgroundColor: "#F7EEDB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E9D9B4",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  artistName: {
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    textAlign: "center",
  },
  artistCategory: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  viewArtworksPill: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewArtworksText: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  loadingText: {
    marginTop: 12,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 80,
  },
  stateTitle: {
    marginTop: 14,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 22,
  },
  stateSubtitle: {
    marginTop: 6,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#B8964E",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: "center",
    paddingHorizontal: 30,
  },
  emptyTitle: {
    marginTop: 12,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 18,
  },
  emptyText: {
    marginTop: 4,
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activeTabButton: {
    borderColor: "transparent",
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  saveArtistBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  exploreBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
});
