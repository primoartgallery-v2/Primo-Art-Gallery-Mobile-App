import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ArtistItem } from "@/services/woocommerce";

export type HomeFeaturedArtistsProps = {
  artists: ArtistItem[];
  onSelectArtist: (artist: ArtistItem) => void;
  onViewAll: () => void;
};

export function HomeFeaturedArtists({
  artists,
  onSelectArtist,
  onViewAll,
}: HomeFeaturedArtistsProps) {
  const { colors, isDark } = useAppTheme();

  if (!artists || artists.length === 0) return null;

  return (
    <View style={styles.artistsSection}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionSmall, { color: colors.gold }]}>CONTEMPORARY CREATORS</Text>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Artists</Text>
        </View>
        <Pressable
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onViewAll();
          }}
        >
          <Text style={[styles.viewAll, { color: colors.gold }]}>View All</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.artistsListContent}
      >
        {artists.slice(0, 10).map((artist) => (
          <Pressable
            key={artist.id}
            style={({ pressed }) => [
              styles.artistCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.scalePressed,
            ]}
            onPress={() => {
              try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onSelectArtist(artist);
            }}
          >
            <View
              style={[
                styles.artistAvatarWrap,
                { backgroundColor: isDark ? "#20222C" : "#FAF6EC" },
              ]}
            >
              {artist.imageUrl ? (
                <ExpoImage
                  source={{ uri: artist.imageUrl }}
                  style={styles.artistAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Ionicons name="person" size={26} color={colors.gold} />
              )}
            </View>
            <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={1}>
              {artist.name}
            </Text>
            <Text style={[styles.artistCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {artist.category || "Master Artist"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  artistsSection: {
    marginTop: 10,
    marginBottom: 8,
  },
  sectionHeader: {
    marginTop: 24,
    marginHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionSmall: {
    color: "#B8860B",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONTS.sansExtraBold,
  },
  sectionTitle: {
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
  artistsListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    gap: 12,
  },
  artistCard: {
    width: 124,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  artistAvatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  artistAvatar: {
    width: "100%",
    height: "100%",
  },
  artistName: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
    textAlign: "center",
  },
  artistCategory: {
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
    marginTop: 2,
    textAlign: "center",
  },
  scalePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
