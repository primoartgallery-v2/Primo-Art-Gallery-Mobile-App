import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type Exhibition } from "@/services/exhibitions";
import {
  saveLocalExhibitionPass,
  submitExhibitionRsvp,
  type ExhibitionVipPass,
} from "@/services/exhibitionService";

type ExhibitionRsvpModalProps = {
  visible: boolean;
  onClose: () => void;
  exhibition: Exhibition | null;
  initialPass?: ExhibitionVipPass | null;
};

export function ExhibitionRsvpModal({
  visible,
  onClose,
  exhibition,
  initialPass,
}: ExhibitionRsvpModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();

  const [collectorName, setCollectorName] = useState("");
  const [collectorEmail, setCollectorEmail] = useState("");
  const [collectorPhone, setCollectorPhone] = useState("");
  const [guestCount, setGuestCount] = useState<number>(1);
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issuedPass, setIssuedPass] = useState<ExhibitionVipPass | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialPass) {
        setIssuedPass(initialPass);
      } else {
        setIssuedPass(null);
        setErrorMessage(null);

        // Pre-fill collector details if logged in
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
        setGuestCount(1);
        setMessage("");
      }
    }
  }, [visible, initialPass, user]);

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleGuestCountSelect = (count: number) => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setGuestCount(count);
  };

  const handleSubmitRsvp = async () => {
    if (!exhibition) return;

    // Validation
    const cleanName = collectorName.trim();
    if (cleanName.length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = collectorEmail.trim();
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const response = await submitExhibitionRsvp({
        exhibitionId: exhibition.id,
        exhibitionTitle: exhibition.title,
        exhibitionDates: exhibition.dates,
        exhibitionTimings: exhibition.timings,
        exhibitionVenue: `${exhibition.venue}, ${exhibition.city}`,
        collectorName: cleanName,
        collectorEmail: cleanEmail,
        collectorPhone: collectorPhone.trim() || undefined,
        guestCount,
        message: message.trim() || undefined,
      });

      if (response.success && response.pass) {
        setIssuedPass(response.pass);
        // Cache pass locally for instant offline retrieval
        await saveLocalExhibitionPass(user?.id, response.pass);

        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to confirm RSVP. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSharePass = async () => {
    if (!issuedPass) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const shareText = `🎟️ Official VIP Exhibition Pass\n\nExhibition: ${issuedPass.exhibitionTitle}\nPass ID: ${issuedPass.passId}\nGuest: ${issuedPass.collectorName} (${issuedPass.guestCount} Guests)\nDates: ${issuedPass.exhibitionDates}\nVenue: ${issuedPass.exhibitionVenue}\n\nIssued by Primo Art Gallery, New Delhi`;

    try {
      await Share.share({
        title: `VIP Guest Pass: ${issuedPass.exhibitionTitle}`,
        message: shareText,
      });
    } catch {}
  };

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
              {issuedPass ? "OFFICIAL VIP GUEST PASS" : "CURATORIAL RSVP CONCIERGE"}
            </Text>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>
              {issuedPass ? "VIP Exhibition Pass" : "Exhibition RSVP"}
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
            {issuedPass ? (
              /* =================================================== */
              /* ISSUED VIP DIGITAL PASS VIEW                        */
              /* =================================================== */
              <View>
                <View
                  style={[
                    styles.passPlaque,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.gold,
                    },
                  ]}
                >
                  {/* ORNATE CORNERS */}
                  <View style={[styles.cornerTL, { borderColor: colors.gold }]} />
                  <View style={[styles.cornerTR, { borderColor: colors.gold }]} />
                  <View style={[styles.cornerBL, { borderColor: colors.gold }]} />
                  <View style={[styles.cornerBR, { borderColor: colors.gold }]} />

                  {/* EMBLEM & SEAL */}
                  <View style={styles.emblemRow}>
                    <View
                      style={[
                        styles.goldSealBadge,
                        { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                      ]}
                    >
                      <Ionicons name="ticket" size={26} color={colors.gold} />
                    </View>
                    <Text style={[styles.galleryHeaderName, { color: colors.gold }]}>
                      PRIMO ART GALLERY
                    </Text>
                    <Text style={[styles.gallerySubHeader, { color: colors.textSecondary }]}>
                      VIP GUEST ACCESS • COMPLIMENTARY ADMISSION
                    </Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.goldSoft }]} />

                  {/* PASS REFERENCE BOX */}
                  <View style={[styles.passRefBox, { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight }]}>
                    <Text style={[styles.passRefLabel, { color: colors.textSecondary }]}>
                      OFFICIAL PASS REFERENCE ID
                    </Text>
                    <Text style={[styles.passRefIdText, { color: colors.gold }]}>
                      {issuedPass.passId}
                    </Text>
                    <View
                      style={[
                        styles.confirmedBadge,
                        { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={13} color={colors.gold} />
                      <Text style={[styles.confirmedBadgeText, { color: colors.gold }]}>
                        CONFIRMED • {issuedPass.guestCount} {issuedPass.guestCount > 1 ? "GUESTS" : "GUEST"}
                      </Text>
                    </View>
                  </View>

                  {/* QR CHECK-IN STYLIZED MOTIF */}
                  <View style={[styles.qrContainer, { backgroundColor: isDark ? "#20222C" : "#F8F5EE", borderColor: colors.border }]}>
                    <Ionicons name="qr-code" size={72} color={colors.text} />
                    <Text style={[styles.qrInstructionText, { color: colors.textSecondary }]}>
                      PRESENT AT RECEPTION DESK FOR VIP ENTRY
                    </Text>
                  </View>

                  {/* EVENT SPECIFICATIONS */}
                  <View style={[styles.specsTable, { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight }]}>
                    <View style={styles.specRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Exhibition</Text>
                      <Text style={[styles.specValueBold, { color: colors.text }]}>{issuedPass.exhibitionTitle}</Text>
                    </View>

                    <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                    <View style={styles.specRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Guest Name</Text>
                      <Text style={[styles.specValueBold, { color: colors.gold }]}>{issuedPass.collectorName}</Text>
                    </View>

                    <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                    <View style={styles.specRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Dates</Text>
                      <Text style={[styles.specValue, { color: colors.text }]}>{issuedPass.exhibitionDates}</Text>
                    </View>

                    <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                    <View style={styles.specRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Daily Timings</Text>
                      <Text style={[styles.specValue, { color: colors.text }]}>{issuedPass.exhibitionTimings}</Text>
                    </View>

                    <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                    <View style={styles.specRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Venue</Text>
                      <Text style={[styles.specValue, { color: colors.text }]}>{issuedPass.exhibitionVenue}</Text>
                    </View>
                  </View>

                  {/* NOTICE */}
                  <Text style={[styles.passNoticeText, { color: colors.textSecondary }]}>
                    A digital confirmation has been dispatched to {issuedPass.collectorEmail}. This pass is non-transferable and admits up to {issuedPass.guestCount} person(s).
                  </Text>
                </View>

                {/* PASS ACTIONS */}
                <View style={styles.passActionsContainer}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.sharePassBtn,
                      { backgroundColor: colors.gold },
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={handleSharePass}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.sharePassBtnText}>Share VIP Pass</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.doneBtn,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleClose}
                  >
                    <Text style={[styles.doneBtnText, { color: colors.text }]}>Done</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* =================================================== */
              /* RSVP REGISTRATION FORM VIEW                         */
              /* =================================================== */
              <View>
                {/* EXHIBITION SUMMARY CARD */}
                {exhibition ? (
                  <View style={[styles.exhibitionSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.summaryEyebrow, { color: colors.gold }]}>COMPLIMENTARY VIP ADMISSION</Text>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>{exhibition.title}</Text>
                    <View style={styles.summaryMetaRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.gold} />
                      <Text style={[styles.summaryMetaText, { color: colors.textSecondary }]}>{exhibition.dates}</Text>
                    </View>
                    <View style={styles.summaryMetaRow}>
                      <Ionicons name="location-outline" size={14} color={colors.gold} />
                      <Text style={[styles.summaryMetaText, { color: colors.textSecondary }]}>
                        {exhibition.venue}, {exhibition.city}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* ERROR BANNER */}
                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#D9534F" />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* FORM FIELDS */}
                <View style={styles.formContainer}>
                  {/* FULL NAME */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      Collector Full Name <Text style={{ color: "#D9534F" }}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="e.g. Vikramaditya Sharma"
                      placeholderTextColor={colors.textMuted}
                      value={collectorName}
                      onChangeText={setCollectorName}
                      autoCapitalize="words"
                      maxLength={80}
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* EMAIL */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      Email Address <Text style={{ color: "#D9534F" }}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="e.g. collector@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={collectorEmail}
                      onChangeText={setCollectorEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      maxLength={100}
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* TELEPHONE */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      WhatsApp / Contact Phone (Optional)
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="+91 98765 43210"
                      placeholderTextColor={colors.textMuted}
                      value={collectorPhone}
                      onChangeText={setCollectorPhone}
                      keyboardType="phone-pad"
                      maxLength={30}
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* GUEST COUNT SELECTOR */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      Number of Guests (1–4)
                    </Text>
                    <View style={styles.guestCountRow}>
                      {[1, 2, 3, 4].map((count) => (
                        <Pressable
                          key={count}
                          style={[
                            styles.guestCountPill,
                            {
                              backgroundColor:
                                guestCount === count ? colors.gold : colors.card,
                              borderColor:
                                guestCount === count ? colors.gold : colors.border,
                            },
                          ]}
                          onPress={() => handleGuestCountSelect(count)}
                          disabled={isSubmitting}
                        >
                          <Text
                            style={[
                              styles.guestCountPillText,
                              {
                                color:
                                  guestCount === count ? "#FFFFFF" : colors.text,
                              },
                            ]}
                          >
                            {count} {count === 1 ? "Guest" : "Guests"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* SPECIAL REQUEST / NOTES */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      Curatorial Notes / Special Requests (Optional)
                    </Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="Share any special curatorial interest or arrival preferences..."
                      placeholderTextColor={colors.textMuted}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      numberOfLines={3}
                      maxLength={1000}
                      editable={!isSubmitting}
                    />
                  </View>
                </View>

                {/* TERMS NOTICE */}
                <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                  By confirming your RSVP, your VIP pass will be instantly issued and emailed to your address. Admission is complimentary and subject to gallery capacity.
                </Text>

                {/* SUBMIT BUTTON */}
                <Pressable
                  style={({ pressed }) => [
                    styles.submitRsvpButton,
                    { backgroundColor: colors.gold },
                    isSubmitting && { opacity: 0.7 },
                    pressed && !isSubmitting && { transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handleSubmitRsvp}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="ticket-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.submitRsvpButtonText}>
                        CONFIRM VIP RSVP & ISSUE PASS
                      </Text>
                    </>
                  )}
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
  exhibitionSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  summaryEyebrow: {
    fontSize: 9.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: FONTS.serifBold,
    marginBottom: 8,
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  summaryMetaText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
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
  formContainer: {
    gap: 16,
  },
  fieldWrap: {},
  fieldLabel: {
    fontSize: 12,
    fontFamily: FONTS.sansSemiBold,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  textArea: {
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
    textAlignVertical: "top",
  },
  guestCountRow: {
    flexDirection: "row",
    gap: 8,
  },
  guestCountPill: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guestCountPillText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  termsText: {
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
    marginTop: 18,
    marginBottom: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  submitRsvpButton: {
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
  submitRsvpButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  passPlaque: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 22,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cornerTL: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  emblemRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  goldSealBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  galleryHeaderName: {
    fontSize: 16,
    fontFamily: FONTS.serifBold,
    letterSpacing: 2,
  },
  gallerySubHeader: {
    fontSize: 9.5,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  passRefBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  passRefLabel: {
    fontSize: 9,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  passRefIdText: {
    fontSize: 22,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmedBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.5,
  },
  qrContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrInstructionText: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
    marginTop: 10,
    textAlign: "center",
  },
  specsTable: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  specDivider: {
    height: 1,
    marginVertical: 2,
  },
  specLabel: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    flex: 1,
  },
  specValue: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    flex: 1.5,
    textAlign: "right",
  },
  specValueBold: {
    fontSize: 13,
    fontFamily: FONTS.serifBold,
    flex: 1.5,
    textAlign: "right",
  },
  passNoticeText: {
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
    lineHeight: 15,
    textAlign: "center",
  },
  passActionsContainer: {
    marginTop: 20,
    gap: 10,
  },
  sharePassBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  sharePassBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: FONTS.sansMedium,
  },
});
