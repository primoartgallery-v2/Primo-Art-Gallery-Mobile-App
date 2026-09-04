import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { submitArtworkEnquiry } from "@/services/enquiryService";
import type { WooCommerceProduct } from "@/services/woocommerce";
import {
  ARTIST_FIELD_KEYS,
  type ArtistProfile,
  getArtworkValue,
} from "@/utils/artworkHelpers";

export type PaintingEnquiryModalProps = {
  visible: boolean;
  product: WooCommerceProduct | null;
  artistProfile?: ArtistProfile | null;
  user?: {
    id?: string | number;
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
    billing?: { phone?: string };
  } | null;
  onClose: () => void;
};

export function PaintingEnquiryModal({
  visible,
  product,
  artistProfile,
  user,
  onClose,
}: PaintingEnquiryModalProps) {
  const { colors, isDark } = useAppTheme();

  // VIP Acquisition Enquiry Form State
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryPhone, setEnquiryPhone] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState(
    "I am interested in acquiring this artwork. Please share the pricing, provenance details, and delivery terms."
  );
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryRefId, setEnquiryRefId] = useState<string | null>(null);
  const enquiryScrollRef = useRef<ScrollView>(null);

  // Pre-fill collector information when modal opens
  useEffect(() => {
    if (visible && user) {
      setEnquiryName((prev) => {
        if (!prev) {
          const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "";
          return name || prev;
        }
        return prev;
      });
      setEnquiryEmail((prev) => (!prev && user.email ? user.email : prev));
      setEnquiryPhone((prev) => (!prev && user.billing?.phone ? user.billing.phone : prev));
    }
  }, [visible, user]);

  const resetEnquiryModal = () => {
    onClose();
    setEnquirySuccess(false);
    setEnquiryRefId(null);
    setEnquiryError(null);
  };

  const enquireWhatsApp = () => {
    if (!product) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const artistName =
      artistProfile?.name ||
      getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery");
    const link = product.images[0]?.src || GALLERY_CONFIG.website;
    const msg = `Hello Primo Art Gallery, I am interested in acquiring "${product.name}" by ${artistName} (Item ID: #${product.id}).\n\nLink: ${link}\n\nPlease share price, provenance, and delivery details.`;
    const url = `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {});
  };

  const callAdvisory = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(`tel:${GALLERY_CONFIG.phoneRaw}`).catch(() => {});
  };

  const handleEnquirySubmit = async () => {
    if (!product) return;
    setEnquiryError(null);

    const cleanName = enquiryName.trim();
    const cleanEmail = enquiryEmail.trim().toLowerCase();
    const cleanMsg = enquiryMessage.trim();
    const cleanPhone = enquiryPhone.trim();

    if (cleanName.length < 2) {
      setEnquiryError("Please enter your name (at least 2 characters).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEnquiryError("Please enter a valid email address.");
      return;
    }

    if (cleanMsg.length < 10) {
      setEnquiryError("Please enter a message (at least 10 characters).");
      return;
    }

    setIsSubmittingEnquiry(true);
    try {
      const res = await submitArtworkEnquiry(
        {
          artworkId: product.id,
          artworkTitle: product.name,
          collectorName: cleanName,
          collectorEmail: cleanEmail,
          collectorPhone: cleanPhone || undefined,
          message: cleanMsg,
        },
        user?.id ?? null
      );

      if (res.success) {
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setEnquirySuccess(true);
        setEnquiryRefId(res.enquiryId || null);
      } else {
        setEnquiryError(res.error || "Failed to submit enquiry. Please try again.");
      }
    } catch {
      setEnquiryError("Unable to connect to gallery service. Please try again.");
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={resetEnquiryModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetEnquiryModal} />
        <View
          style={[
            styles.enquirySheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {enquirySuccess ? (
            /* SUCCESS STATE */
            <View style={styles.enquirySuccessContainer}>
              <View
                style={[
                  styles.enquirySuccessBadge,
                  { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                ]}
              >
                <Ionicons name="checkmark-circle" size={48} color={colors.gold} />
              </View>

              <Text style={[styles.enquirySuccessEyebrow, { color: colors.gold }]}>
                ACQUISITION DESK NOTIFIED
              </Text>
              <Text style={[styles.enquirySuccessTitle, { color: colors.text }]}>
                Enquiry Received
              </Text>

              {enquiryRefId ? (
                <View
                  style={[
                    styles.enquiryRefBox,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.enquiryRefLabel, { color: colors.textSecondary }]}>
                    REFERENCE ID
                  </Text>
                  <Text style={[styles.enquiryRefValue, { color: colors.gold }]}>
                    {enquiryRefId}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.enquirySuccessDescription, { color: colors.textSecondary }]}>
                Our senior curatorial team has received your acquisition enquiry for &ldquo;{product.name}&rdquo;.
                A specialist will reach out to you at{" "}
                <Text style={{ color: colors.text, fontFamily: FONTS.sansBold }}>{enquiryEmail}</Text>{" "}
                within 24 hours with valuation, provenance, and delivery terms.
              </Text>

              {/* IMMEDIATE FOLLOW-UP ACTIONS */}
              <View style={styles.successActionsRow}>
                <Pressable
                  style={styles.whatsappFollowUpBtn}
                  onPress={enquireWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.whatsappFollowUpText}>Chat on WhatsApp</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.phoneFollowUpBtn,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                  ]}
                  onPress={callAdvisory}
                >
                  <Ionicons name="call-outline" size={18} color={colors.gold} />
                  <Text style={[styles.phoneFollowUpText, { color: colors.gold }]}>Call Advisory</Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.doneButton,
                  { backgroundColor: colors.gold },
                ]}
                onPress={resetEnquiryModal}
              >
                <Text style={styles.doneButtonText}>DONE</Text>
              </Pressable>
            </View>
          ) : (
            /* ENQUIRY FORM */
            <ScrollView
              ref={enquiryScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              contentContainerStyle={[styles.enquiryFormContent, { paddingBottom: 48 }]}
            >
              <View style={styles.enquiryHeader}>
                <View>
                  <Text style={[styles.sheetEyebrow, { color: colors.gold }]}>
                    PRIMO ART ADVISORY &bull; VIP ACQUISITIONS
                  </Text>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    Acquisition Enquiry
                  </Text>
                </View>
                <Pressable
                  style={[styles.closeModalCircle, { backgroundColor: colors.backgroundElement }]}
                  onPress={resetEnquiryModal}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* ARTWORK PREVIEW SUMMARY */}
              <View
                style={[
                  styles.artworkSummaryCard,
                  { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                ]}
              >
                {product.images[0]?.src ? (
                  <ExpoImage
                    source={{ uri: product.images[0].src }}
                    style={styles.artworkSummaryThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.artworkSummaryThumb, { backgroundColor: colors.border }]} />
                )}
                <View style={styles.artworkSummaryInfo}>
                  <Text style={[styles.artworkSummaryTitle, { color: isDark ? colors.gold : colors.text }]} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={[styles.artworkSummaryArtist, { color: colors.gold }]}>
                    {artistProfile?.name || getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery")}
                  </Text>
                  <Text style={[styles.artworkSummaryId, { color: colors.textMuted }]}>
                    Item #{product.id} &bull; {product.price ? `₹${Number(product.price).toLocaleString("en-IN")}` : "Price on Request"}
                  </Text>
                </View>
              </View>

              {/* ERROR BANNER */}
              {enquiryError ? (
                <View style={styles.enquiryErrorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#E74C3C" />
                  <Text style={styles.enquiryErrorText}>{enquiryError}</Text>
                </View>
              ) : null}

              {/* FORM FIELDS */}
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  YOUR FULL NAME <Text style={{ color: colors.gold }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="e.g. Maharani Gayatri / Ananya Sharma"
                  placeholderTextColor={colors.textMuted}
                  value={enquiryName}
                  onChangeText={setEnquiryName}
                  autoCapitalize="words"
                  editable={!isSubmittingEnquiry}
                  onFocus={() => {
                    setTimeout(() => {
                      enquiryScrollRef.current?.scrollTo({ y: 50, animated: true });
                    }, 120);
                  }}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  EMAIL ADDRESS <Text style={{ color: colors.gold }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="collector@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={enquiryEmail}
                  onChangeText={setEnquiryEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isSubmittingEnquiry}
                  onFocus={() => {
                    setTimeout(() => {
                      enquiryScrollRef.current?.scrollTo({ y: 120, animated: true });
                    }, 120);
                  }}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  PHONE / WHATSAPP <Text style={{ color: colors.textMuted }}>(Optional)</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="+91 98111 23456"
                  placeholderTextColor={colors.textMuted}
                  value={enquiryPhone}
                  onChangeText={setEnquiryPhone}
                  keyboardType="phone-pad"
                  editable={!isSubmittingEnquiry}
                  onFocus={() => {
                    setTimeout(() => {
                      enquiryScrollRef.current?.scrollTo({ y: 190, animated: true });
                    }, 120);
                  }}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  ACQUISITION MESSAGE <Text style={{ color: colors.gold }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textAreaInput,
                    { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Specify any questions, framing requirements, or private viewing preferences…"
                  placeholderTextColor={colors.textMuted}
                  value={enquiryMessage}
                  onChangeText={setEnquiryMessage}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!isSubmittingEnquiry}
                  onFocus={() => {
                    setTimeout(() => {
                      enquiryScrollRef.current?.scrollToEnd({ animated: true });
                    }, 150);
                  }}
                  onContentSizeChange={() => {
                    enquiryScrollRef.current?.scrollToEnd({ animated: false });
                  }}
                />
              </View>

              {/* SUBMIT BUTTON */}
              <Pressable
                style={[
                  styles.submitEnquiryBtn,
                  { backgroundColor: colors.gold },
                  isSubmittingEnquiry && { opacity: 0.7 },
                ]}
                onPress={handleEnquirySubmit}
                disabled={isSubmittingEnquiry}
              >
                {isSubmittingEnquiry ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.submitEnquiryBtnText}>
                      SUBMIT ACQUISITION ENQUIRY
                    </Text>
                  </>
                )}
              </Pressable>

              {/* ALTERNATE QUICK CHANNELS */}
              <View style={styles.quickChannelsContainer}>
                <Text style={[styles.quickChannelsTitle, { color: colors.textMuted }]}>
                  OR CONNECT DIRECTLY
                </Text>
                <View style={styles.quickChannelsRow}>
                  <Pressable
                    style={styles.quickWhatsappBtn}
                    onPress={enquireWhatsApp}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                    <Text style={styles.quickWhatsappText}>WhatsApp Desk</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.quickCallBtn,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    ]}
                    onPress={callAdvisory}
                  >
                    <Ionicons name="call-outline" size={16} color={colors.gold} />
                    <Text style={[styles.quickCallText, { color: colors.gold }]}>
                      Call Gallery
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  enquirySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "90%",
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  enquiryFormContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 13,
  },
  enquiryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  closeModalCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetEyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    lineHeight: 28,
  },
  artworkSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  artworkSummaryThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  artworkSummaryInfo: {
    flex: 1,
  },
  artworkSummaryTitle: {
    fontSize: 14,
    fontFamily: FONTS.serifBold,
  },
  artworkSummaryArtist: {
    fontSize: 12,
    fontFamily: FONTS.sansSemiBold,
    marginTop: 2,
  },
  artworkSummaryId: {
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    marginTop: 2,
  },
  enquiryErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDEDEC",
    borderWidth: 1,
    borderColor: "#F5B7B1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  enquiryErrorText: {
    color: "#E74C3C",
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    flex: 1,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  textAreaInput: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  submitEnquiryBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  submitEnquiryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  quickChannelsContainer: {
    marginTop: 8,
    alignItems: "center",
    gap: 8,
  },
  quickChannelsTitle: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  quickChannelsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  quickWhatsappBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickWhatsappText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  quickCallBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickCallText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  enquirySuccessContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: "center",
    gap: 12,
  },
  enquirySuccessBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  enquirySuccessEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  enquirySuccessTitle: {
    fontSize: 22,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
  },
  enquiryRefBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  enquiryRefLabel: {
    fontSize: 9,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
  enquiryRefValue: {
    fontSize: 13,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  enquirySuccessDescription: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  successActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 6,
  },
  whatsappFollowUpBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  whatsappFollowUpText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  phoneFollowUpBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  phoneFollowUpText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  doneButton: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
});
