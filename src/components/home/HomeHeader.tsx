import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ArtistItem, WooCommerceProduct } from "@/services/woocommerce";

export type HomeSearchResultShortcut = {
  id: string;
  icon: any;
  title: string;
  subtitle: string;
  action: () => void;
};

export type HomeSearchResultsData = {
  artworks: WooCommerceProduct[];
  artists: ArtistItem[];
  shortcuts: HomeSearchResultShortcut[];
  hasResults: boolean;
};

export type HomeHeaderProps = {
  searchQuery: string;
  searchResults: HomeSearchResultsData | null;
  totalProductsCount: number;
  onChangeSearchQuery: (text: string) => void;
  onClearSearch: () => void;
  onOpenNotifications: () => void;
  onSelectArtwork: (id: number) => void;
  onSelectArtist: (artist: ArtistItem) => void;
  onSelectShortcut: (action: () => void) => void;
  onBrowseAllCollection: () => void;
};

export function HomeHeader({
  searchQuery,
  searchResults,
  totalProductsCount,
  onChangeSearchQuery,
  onClearSearch,
  onOpenNotifications,
  onSelectArtwork,
  onSelectArtist,
  onSelectShortcut,
  onBrowseAllCollection,
}: HomeHeaderProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <>
      {/* BRANDING HEADER */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <Image
          source={require("../../../assets/images/primo-logo.png")}
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
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onOpenNotifications();
          }}
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
            onChangeText={onChangeSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable
              onPress={() => {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                onClearSearch();
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
                        try {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        onSelectArtwork(item.id);
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
                        <Text style={[styles.resultTitle, { color: isDark ? colors.gold : colors.text }]} numberOfLines={1}>
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
                        try {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        onSelectArtist(artist);
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
                      onPress={() => {
                        try {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        onSelectShortcut(sc.action);
                      }}
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
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  onBrowseAllCollection();
                }}
              >
                <Text style={styles.viewAllSearchBtnText}>
                  BROWSE COMPLETE COLLECTION ({totalProductsCount} ARTWORKS) →
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
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  onBrowseAllCollection();
                }}
              >
                <Text style={styles.exploreAllFallbackText}>
                  EXPLORE ALL ARTWORKS
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 92,
    paddingHorizontal: 22,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  searchClearBtn: {
    padding: 4,
  },
  searchResultsPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  resultArtistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  resultArtistAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  shortcutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  resultSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
  },
  resultPrice: {
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
  },
  viewArtistPillText: {
    fontSize: 9,
    fontFamily: FONTS.sansBold,
  },
  viewAllSearchBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewAllSearchBtnText: {
    color: "#FFFFFF",
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
    fontSize: 15,
    fontFamily: FONTS.serifBold,
  },
  noSearchSubtitle: {
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
  },
  exploreAllFallbackText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
