import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  placeAuctionBid,
  saveLocalBid,
  type AuctionBid,
  type AuctionLot,
} from "@/services/auctions";

type AuctionBidModalProps = {
  visible: boolean;
  onClose: () => void;
  lot: AuctionLot | null;
  onBidSuccess?: (updatedLot: AuctionLot) => void;
};

export function AuctionBidModal({
  visible,
  onClose,
  lot,
  onBidSuccess,
}: AuctionBidModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [bidAmountStr, setBidAmountStr] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [collectorEmail, setCollectorEmail] = useState("");
  const [collectorPhone, setCollectorPhone] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBid, setConfirmedBid] = useState<AuctionBid | null>(null);

  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number }>({
    d: 0,
    h: 0,
    m: 0,
    s: 0,
  });

  // Calculate next minimum bid
  const nextMinBid = useMemo(() => {
    if (!lot) return 0;
    return lot.nextMinimumBid || (lot.currentBid > 0 ? lot.currentBid + lot.bidIncrement : lot.startingBid);
  }, [lot]);

  // Sync user profile & default bid on open
  useEffect(() => {
    if (visible && lot) {
      setConfirmedBid(null);
      setErrorMessage(null);
      setBidAmountStr(String(nextMinBid));

      if (user) {
        const name = user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : user.username || "";
        setCollectorName(name);
        setCollectorEmail(user.email || "");
        setCollectorPhone(user.billing?.phone || "");
      } else {
        setCollectorName("");
        setCollectorEmail("");
        setCollectorPhone("");
      }
    }
  }, [visible, lot, nextMinBid, user]);

  // Live countdown timer ticker
  useEffect(() => {
    if (!visible || !lot?.endTime) return;

    const tick = () => {
      const endMs = new Date(lot.endTime).getTime();
      const nowMs = Date.now();
      const diff = Math.max(0, endMs - nowMs);

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ d, h, m, s });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [visible, lot?.endTime]);

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleQuickAdd = (increment: number) => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    const currentVal = parseFloat(bidAmountStr) || nextMinBid;
    const newVal = Math.max(nextMinBid, currentVal + increment);
    setBidAmountStr(String(newVal));
  };

  const handlePlaceBid = async () => {
    if (!lot) return;

    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please sign in or create a collector account to place verified auction bids.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => {
              onClose();
              router.push("/auth" as any);
            },
          },
        ]
      );
      return;
    }

    const parsedAmount = parseFloat(bidAmountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid bid amount.");
      return;
    }

    if (parsedAmount < nextMinBid) {
      setErrorMessage(
        `Bid must be at least ₹ ${nextMinBid.toLocaleString("en-IN")} (Next Minimum Bid).`
      );
      return;
    }

    const cleanName = collectorName.trim();
    if (cleanName.length < 2) {
      setErrorMessage("Collector name is required (minimum 2 characters).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = collectorEmail.trim();
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("A valid email address is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const response = await placeAuctionBid({
        lotId: lot.id,
        bidAmount: parsedAmount,
        collectorName: cleanName,
        collectorEmail: cleanEmail,
        collectorPhone: collectorPhone.trim() || undefined,
      });

      if (response.success && response.bid) {
        setConfirmedBid(response.bid);
        await saveLocalBid(user?.id, response.bid);

        if (onBidSuccess) {
          onBidSuccess({
            ...lot,
            currentBid: parsedAmount,
            nextMinimumBid: response.nextMinimumBid,
            bidCount: (lot.bidCount || 0) + 1,
          });
        }

        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to place bid. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsAppConcierge = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const msg = lot
      ? `Hello Primo Art Gallery, I would like VIP advisory on "${lot.title}" (LOT #${lot.id}).`
      : "Hello Primo Art Gallery, I would like VIP auction bidding advisory.";
    const url = `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {});
  };

  if (!lot) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <StatusBar barStyle={colors.statusBar} />

        {/* TOP BAR */}
        <View
          style={[
            styles.topBar,
            { backgroundColor: colors.headerBackground, borderBottomColor: colors.borderLight },
          ]}
        >
          <View style={styles.topBarTitleContainer}>
            <Text style={[styles.topBarEyebrow, { color: colors.gold }]}>
              {confirmedBid ? "OFFICIAL BID CONFIRMED" : "PRIMO LIVE AUCTIONS"}
            </Text>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>
              {confirmedBid ? "Bid Receipt" : "Place VIP Bid"}
            </Text>
          </View>

          <Pressable
            style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleClose}
            accessibilityLabel="Close modal"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {confirmedBid ? (
              /* =================================================== */
              /* CONFIRMED BID RECEIPT VIEW                          */
              /* =================================================== */
              <View>
                <View
                  style={[
                    styles.receiptPlaque,
                    { backgroundColor: colors.card, borderColor: colors.gold },
                  ]}
                >
                  <View style={styles.successIconBadge}>
                    <Ionicons name="checkmark-circle" size={48} color={colors.gold} />
                  </View>

                  <Text style={[styles.receiptHeader, { color: colors.gold }]}>
                    VIP BID PLACED SUCCESSFULLY
                  </Text>
                  <Text style={[styles.receiptAmount, { color: colors.text }]}>
                    ₹ {Number(confirmedBid.bidAmount).toLocaleString("en-IN")}
                  </Text>

                  <View
                    style={[
                      styles.receiptRefBox,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
                    ]}
                  >
                    <Text style={[styles.receiptRefLabel, { color: colors.textSecondary }]}>
                      BID REFERENCE NUMBER
                    </Text>
                    <Text style={[styles.receiptRefCode, { color: colors.gold }]}>
                      {confirmedBid.bidReference}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.receiptDetailsTable,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
                    ]}
                  >
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Artwork Lot</Text>
                      <Text style={[styles.tableValue, { color: isDark ? colors.gold : colors.text }]}>{confirmedBid.lotTitle}</Text>
                    </View>
                    <View style={[styles.tableDivider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Artist</Text>
                      <Text style={[styles.tableValue, { color: colors.text }]}>{confirmedBid.artist}</Text>
                    </View>
                    <View style={[styles.tableDivider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Bidder Name</Text>
                      <Text style={[styles.tableValue, { color: colors.gold }]}>{confirmedBid.collectorName}</Text>
                    </View>
                    <View style={[styles.tableDivider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Status</Text>
                      <Text style={[styles.tableValue, { color: "#27AE60" }]}>Active &bull; Validated</Text>
                    </View>
                  </View>

                  <Text style={[styles.receiptNoticeText, { color: colors.textSecondary }]}>
                    A formal bid confirmation has been dispatched to {confirmedBid.collectorEmail}. Your bid is securely recorded on the Primo Art Gallery live auction ledger.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.doneButton,
                    { backgroundColor: colors.gold },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleClose}
                >
                  <Text style={styles.doneButtonText}>DONE</Text>
                </Pressable>
              </View>
            ) : (
              /* =================================================== */
              /* BID PLACEMENT FORM VIEW                             */
              /* =================================================== */
              <View>
                {/* LOT SUMMARY CARD */}
                <View style={[styles.lotSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.lotSummaryRow}>
                    {lot.imageUrl ? (
                      <ExpoImage
                        source={{ uri: lot.imageUrl }}
                        style={styles.lotSummaryImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.lotSummaryImage, { backgroundColor: colors.goldSoft }]}>
                        <Ionicons name="image-outline" size={24} color={colors.gold} />
                      </View>
                    )}

                    <View style={styles.lotSummaryInfo}>
                      <Text style={[styles.lotBadgeText, { color: colors.gold }]}>{lot.lotNumber}</Text>
                      <Text style={[styles.lotTitleText, { color: isDark ? colors.gold : colors.text }]} numberOfLines={2}>
                        {lot.title}
                      </Text>
                      <Text style={[styles.lotArtistText, { color: colors.textSecondary }]}>
                        {lot.artist}
                      </Text>
                    </View>
                  </View>

                  {/* COUNTDOWN TIMER ROW */}
                  <View style={[styles.countdownBox, { backgroundColor: isDark ? "#1C1B18" : "#F8F5EE", borderColor: colors.borderLight }]}>
                    <View style={styles.countdownHeader}>
                      <View style={styles.livePulseDot} />
                      <Text style={[styles.countdownLabel, { color: colors.gold }]}>
                        {lot.status === "live" ? "LIVE BIDDING CLOSES IN" : "AUCTION STATUS"}
                      </Text>
                    </View>
                    <View style={styles.countdownUnitsRow}>
                      <View style={styles.timerUnit}>
                        <Text style={[styles.timerValue, { color: colors.text }]}>{timeLeft.d}</Text>
                        <Text style={[styles.timerLabel, { color: colors.textMuted }]}>DAYS</Text>
                      </View>
                      <Text style={[styles.timerColon, { color: colors.textMuted }]}>:</Text>
                      <View style={styles.timerUnit}>
                        <Text style={[styles.timerValue, { color: colors.text }]}>{String(timeLeft.h).padStart(2, "0")}</Text>
                        <Text style={[styles.timerLabel, { color: colors.textMuted }]}>HRS</Text>
                      </View>
                      <Text style={[styles.timerColon, { color: colors.textMuted }]}>:</Text>
                      <View style={styles.timerUnit}>
                        <Text style={[styles.timerValue, { color: colors.text }]}>{String(timeLeft.m).padStart(2, "0")}</Text>
                        <Text style={[styles.timerLabel, { color: colors.textMuted }]}>MIN</Text>
                      </View>
                      <Text style={[styles.timerColon, { color: colors.textMuted }]}>:</Text>
                      <View style={styles.timerUnit}>
                        <Text style={[styles.timerValue, { color: colors.text }]}>{String(timeLeft.s).padStart(2, "0")}</Text>
                        <Text style={[styles.timerLabel, { color: colors.textMuted }]}>SEC</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* PRICING BENCHMARK TABLE */}
                <View style={[styles.pricingTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.pricingRow}>
                    <Text style={[styles.pricingLabel, { color: colors.textSecondary }]}>Current Highest Bid</Text>
                    <Text style={[styles.pricingValue, { color: colors.text }]}>
                      ₹ {Number(lot.currentBid).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={[styles.tableDivider, { backgroundColor: colors.borderLight }]} />
                  <View style={styles.pricingRow}>
                    <Text style={[styles.pricingLabel, { color: colors.textSecondary }]}>Minimum Bid Increment</Text>
                    <Text style={[styles.pricingValue, { color: colors.textSecondary }]}>
                      + ₹ {Number(lot.bidIncrement).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={[styles.tableDivider, { backgroundColor: colors.borderLight }]} />
                  <View style={styles.pricingRow}>
                    <Text style={[styles.pricingLabelBold, { color: colors.gold }]}>Next Minimum Bid</Text>
                    <Text style={[styles.pricingValueBold, { color: colors.gold }]}>
                      ₹ {Number(nextMinBid).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>

                {/* ERROR BANNER */}
                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#D9534F" />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* BID INPUT SECTION */}
                <View style={styles.bidInputSection}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Select or Enter Your Bid Amount (₹ INR)
                  </Text>

                  {/* QUICK INCREMENT PILLS */}
                  <View style={styles.quickPillsRow}>
                    {[5000, 10000, 25000, 50000].map((inc) => (
                      <Pressable
                        key={inc}
                        style={[
                          styles.quickPill,
                          { backgroundColor: colors.card, borderColor: colors.border },
                        ]}
                        onPress={() => handleQuickAdd(inc)}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.quickPillText, { color: colors.gold }]}>
                          + ₹ {(inc / 1000).toFixed(0)}k
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* NUMERIC BID INPUT */}
                  <View style={[styles.bidInputWrapper, { backgroundColor: colors.card, borderColor: colors.gold }]}>
                    <Text style={[styles.rupeeSymbol, { color: colors.gold }]}>₹</Text>
                    <TextInput
                      style={[styles.bidInput, { color: colors.text }]}
                      keyboardType="numeric"
                      value={bidAmountStr}
                      onChangeText={setBidAmountStr}
                      placeholder={String(nextMinBid)}
                      placeholderTextColor={colors.textMuted}
                      editable={!isSubmitting}
                    />
                  </View>
                </View>

                {/* COLLECTOR CONFIRMATION DETAILS */}
                <View style={styles.collectorDetailsSection}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Collector Bidding Details
                  </Text>

                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                      value={collectorName}
                      onChangeText={setCollectorName}
                      placeholder="Your full name"
                      placeholderTextColor={colors.textMuted}
                      editable={!isSubmitting}
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email Address</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                      value={collectorEmail}
                      onChangeText={setCollectorEmail}
                      placeholder="your.email@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.textMuted}
                      editable={!isSubmitting}
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WhatsApp / Phone (Optional)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                      value={collectorPhone}
                      onChangeText={setCollectorPhone}
                      placeholder="+91 98765 43210"
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.textMuted}
                      editable={!isSubmitting}
                    />
                  </View>
                </View>

                {/* TERMS NOTICE */}
                <Text style={[styles.termsNoticeText, { color: colors.textSecondary }]}>
                  By submitting this bid, you agree to the binding auction terms of Primo Art Gallery. Bids are verified and recorded on our server-side ledger.
                </Text>

                {/* PLACE BID BUTTON */}
                <Pressable
                  style={({ pressed }) => [
                    styles.placeBidButton,
                    { backgroundColor: colors.gold },
                    isSubmitting && { opacity: 0.7 },
                    pressed && !isSubmitting && { transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handlePlaceBid}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#17202A" />
                  ) : (
                    <>
                      <Ionicons name="hammer" size={20} color="#17202A" />
                      <Text style={styles.placeBidButtonText}>
                        CONFIRM &amp; PLACE BID
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* WHATSAPP VIP ADVISORY */}
                <Pressable
                  style={[styles.conciergeLink, { borderColor: colors.border }]}
                  onPress={openWhatsAppConcierge}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={[styles.conciergeLinkText, { color: colors.textSecondary }]}>
                    Prefer Telephone / WhatsApp Bidding? Chat with Senior Curator
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  topBarTitleContainer: {
    flex: 1,
  },
  topBarEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: FONTS.serifBold,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  lotSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  lotSummaryRow: {
    flexDirection: "row",
    gap: 14,
  },
  lotSummaryImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  lotSummaryInfo: {
    flex: 1,
    justifyContent: "center",
  },
  lotBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  lotTitleText: {
    fontSize: 15,
    fontFamily: FONTS.serifBold,
    lineHeight: 20,
  },
  lotArtistText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    marginTop: 2,
  },
  countdownBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  countdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#E74C3C",
  },
  countdownLabel: {
    fontSize: 9.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  countdownUnitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  timerUnit: {
    alignItems: "center",
    minWidth: 36,
  },
  timerValue: {
    fontSize: 16,
    fontFamily: FONTS.sansBold,
  },
  timerLabel: {
    fontSize: 8,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  timerColon: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    marginBottom: 8,
  },
  pricingTable: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
  },
  pricingValue: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  pricingLabelBold: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  pricingValueBold: {
    fontSize: 16,
    fontFamily: FONTS.sansExtraBold,
  },
  tableDivider: {
    height: 1,
    marginVertical: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FCE4E4",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    color: "#D9534F",
    fontSize: 13,
    fontFamily: FONTS.sansMedium,
    flex: 1,
  },
  bidInputSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    marginBottom: 10,
  },
  quickPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickPill: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickPillText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  bidInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    height: 56,
  },
  rupeeSymbol: {
    fontSize: 22,
    fontFamily: FONTS.sansBold,
    marginRight: 8,
  },
  bidInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: FONTS.sansBold,
  },
  collectorDetailsSection: {
    gap: 12,
    marginBottom: 16,
  },
  fieldWrap: {},
  fieldLabel: {
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  termsNoticeText: {
    fontSize: 10.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 15,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  placeBidButton: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  placeBidButtonText: {
    color: "#17202A",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  conciergeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  conciergeLinkText: {
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
  },
  receiptPlaque: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  successIconBadge: {
    marginBottom: 12,
  },
  receiptHeader: {
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  receiptAmount: {
    fontSize: 32,
    fontFamily: FONTS.sansExtraBold,
    marginBottom: 16,
  },
  receiptRefBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  receiptRefLabel: {
    fontSize: 9,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  receiptRefCode: {
    fontSize: 18,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1.5,
  },
  receiptDetailsTable: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    width: "100%",
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  tableLabel: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
  },
  tableValue: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  receiptNoticeText: {
    fontSize: 10.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 15,
    textAlign: "center",
  },
  doneButton: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#17202A",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
});
