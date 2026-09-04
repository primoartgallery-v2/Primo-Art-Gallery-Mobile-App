import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { RecentlyViewedItem } from "@/services/recentlyViewedStorage";

export type HomeRecentlyViewedProps = {
  items: RecentlyViewedItem[];
  onBrowseAll: () => void;
  onSelectArtwork: (id: number) => void;
};

export function HomeRecentlyViewed({
  items,
  onBrowseAll,
  onSelectArtwork,
}: HomeRecentlyViewedProps) {
  const { colors, isDark } = useAppTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.recentlyViewedSection}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionSmall, { color: colors.gold }]}>CONTINUE EXPLORING</Text>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Viewed</Text>
        </View>
        <Pressable
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onBrowseAll();
          }}
        >
          <Text style={[styles.viewAll, { color: colors.gold }]}>Browse All</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentCarouselContent}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.recentCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.scalePressed,
            ]}
            onPress={() => {
              try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onSelectArtwork(item.id);
            }}
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
            <Text style={[styles.recentName, { color: isDark ? colors.gold : colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.recentPrice, { color: colors.gold }]}>
              {item.price ? `₹ ${Number(item.price).toLocaleString("en-IN")}` : "View Details"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  recentlyViewedSection: {
    marginBottom: 8,
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
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
