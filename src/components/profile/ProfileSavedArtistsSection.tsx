import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export type SavedArtistItem = {
  id: string | number;
  name: string;
  avatarUrl?: string | null;
  bio?: string;
};

export type ProfileSavedArtistsSectionProps = {
  artists: SavedArtistItem[];
  onSelectArtist: (artistId: string | number) => void;
  onUnfollowArtist?: (artistId: string | number) => void;
  onExploreArtists?: () => void;
};

export function ProfileSavedArtistsSection({
  artists,
  onSelectArtist,
  onUnfollowArtist,
  onExploreArtists,
}: ProfileSavedArtistsSectionProps) {
  const { colors, isDark } = useAppTheme();

  if (!artists || artists.length === 0) {
    return null;
  }

  return (
    <View style={styles.artistsSection}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.sectionHeader, { color: colors.gold }]}>FOLLOWED ARTISTS</Text>
          <Text
            style={[
              styles.countBadge,
              { backgroundColor: colors.goldBadge, color: colors.goldBadgeText },
            ]}
          >
            {artists.length}
          </Text>
        </View>

        {onExploreArtists ? (
          <Pressable style={styles.viewAllBtn} onPress={onExploreArtists}>
            <Text style={[styles.viewAllText, { color: colors.gold }]}>Discover More</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={artists}
        keyExtractor={(item) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.artistsList}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.artistCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
            ]}
            onPress={() => onSelectArtist(item.id)}
          >
            <View
              style={[
                styles.artistAvatarWrap,
                { backgroundColor: isDark ? "#20222C" : "#FAF6EC" },
              ]}
            >
              {item.avatarUrl ? (
                <ExpoImage
                  source={{ uri: item.avatarUrl }}
                  style={styles.artistAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Ionicons name="person" size={28} color={colors.gold} />
              )}

              {onUnfollowArtist ? (
                <Pressable
                  style={styles.unfollowBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    try {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    onUnfollowArtist(item.id);
                  }}
                  accessibilityLabel="Unfollow artist"
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.artistInfo}>
              <Text
                style={[styles.artistName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.artistBio, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.bio || "Master Practitioner"}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  artistsSection: {
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
  countBadge: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
  artistsList: {
    paddingVertical: 4,
    gap: 12,
  },
  artistCard: {
    width: 140,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    marginRight: 12,
  },
  artistAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
  },
  artistAvatar: {
    width: "100%",
    height: "100%",
  },
  unfollowBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
  },
  artistInfo: {
    alignItems: "center",
    width: "100%",
  },
  artistName: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    textAlign: "center",
  },
  artistBio: {
    fontSize: 10.5,
    fontFamily: FONTS.sansRegular,
    marginTop: 2,
    textAlign: "center",
  },
});
