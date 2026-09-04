import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { WooCommerceProduct } from "@/services/woocommerce";

export type ProfileWishlistSectionProps = {
  savedProducts: WooCommerceProduct[];
  onRemove: (id: number) => void;
  onViewAll: () => void;
  onExplore: () => void;
  onSelectArtwork: (id: number) => void;
};

export function ProfileWishlistSection({
  savedProducts,
  onRemove,
  onViewAll,
  onExplore,
  onSelectArtwork,
}: ProfileWishlistSectionProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.wishlistSection}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.sectionHeader, { color: colors.gold }]}>MY SAVED COLLECTION</Text>
          <Text
            style={[
              styles.wishlistCountBadge,
              { backgroundColor: colors.goldBadge, color: colors.goldBadgeText },
            ]}
          >
            {savedProducts.length}
          </Text>
        </View>

        {savedProducts.length > 0 ? (
          <Pressable
            style={styles.viewAllBtn}
            onPress={onViewAll}
          >
            <Text style={[styles.viewAllText, { color: colors.gold }]}>View All Artworks</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>

      {savedProducts.length > 0 ? (
        <FlatList
          horizontal
          data={savedProducts}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wishlistList}
          renderItem={({ item }) => (
            <SavedArtworkCard
              product={item}
              isDark={isDark}
              colors={colors}
              onSelect={() => onSelectArtwork(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          )}
        />
      ) : (
        <View
          style={[
            styles.emptyWishlistCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="heart-outline" size={32} color={colors.gold} />
          <Text style={[styles.emptyWishlistTitle, { color: colors.text }]}>No Saved Artworks Yet</Text>
          <Text style={[styles.emptyWishlistSub, { color: colors.textSecondary }]}>
            Tap the heart icon on any artwork to save it to your private collection.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.exploreWishlistBtn,
              { backgroundColor: colors.gold },
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
            onPress={onExplore}
          >
            <Text style={styles.exploreWishlistBtnText}>EXPLORE ARTWORKS</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SavedArtworkCard({
  product,
  isDark,
  colors,
  onSelect,
  onRemove,
}: {
  product: WooCommerceProduct;
  isDark: boolean;
  colors: any;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.savedCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
      ]}
      onPress={onSelect}
    >
      <View
        style={[
          styles.savedCardImageWrap,
          { backgroundColor: isDark ? "#20222C" : "#FAF6EC" },
        ]}
      >
        {product.images[0]?.src ? (
          <ExpoImage
            source={{ uri: product.images[0].src }}
            style={styles.savedCardImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.savedCardImageFallback}>
            <Ionicons name="image-outline" size={24} color={colors.gold} />
          </View>
        )}
        <Pressable
          style={styles.removeSaveBtn}
          onPress={(e) => {
            e.stopPropagation();
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onRemove();
          }}
          accessibilityLabel="Remove from wishlist"
        >
          <Ionicons name="heart" size={16} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.savedCardBody}>
        <Text style={[styles.savedCardTitle, { color: colors.text }]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.savedCardPrice, { color: colors.gold }]}>
          {product.price ? `₹ ${product.price}` : "Price on request"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wishlistSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeader: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  viewAllText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  wishlistCountBadge: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  wishlistList: {
    paddingVertical: 4,
    gap: 12,
  },
  savedCard: {
    width: 150,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    marginRight: 12,
  },
  savedCardImageWrap: {
    width: "100%",
    height: 120,
    backgroundColor: "#FAF6EC",
    position: "relative",
  },
  savedCardImage: {
    width: "100%",
    height: "100%",
  },
  savedCardImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  removeSaveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardBody: {
    padding: 10,
  },
  savedCardTitle: {
    color: "#252525",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  savedCardPrice: {
    marginTop: 2,
    color: "#B8964E",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  emptyWishlistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    gap: 6,
  },
  emptyWishlistTitle: {
    marginTop: 4,
    color: "#252525",
    fontSize: 15,
    fontFamily: FONTS.serifBold,
  },
  emptyWishlistSub: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  exploreWishlistBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#B8964E",
  },
  exploreWishlistBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
});
