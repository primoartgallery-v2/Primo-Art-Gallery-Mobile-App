import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { WooCommerceProduct } from "@/services/woocommerce";

export type ExploreArtworkCardProps = {
  product: WooCommerceProduct;
  index: number;
  isSaved: boolean;
  onToggleWishlist: () => void;
  onPress: () => void;
};

export const ExploreArtworkCard = React.memo(function ExploreArtworkCard({
  product,
  index,
  isSaved,
  onToggleWishlist,
  onPress,
}: ExploreArtworkCardProps) {
  const { colors, isDark } = useAppTheme();
  const image = product.images?.[0];
  const price = product.price || product.regular_price;

  const heightPatterns = [220, 250, 205, 235];
  const frameHeight = heightPatterns[index % heightPatterns.length];

  return (
    <Pressable
      style={({ pressed }) => [styles.gridCard, pressed && styles.cardPressed]}
      onPress={onPress}
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
  image: {
    width: "100%",
    height: "100%",
  },
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
});
