import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { WooCommerceCategory } from "@/services/woocommerce";

export type ExploreCategoryBarProps = {
  categories: WooCommerceCategory[];
  selectedCategoryId: number | null;
  savedArtistIdsCount: number;
  onlyFollowedArtists: boolean;
  onSelectCategory: (catId: number | null) => void;
  onToggleFollowedArtists: () => void;
};

export function ExploreCategoryBar({
  categories,
  selectedCategoryId,
  savedArtistIdsCount,
  onlyFollowedArtists,
  onSelectCategory,
  onToggleFollowedArtists,
}: ExploreCategoryBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.categoryFiltersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {/* ALL CATEGORIES CHIP */}
        <Pressable
          onPress={() => onSelectCategory(null)}
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
        {savedArtistIdsCount > 0 ? (
          <Pressable
            onPress={onToggleFollowedArtists}
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
              Followed Artists ({savedArtistIdsCount})
            </Text>
          </Pressable>
        ) : null}

        {/* REAL DYNAMIC CATEGORIES */}
        {categories.map((cat) => {
          const active = selectedCategoryId === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onSelectCategory(cat.id)}
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
  );
}

const styles = StyleSheet.create({
  categoryFiltersContainer: {
    paddingVertical: 4,
  },
  filters: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  filterText: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
});
