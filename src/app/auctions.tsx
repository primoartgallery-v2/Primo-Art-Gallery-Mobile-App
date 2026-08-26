import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
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
import { getProducts, type WooCommerceProduct } from "@/services/woocommerce";

const LIVE_AUCTION_URL = "https://primoartgallery.com/live-auction/";

export default function AuctionsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [featuredLots, setFeaturedLots] = useState<WooCommerceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getProducts({ page: 1, perPage: 8 });
      setFeaturedLots(res.products.slice(0, 6));
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const openLiveAuction = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    Linking.openURL(LIVE_AUCTION_URL).catch(() => {});
  };

  const openWhatsAppConcierge = (lotName?: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const msg = lotName
      ? `Hello Primo Art Gallery, I am interested in placing a private bid on "${lotName}" in the live auction.`
      : "Hello Primo Art Gallery, I would like assistance and private bidding registration for the Live Auction.";
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
            <Text style={[styles.liveIndicatorText, { color: colors.gold }]}>LIVE AUCTION ACTIVE</Text>
          </View>

          <Text style={styles.heroTitle}>Exclusive Curated Art Bidding</Text>
          <Text style={styles.heroSubtitle}>
            Participate in real-time competitive bidding on verified, original
            contemporary masterworks with certificates of authenticity.
          </Text>

          {/* MAIN CTA BUTTON TO DIRECTLY BID ON WEBSITE */}
          <Pressable
            style={({ pressed }) => [
              styles.enterAuctionButton,
              { backgroundColor: colors.gold },
              pressed && styles.buttonPressed,
            ]}
            onPress={openLiveAuction}
            accessibilityRole="button"
            accessibilityLabel="Enter live auction"
          >
            <Ionicons name="hammer" size={18} color="#17202A" />
            <Text style={styles.enterAuctionButtonText}>
              ENTER LIVE AUCTION &amp; BID
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#17202A" />
          </Pressable>

          <Text style={styles.heroFootnote}>
            Direct link to official Primo Live Auction Portal
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

        {/* FEATURED AUCTION LOTS */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.gold }]}>CURATED LOTS</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Auction Works</Text>
          </View>
          <Pressable onPress={openLiveAuction}>
            <Text style={[styles.viewAllText, { color: colors.gold }]}>View All Lots →</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading curated lots…</Text>
          </View>
        ) : (
          <View style={styles.lotsGrid}>
            {featuredLots.map((lot, index) => {
              const artistMeta = lot.attributes.find((a) =>
                /artist/i.test(a.name)
              )?.options[0];
              const priceDisplay = lot.price ? `₹ ${lot.price}` : "Reserve on request";

              return (
                <View
                  key={lot.id}
                  style={[
                    styles.lotCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.lotImageFrame,
                      { backgroundColor: isDark ? "#20222C" : "#EBE6DD" },
                    ]}
                  >
                    {lot.images[0]?.src ? (
                      <ExpoImage
                        source={{ uri: lot.images[0].src }}
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
                        { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                      ]}
                    >
                      <Text style={[styles.lotBadgeText, { color: colors.gold }]}>LOT #{lot.id}</Text>
                    </View>
                  </View>

                  <View style={styles.lotBody}>
                    <Text style={[styles.lotArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                      {artistMeta || lot.categories[0]?.name || "Master Artist"}
                    </Text>
                    <Text style={[styles.lotTitle, { color: colors.text }]} numberOfLines={1}>
                      {lot.name}
                    </Text>

                    <View
                      style={[
                        styles.estimateRow,
                        { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
                      ]}
                    >
                      <Text style={[styles.estimateLabel, { color: colors.textSecondary }]}>ESTIMATE / RESERVE</Text>
                      <Text style={[styles.estimateValue, { color: colors.gold }]}>{priceDisplay}</Text>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.lotBidButton,
                        { backgroundColor: colors.gold },
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => openLiveAuction()}
                    >
                      <Ionicons name="hammer-outline" size={14} color="#FFFFFF" />
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
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>Verified Provenance</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Every work is authenticated and includes a physical gallery certificate.
              </Text>
            </View>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="airplane" size={20} color={colors.gold} />
            <View style={styles.guaranteeCopy}>
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>White-Glove Insured Delivery</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Secure, museum-grade insured packaging and doorstep shipping worldwide.
              </Text>
            </View>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="lock-closed" size={20} color={colors.gold} />
            <View style={styles.guaranteeCopy}>
              <Text style={[styles.guaranteeTitle, { color: colors.text }]}>Transparent Bidding</Text>
              <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                Encrypted, verified real-time bid logging on our secure web platform.
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
    backgroundColor: "#FAF8F3",
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE0",
    backgroundColor: "#FAF8F3",
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.7,
  },
  title: {
    marginTop: 3,
    color: "#252525",
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
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: "#1C1B18",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#3A362D",
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
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.35)",
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E74C3C",
  },
  liveIndicatorText: {
    color: "#FF6B6B",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#D3CABE",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 19,
  },
  enterAuctionButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E5C158",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#E5C158",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    marginBottom: 24,
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
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  conciergeSubtitle: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 10,
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  sectionTitle: {
    marginTop: 2,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 22,
  },
  viewAllText: {
    color: "#B8964E",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    overflow: "hidden",
    marginBottom: 12,
  },
  lotImageFrame: {
    width: "100%",
    height: 160,
    backgroundColor: "#FAF6EC",
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
    backgroundColor: "rgba(28, 27, 24, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lotBadgeText: {
    color: "#E5C158",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  lotBody: {
    padding: 12,
  },
  lotArtist: {
    color: "#77736B",
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
  },
  lotTitle: {
    marginTop: 2,
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  estimateRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4EFE6",
  },
  estimateLabel: {
    color: "#8A847B",
    fontSize: 8,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  estimateValue: {
    marginTop: 2,
    color: "#B8964E",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  lotBidButton: {
    marginTop: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#252525",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  lotBidButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  guaranteesContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    gap: 16,
  },
  guaranteesHeader: {
    color: "#B8964E",
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
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  guaranteeText: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
