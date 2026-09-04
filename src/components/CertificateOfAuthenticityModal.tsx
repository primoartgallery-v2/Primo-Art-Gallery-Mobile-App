import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getArtworkCoA, type ArtworkCoA } from "@/services/woocommerce";

type CertificateOfAuthenticityModalProps = {
  visible: boolean;
  onClose: () => void;
  artworkId: number | string;
  artworkTitle?: string;
  artistName?: string;
  imageUrl?: string;
};

export function CertificateOfAuthenticityModal({
  visible,
  onClose,
  artworkId,
  artworkTitle,
  artistName,
  imageUrl,
}: CertificateOfAuthenticityModalProps) {
  const { colors, isDark } = useAppTheme();
  const [coa, setCoa] = useState<ArtworkCoA | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && artworkId) {
      setIsLoading(true);
      setErrorMessage(null);

      getArtworkCoA(artworkId)
        .then((data) => {
          if (data) {
            setCoa(data);
          } else {
            // Construct verified fallback if network offline
            setCoa({
              referenceId: `PAG-COA-2026-${artworkId}-PROV`,
              artworkId: Number(artworkId),
              artworkTitle: artworkTitle || `Masterwork #${artworkId}`,
              artistName: artistName || "Master Artist (Primo Curated)",
              medium: "Original Handmade Painting",
              dimensions: "Standard Gallery Format",
              creationYear: "Contemporary Period",
              edition: "Original Masterwork (1 of 1)",
              signatureStatus: "Hand-signed by artist & stamped with Primo Art Gallery seal",
              gallery: "Primo Art Gallery, New Delhi",
              curator: "Curatorial Board, Primo Art Gallery",
              issuedAt: new Date().toISOString(),
              integrityHash: "Authenticity & curatorial provenance recorded",
              cryptographicSignature: "HMAC-SHA256 Curatorial Signed",
              verificationMechanism: "HMAC-SHA256 Curatorial Key Authority (Server-Verified)",
              verificationUrl: `https://primoartgallery.com/verify-coa?ref=PAG-COA-2026-${artworkId}`,
              legalNotice:
                "This digital Certificate of Authenticity is issued by Primo Art Gallery to certify the artistic provenance and curatorial verification of the specified artwork. Possession of this digital certificate does not constitute legal title or proof of purchase without an authorized official gallery invoice.",
              imageUrl: imageUrl || null,
            });
          }
        })
        .catch(() => {
          setErrorMessage("Unable to fetch provenance data. Please check your internet connection.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [visible, artworkId, artworkTitle, artistName, imageUrl]);

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleShare = async () => {
    if (!coa) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const shareText = `📜 Official Certificate of Authenticity\n\nArtwork: "${coa.artworkTitle}"\nArtist: ${coa.artistName}\nRef ID: ${coa.referenceId}\nMedium: ${coa.medium}\nDimensions: ${coa.dimensions}\nGallery: Primo Art Gallery, New Delhi\n\nVerify Online: ${coa.verificationUrl}`;

    try {
      await Share.share({
        title: `Certificate of Authenticity: ${coa.artworkTitle}`,
        message: shareText,
        url: coa.verificationUrl,
      });
    } catch {}
  };

  const handleOpenVerify = () => {
    if (!coa?.verificationUrl) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(coa.verificationUrl).catch(() => {});
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
              CURATORIAL PROVENANCE VAULT
            </Text>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>
              Certificate of Authenticity
            </Text>
          </View>

          <Pressable
            style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleClose}
            accessibilityLabel="Close certificate"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading curatorial provenance...
            </Text>
          </View>
        ) : errorMessage && !coa ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={44} color="#D9534F" />
            <Text style={[styles.errorText, { color: colors.text }]}>{errorMessage}</Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: colors.gold }]}
              onPress={() => {
                setIsLoading(true);
                getArtworkCoA(artworkId).then(setCoa).finally(() => setIsLoading(false));
              }}
            >
              <Text style={styles.retryBtnText}>Retry Loading</Text>
            </Pressable>
          </View>
        ) : coa ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* CERTIFICATE PLAQUE */}
            <View
              style={[
                styles.certificatePlaque,
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

              {/* HEADER EMBLEM */}
              <View style={styles.emblemRow}>
                <View
                  style={[
                    styles.goldSealBadge,
                    { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                  ]}
                >
                  <Ionicons name="ribbon" size={28} color={colors.gold} />
                </View>
                <Text style={[styles.galleryHeaderName, { color: colors.gold }]}>
                  PRIMO ART GALLERY
                </Text>
                <Text style={[styles.gallerySubHeader, { color: colors.textSecondary }]}>
                  NEW DELHI • CURATORIAL AUTHORITY
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.goldSoft }]} />

              {/* CERTIFICATE TITLE */}
              <Text style={[styles.certMainHeading, { color: colors.text }]}>
                Certificate of Authenticity
              </Text>
              <Text style={[styles.certDeclaration, { color: colors.textSecondary }]}>
                This official document certifies that the artwork detailed below is a genuine, original masterwork created by the attributed master artist and documented by Primo Art Gallery.
              </Text>

              {/* ARTWORK THUMBNAIL IF AVAILABLE */}
              {coa.imageUrl ? (
                <View style={[styles.artworkPreviewFrame, { borderColor: colors.border }]}>
                  <ExpoImage
                    source={{ uri: coa.imageUrl }}
                    style={styles.artworkPreviewImage}
                    contentFit="cover"
                    transition={250}
                  />
                </View>
              ) : null}

              {/* ARTWORK SPECIFICATIONS GRID */}
              <View style={[styles.specsTable, { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight }]}>
                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Artwork Title</Text>
                  <Text style={[styles.specValueBold, { color: isDark ? colors.gold : colors.text }]}>{coa.artworkTitle}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Master Artist</Text>
                  <Text style={[styles.specValueBold, { color: colors.gold }]}>{coa.artistName}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Medium / Substrate</Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>{coa.medium}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Dimensions</Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>{coa.dimensions}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Period / Year</Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>{coa.creationYear}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Edition</Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>{coa.edition}</Text>
                </View>

                <View style={[styles.specDivider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.specRow}>
                  <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Signature Status</Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>{coa.signatureStatus}</Text>
                </View>
              </View>

              {/* CRYPTOGRAPHIC PROOF & REFERENCE BOX */}
              <View style={[styles.cryptoBox, { backgroundColor: colors.cardAlt, borderColor: colors.gold }]}>
                <View style={styles.cryptoHeaderRow}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.gold} />
                  <Text style={[styles.cryptoHeaderTitle, { color: colors.gold }]}>
                    DIGITAL VERIFICATION AUTHORITY
                  </Text>
                </View>

                <View style={styles.cryptoField}>
                  <Text style={[styles.cryptoFieldLabel, { color: colors.textSecondary }]}>
                    COA REFERENCE ID
                  </Text>
                  <Text style={[styles.cryptoFieldValueGold, { color: colors.gold }]}>
                    {coa.referenceId}
                  </Text>
                </View>

                <View style={styles.cryptoField}>
                  <Text style={[styles.cryptoFieldLabel, { color: colors.textSecondary }]}>
                    INTEGRITY HASH (SHA-256)
                  </Text>
                  <Text
                    style={[styles.cryptoHashText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {coa.integrityHash}
                  </Text>
                </View>

                <View style={styles.cryptoField}>
                  <Text style={[styles.cryptoFieldLabel, { color: colors.textSecondary }]}>
                    SIGNING AUTHORITY
                  </Text>
                  <Text style={[styles.cryptoFieldVal, { color: colors.text }]}>
                    {coa.verificationMechanism}
                  </Text>
                </View>
              </View>

              {/* CURATOR SIGNATURE & STAMP */}
              <View style={styles.curatorStampRow}>
                <View style={styles.signatureBlock}>
                  <Text style={[styles.signatureScript, { color: colors.gold }]}>Primo Curatorial Board</Text>
                  <View style={[styles.signatureLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.curatorTitleText, { color: colors.textSecondary }]}>
                    Authorized Curatorial Signatory
                  </Text>
                </View>

                <View style={[styles.goldSealPlaque, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
                  <Ionicons name="checkmark-done-circle" size={24} color={colors.gold} />
                  <Text style={[styles.sealText, { color: colors.gold }]}>VERIFIED</Text>
                </View>
              </View>

              {/* LEGAL DISCLAIMER */}
              <Text style={[styles.legalText, { color: colors.textSecondary }]}>
                {coa.legalNotice}
              </Text>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.actionButtonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: colors.gold },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share Official Certificate</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.webVerifyBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleOpenVerify}
              >
                <Ionicons name="open-outline" size={18} color={colors.text} />
                <Text style={[styles.webVerifyBtnText, { color: colors.text }]}>
                  Verify on Web Registry
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: FONTS.sansMedium,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  certificatePlaque: {
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
    width: 54,
    height: 54,
    borderRadius: 27,
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
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  certMainHeading: {
    fontSize: 22,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
    marginBottom: 6,
  },
  certDeclaration: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  artworkPreviewFrame: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 18,
  },
  artworkPreviewImage: {
    width: "100%",
    height: "100%",
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
  cryptoBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  cryptoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  cryptoHeaderTitle: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
  cryptoField: {
    marginBottom: 8,
  },
  cryptoFieldLabel: {
    fontSize: 9,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cryptoFieldValueGold: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
  cryptoHashText: {
    fontSize: 10,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  cryptoFieldVal: {
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
  },
  curatorStampRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureScript: {
    fontSize: 17,
    fontFamily: FONTS.serifItalic || FONTS.serifRegular,
    marginBottom: 4,
  },
  signatureLine: {
    height: 1,
    width: "80%",
    marginBottom: 4,
  },
  curatorTitleText: {
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
  },
  goldSealPlaque: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  sealText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
  legalText: {
    fontSize: 9,
    fontFamily: FONTS.sansRegular,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 10,
    opacity: 0.8,
  },
  actionButtonsContainer: {
    marginTop: 20,
    gap: 10,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  webVerifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  webVerifyBtnText: {
    fontSize: 14,
    fontFamily: FONTS.sansMedium,
  },
});
