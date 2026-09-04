import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { CollectorEnquiryItem } from "@/services/enquiryService";
import {
  formatDate,
  formatStatus,
  type ArtworkEnrichment,
} from "./inquiryTypes";

export type InquiriesListViewProps = {
  enquiries: CollectorEnquiryItem[];
  artworkDetailsMap: Record<number, ArtworkEnrichment>;
  isLoading: boolean;
  onRefresh?: () => void;
  onSelectEnquiry: (enquiry: CollectorEnquiryItem) => void;
  onExplore: () => void;
};

export function InquiriesListView({
  enquiries,
  artworkDetailsMap,
  isLoading,
  onRefresh,
  onSelectEnquiry,
  onExplore,
}: InquiriesListViewProps) {
  const { colors, isDark } = useAppTheme();

  const renderEnquiryCard = ({ item }: { item: CollectorEnquiryItem }) => {
    const enrichment = artworkDetailsMap[item.artworkId];
    const statusInfo = formatStatus(item.status, colors.gold);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDark ? "#14151B" : "#FFFFFF",
            borderColor: isDark
              ? "rgba(212, 175, 55, 0.16)"
              : "rgba(0,0,0,0.08)",
          },
          pressed && {
            transform: [{ scale: 0.985 }],
            borderColor: colors.gold,
          },
        ]}
        onPress={() => onSelectEnquiry(item)}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.thumbnailContainer}>
            {enrichment?.imageUrl ? (
              <ExpoImage
                source={{ uri: enrichment.imageUrl }}
                style={styles.thumbnail}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.thumbnailFallback,
                  { backgroundColor: isDark ? "#20222C" : "#F4EFE6" },
                ]}
              >
                <Ionicons name="cube-outline" size={24} color={colors.gold} />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text
                style={[
                  styles.cardArtworkTitle,
                  { color: isDark ? "#FFFFFF" : colors.text },
                ]}
                numberOfLines={2}
              >
                {item.artworkTitle}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
                style={styles.cardChevron}
              />
            </View>

            <Text
              style={[
                styles.cardArtistName,
                { color: isDark ? "#D4AF37" : colors.gold },
              ]}
              numberOfLines={1}
            >
              {enrichment?.artistName || "Master Artist (Primo Curated)"}
            </Text>

            <View style={styles.cardMetaRow}>
              <Text
                style={[
                  styles.cardItemNumber,
                  { color: colors.textSecondary },
                ]}
              >
                Item #{item.artworkId}
              </Text>
              <Text style={[styles.cardMetaDot, { color: colors.border }]}>
                •
              </Text>
              <Text
                style={[
                  styles.cardDateText,
                  { color: colors.textSecondary },
                ]}
              >
                {formatDate(item.createdAt)}
              </Text>
            </View>

            {/* STATUS BADGE */}
            <View style={styles.statusBadgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusInfo.badgeBg,
                    borderColor: statusInfo.badgeBorder,
                  },
                ]}
              >
                <Ionicons
                  name={statusInfo.icon as any}
                  size={12}
                  color={statusInfo.textColor}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: statusInfo.textColor },
                  ]}
                >
                  {statusInfo.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* MESSAGE SNIPPET */}
        {item.message ? (
          <View
            style={[
              styles.messageSnippetBox,
              {
                backgroundColor: isDark ? "#0E0F14" : "#F8F6F0",
                borderColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <Text
              style={[
                styles.messageSnippetText,
                { color: colors.textSecondary },
              ]}
              numberOfLines={2}
            >
              &ldquo;{item.message}&rdquo;
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (enquiries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconCircle,
            {
              backgroundColor: isDark ? "#171821" : "#F4EFE6",
              borderColor: isDark
                ? "rgba(212, 175, 55, 0.25)"
                : colors.goldSoft,
            },
          ]}
        >
          <Ionicons name="cube-outline" size={44} color={colors.gold} />
        </View>
        <Text
          style={[
            styles.emptyTitle,
            { color: isDark ? "#FFFFFF" : colors.text },
          ]}
        >
          No Acquisition Inquiries Yet
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            { color: colors.textSecondary },
          ]}
        >
          When you submit an acquisition enquiry on any masterpiece, your private
          curatorial dossiers and advisory updates will appear here.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.emptyExploreButton,
            { backgroundColor: colors.gold },
            pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
          ]}
          onPress={onExplore}
        >
          <Text style={styles.emptyExploreButtonText}>
            EXPLORE MASTERWORKS
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={enquiries}
      keyExtractor={(item) => item.enquiryId || String(item.artworkId)}
      renderItem={renderEnquiryCard}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        ) : undefined
      }
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  thumbnailContainer: {
    width: 74,
    height: 86,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 14,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardArtworkTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.serifBold,
    lineHeight: 21,
    marginRight: 6,
  },
  cardChevron: {
    marginTop: 2,
  },
  cardArtistName: {
    fontSize: 13,
    fontFamily: FONTS.sansMedium,
    marginTop: 3,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  cardItemNumber: {
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  cardMetaDot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  cardDateText: {
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
  },
  statusBadgeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.3,
  },
  messageSnippetBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  messageSnippetText: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    lineHeight: 17,
    fontStyle: "italic",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 13.5,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 26,
  },
  emptyExploreButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
  },
  emptyExploreButtonText: {
    color: "#0D0D0F",
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
  },
});
