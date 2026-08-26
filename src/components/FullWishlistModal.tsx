import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { WooCommerceProduct } from "@/services/woocommerce";

type FullWishlistModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FullWishlistModal({ visible, onClose }: FullWishlistModalProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { savedProducts, removeFromWishlist } = useWishlist();

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleOpenPainting = (id: number) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
    router.push(`/painting/${id}` as any);
  };

  const handleRemove = (product: WooCommerceProduct) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    removeFromWishlist(product.id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <StatusBar barStyle={colors.statusBar} />

        {/* HEADER */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.headerBackground,
              borderBottomColor: colors.borderLight,
            },
          ]}
        >
          <Pressable
            style={[
              styles.backButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={handleClose}
            accessibilityLabel="Close wishlist"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>
              MY SAVED COLLECTION
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Wishlist Artworks
            </Text>
          </View>

          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.goldBadge, borderColor: colors.gold },
            ]}
          >
            <Text
              style={[styles.countBadgeText, { color: colors.goldBadgeText }]}
            >
              {savedProducts.length}
            </Text>
          </View>
        </View>

        {/* ARTWORKS GRID */}
        {savedProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <Ionicons name="heart-outline" size={44} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Your Wishlist is Empty
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              Explore our masterworks catalog and tap the heart icon on any painting to save it to your private collection.
            </Text>
            <Pressable
              style={[styles.exploreButton, { backgroundColor: colors.gold }]}
              onPress={() => {
                handleClose();
                router.push("/explore" as any);
              }}
            >
              <Text style={styles.exploreButtonText}>EXPLORE ARTWORKS</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={savedProducts}
            numColumns={2}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const image = item.images[0]?.src;
              const price = item.price || item.regular_price;

              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleOpenPainting(item.id)}
                >
                  <View style={styles.imageWrap}>
                    {image ? (
                      <ExpoImage
                        source={{ uri: image }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View
                        style={[
                          styles.imageFallback,
                          { backgroundColor: colors.backgroundElement },
                        ]}
                      >
                        <Ionicons
                          name="image-outline"
                          size={32}
                          color={colors.textMuted}
                        />
                      </View>
                    )}

                    {/* REMOVE BUTTON */}
                    <Pressable
                      style={styles.removeBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemove(item);
                      }}
                      accessibilityLabel="Remove from wishlist"
                    >
                      <Ionicons name="heart" size={18} color="#E74C3C" />
                    </Pressable>
                  </View>

                  <View style={styles.cardBody}>
                    <Text
                      style={[styles.cardTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.cardPrice, { color: colors.gold }]}
                    >
                      {price ? `₹${Number(price).toLocaleString("en-IN")}` : "Price on request"}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 19,
    fontFamily: FONTS.serifBold,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 14,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    height: 190,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  cardPrice: {
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  exploreButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exploreButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
});
