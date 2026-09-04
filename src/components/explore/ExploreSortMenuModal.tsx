import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export type SortOption = "featured" | "price_asc" | "price_desc" | "title_asc";

const SORT_OPTIONS = [
  { id: "featured", label: "Featured (Newest)" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "title_asc", label: "Title: A to Z" },
] as const;

export type ExploreSortMenuModalProps = {
  visible: boolean;
  currentSort: SortOption;
  onSelectSort: (option: SortOption) => void;
};

export function ExploreSortMenuModal({
  visible,
  currentSort,
  onSelectSort,
}: ExploreSortMenuModalProps) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.sortMenu,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sortMenuTitle, { color: colors.gold }]}>SORT BY</Text>
      {SORT_OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          style={[
            styles.sortOptionRow,
            { borderBottomColor: colors.borderLight },
            currentSort === opt.id && styles.sortOptionRowSelected,
          ]}
          onPress={() => onSelectSort(opt.id)}
        >
          <Text
            style={[
              styles.sortOptionText,
              { color: colors.textSecondary },
              currentSort === opt.id && { color: colors.text, fontFamily: FONTS.sansBold },
            ]}
          >
            {opt.label}
          </Text>
          {currentSort === opt.id ? (
            <Ionicons name="checkmark" size={16} color={colors.gold} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sortMenu: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  sortMenuTitle: {
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
  },
  sortOptionRowSelected: {
    backgroundColor: "transparent",
  },
  sortOptionText: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
});
