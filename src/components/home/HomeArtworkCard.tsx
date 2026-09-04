import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { WooCommerceProduct } from "@/services/woocommerce";

export type HomeArtworkCardProps = {
  product: WooCommerceProduct;
  isSaved: boolean;
  onToggleWishlist: (product: WooCommerceProduct) => void;
  onPress: (productId: number) => void;
};

export const HomeArtworkCard = React.memo(function HomeArtworkCard({
  product,
  isSaved,
  onToggleWishlist,
  onPress,
}: HomeArtworkCardProps) {
  const { colors, isDark } = useAppTheme();
  const imageUrl = product.images[0]?.src;
  const productPrice = product.price || product.regular_price;

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
        onPress(product.id);
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
            onToggleWishlist(product);
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

      <Text numberOfLines={2} style={[styles.productName, { color: isDark ? colors.gold : colors.text }]}>
        {product.name}
      </Text>

      <Text style={[styles.productPrice, { color: colors.gold }]}>
        {productPrice ? `₹ ${productPrice}` : "Price on request"}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
