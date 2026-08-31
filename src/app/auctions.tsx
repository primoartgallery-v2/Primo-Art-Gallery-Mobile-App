import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getLiveAuctions, type AuctionLot } from "@/services/auctions";

export default function AuctionsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLots = useCallback(async () => {
    try {
      const data = await getLiveAuctions();
      setLots(data);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLots();
  }, [loadLots]);

  // Display ONLY currently live/running auctions
  const liveLots = useMemo(() => {
    return lots.filter((l) => l.status === "live");
  }, [lots]);

  const handleOpenWebsiteAuction = (lot?: AuctionLot) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const targetUrl =
      lot?.permalink && typeof lot.permalink === "string" && lot.permalink.startsWith("http")
        ? lot.permalink
        : (GALLERY_CONFIG.liveAuctionUrl || "https://primoartgallery.com/live-auction/");
    Linking.openURL(targetUrl).catch(() => {});
  };

  const openWhatsAppConcierge = (lotName?: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const msg = lotName
      ? `Hello Primo Art Gallery, I am interested in placing a private VIP bid on "${lotName}".`
      : "Hello Primo Art Gallery, I would like VIP auction bidding advisory.";
    const url = `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.headerBackground, borderBottomColor: colors.borderLight },
        ]}
      >
        <View>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
          <Text style={[styles.title, { color: colors.text }]}>Live Auctions</Text>
        </View>
        <Pressable
          style={[
            styles.bellButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/notifications" as any)}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* LIVE AUCTION HERO BANNER */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#171822" : "#1A1A1A",
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={[styles.liveIndicatorText, { color: colors.gold }]}>
              CURATED MASTERWORKS AUCTION
            </Text>
          </View>

          <Text style={styles.heroTitle}>Exclusive Curated Art Bidding</Text>
          <Text style={styles.heroSubtitle}>
            Live auctions take place on the official Primo Art Gallery website. Tap any lot to participate in real-time competitive bidding.
          </Text>

          {/* MAIN CTA BUTTON */}
          <Pressable
            style={({ pressed }) => [
              styles.enterAuctionButton,
              { backgroundColor: colors.gold },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              if (liveLots.length > 0) {
                handleOpenWebsiteAuction(liveLots[0]);
              } else {
                handleOpenWebsiteAuction();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Bid on official website"
          >
            <Ionicons name="open-outline" size={18} color="#17202A" />
            <Text style={styles.enterAuctionButtonText}>
              BID ON WEBSITE
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#17202A" />
          </Pressable>

          <Text style={styles.heroFootnote}>
            Authoritative website bidding &bull; Verified digital certificates of authenticity
          </Text>
        </View>

        {/* VIP CONCIERGE BANNER */}
        <View
          style={[
            styles.conciergeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.conciergeLeft}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.conciergeTitle, { color: colors.text }]}>VIP Bidding Advisory</Text>
              <Text style={[styles.conciergeSubtitle, { color: colors.textSecondary }]}>
                Prefer telephone or private advisory bidding? Contact our senior curator.
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.conciergeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => openWhatsAppConcierge()}
          >
            <Text style={styles.conciergeButtonText}>CHAT NOW</Text>
          </Pressable>
        </View>

        {/* SECTION HEADER */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.gold }]}>CATALOGUE</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Live Bidding Lots ({liveLots.length})
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading curated auction lots…</Text>
          </View>
        ) : liveLots.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="hammer-outline" size={36} color={colors.gold} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Live Auctions Right Now</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Check back soon for new curated masterwork auctions on Primo Art Gallery.
            </Text>
          </View>
        ) : (
          <View style={styles.lotsGrid}>
            {liveLots.map((lot) => {
              const priceDisplay = `₹ ${Number(lot.currentBid).toLocaleString("en-IN")}`;

              return (
                <View
                  key={lot.id}
                  style={[
                    styles.lotCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.lotImageFrame,
                      { backgroundColor: isDark ? "#20222C" : "#EBE6DD" },
                    ]}
                    onPress={() => handleOpenWebsiteAuction(lot)}
                  >
                    {lot.imageUrl ? (
                      <ExpoImage
                        source={{ uri: lot.imageUrl }}
                        style={styles.lotImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.lotImagePlaceholder}>
                        <Ionicons name="image-outline" size={28} color={colors.gold} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.lotBadge,
                        { backgroundColor: "rgba(28, 27, 24, 0.88)", borderColor: colors.gold },
                      ]}
                    >
                      <Text style={[styles.lotBadgeText, { color: colors.gold }]}>{lot.lotNumber}</Text>
                    </View>

                    <View style={styles.liveDotBadge}>
                      <View style={styles.livePulseDotSmall} />
                      <Text style={styles.liveDotText}>LIVE</Text>
                    </View>
                  </Pressable>

                  <View style={styles.lotBody}>
                    <Text style={[styles.lotArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                      {lot.artist}
                    </Text>
                    <Text style={[styles.lotTitle, { color: isDark ? colors.gold : colors.text }]} numberOfLines={1}>
                      {lot.title}
                    </Text>

                    <View
                      style={[
                        styles.estimateRow,
                        { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
                      ]}
                    >
                      <Text style={[styles.estimateLabel, { color: colors.textSecondary }]}>
                        {lot.bidCount > 0 ? "CURRENT BID" : "STARTING BID"}
                      </Text>
                      <Text style={[styles.estimateValue, { color: colors.gold }]}>{priceDisplay}</Text>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.lotBidButton,
                        { backgroundColor: colors.gold },
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleOpenWebsiteAuction(lot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Bid on ${lot.title} on website`}
                    >
                      <Ionicons name="open-outline" size={15} color="#17202A" />
                      <Text style={styles.lotBidButtonText}>BID ON WEBSITE</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* AUCTION TRUST GUARANTEES */}
        <View
          style={[
            styles.guaranteesContainer,
            { backgroundColor: colors.cardAlt, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.guaranteesHeader, { color: colors.gold }]}>PRIMO AUCTION GUARANTEE</Text>

          <View style={styles.guaranteeRow}>
            <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
            <View style={styles.guaranteeCopy}>
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>Verified Provenance &amp; CoA</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Every work is authenticated and includes a digital certificate of authenticity.
              </Text>
            </View>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="airplane" size={20} color={colors.gold} />
            <View style={styles.guaranteeCopy}>
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>White-Glove Insured Delivery</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Secure, museum-grade packaging and insured doorstep delivery.
              </Text>
            </View>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="lock-closed" size={20} color={colors.gold} />
            <View style={styles.guaranteeCopy}>
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>Official Website Bidding</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Safe and authoritative competitive bidding on the official Primo Art Gallery website.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <AppBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.7,
  },
  title: {
    marginTop: 3,
    fontFamily: FONTS.serifBold,
    fontSize: 29,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(212, 175, 55, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.35)",
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E74C3C",
  },
  liveIndicatorText: {
    fontSize: 9.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#D3CABE",
    fontSize: 12.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
  },
  enterAuctionButton: {
    marginTop: 18,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  enterAuctionButtonText: {
    color: "#17202A",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
  heroFootnote: {
    marginTop: 10,
    color: "#999083",
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  conciergeCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  conciergeLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  conciergeTitle: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  conciergeSubtitle: {
    marginTop: 2,
    fontSize: 10.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 14,
  },
  conciergeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  conciergeButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: 11.5,
    fontFamily: FONTS.sansBold,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  sectionTitle: {
    marginTop: 2,
    fontFamily: FONTS.serifBold,
    fontSize: 22,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
  },
  emptyContainer: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.serifBold,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    marginTop: 4,
    textAlign: "center",
  },
  lotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 26,
  },
  lotCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  lotImageFrame: {
    width: "100%",
    height: 160,
    position: "relative",
  },
  lotImage: {
    width: "100%",
    height: "100%",
  },
  lotImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lotBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  lotBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  liveDotBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  livePulseDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E74C3C",
  },
  liveDotText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.5,
  },
  lotBody: {
    padding: 12,
  },
  lotArtist: {
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
  },
  lotTitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  estimateRow: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  estimateLabel: {
    fontSize: 7.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  estimateValue: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  lotBidButton: {
    marginTop: 10,
    height: 36,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  lotBidButtonText: {
    color: "#17202A",
    fontSize: 9.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  guaranteesContainer: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  guaranteesHeader: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  guaranteeCopy: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  guaranteeText: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
