import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export type HomeCuratedHeroProps = {
  onExplore: () => void;
};

export function HomeCuratedHero({ onExplore }: HomeCuratedHeroProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.hero, { backgroundColor: isDark ? "#171821" : "#17202A" }]}>
      <Text style={[styles.smallTitle, { color: colors.gold }]}>WELCOME TO</Text>

      <Text style={styles.heroTitle}>PRIMO ART GALLERY</Text>

      <View style={[styles.goldLine, { backgroundColor: colors.gold }]} />

      <Text style={styles.heroSubtitle}>Where Art Meets Elegance</Text>

      <Text style={styles.heroDescription}>
        Discover original handmade artworks, thoughtfully curated from
        talented Indian artists.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.gold },
          pressed && styles.scalePressed,
        ]}
        onPress={onExplore}
      >
        <Text style={styles.primaryButtonText}>EXPLORE ARTWORKS</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 27,
    borderRadius: 24,
    backgroundColor: "#17202A",
  },
  smallTitle: {
    color: "#C9A227",
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: FONTS.sansExtraBold,
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: FONTS.serifBold,
    letterSpacing: 1,
    lineHeight: 40,
  },
  goldLine: {
    width: 55,
    height: 2,
    backgroundColor: "#C9A227",
    marginVertical: 17,
  },
  heroSubtitle: {
    color: "#E5D6A3",
    fontSize: 18,
    fontFamily: FONTS.serifItalic,
    marginBottom: 12,
  },
  heroDescription: {
    color: "#D8D8D8",
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
    lineHeight: 22,
    marginBottom: 22,
  },
  primaryButton: {
    height: 50,
    paddingHorizontal: 19,
    borderRadius: 25,
    backgroundColor: "#B8860B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
