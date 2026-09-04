import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InquiriesListView } from "@/components/inquiries/InquiriesListView";
import { InquiryDetailSheet } from "@/components/inquiries/InquiryDetailSheet";
import {
  formatDate,
  formatStatus,
  type ArtworkEnrichment,
} from "@/components/inquiries/inquiryTypes";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { CollectorEnquiryItem } from "@/services/enquiryService";
import { getProduct, type WooCommerceProduct } from "@/services/woocommerce";

type AcquisitionInquiriesModalProps = {
  visible: boolean;
  onClose: () => void;
  enquiries: CollectorEnquiryItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  initialSelectedEnquiry?: CollectorEnquiryItem | null;
};

export function AcquisitionInquiriesModal({
  visible,
  onClose,
  enquiries,
  isLoading = false,
  onRefresh,
  initialSelectedEnquiry = null,
}: AcquisitionInquiriesModalProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [selectedEnquiry, setSelectedEnquiry] = useState<CollectorEnquiryItem | null>(
    initialSelectedEnquiry
  );
  const [artworkDetailsMap, setArtworkDetailsMap] = useState<Record<number, ArtworkEnrichment>>({});

  // Reset selected enquiry when modal opens or initialSelectedEnquiry changes
  useEffect(() => {
    if (visible) {
      setSelectedEnquiry(initialSelectedEnquiry);
    }
  }, [visible, initialSelectedEnquiry]);

  // Asynchronously fetch artwork metadata (image, artist, price) for all visible enquiries
  useEffect(() => {
    if (!visible || enquiries.length === 0) return;

    enquiries.forEach((item) => {
      const artId = item.artworkId;
      if (!artId || artworkDetailsMap[artId]) return;

      getProduct(artId)
        .then((product: WooCommerceProduct) => {
          let artist = "Master Artist (Primo Curated)";
          if (product.attributes) {
            const attr = product.attributes.find(
              (a) =>
                a.name.toLowerCase().includes("artist") ||
                a.name.toLowerCase() === "creator"
            );
            if (attr) {
              artist = attr.option || (attr.options && attr.options[0]) || artist;
            }
          }

          let medium = "Original Handmade Painting";
          if (product.attributes) {
            const medAttr = product.attributes.find(
              (a) =>
                a.name.toLowerCase().includes("medium") ||
                a.name.toLowerCase().includes("material")
            );
            if (medAttr) {
              medium = medAttr.option || (medAttr.options && medAttr.options[0]) || medium;
            }
          }

          const dims =
            product.dimensions && (product.dimensions.length || product.dimensions.width)
              ? `${product.dimensions.length || "—"} × ${product.dimensions.width || "—"} cm`
              : "Standard Gallery Format";

          setArtworkDetailsMap((prev) => ({
            ...prev,
            [artId]: {
              imageUrl: product.images?.[0]?.src || null,
              artistName: artist,
              price: product.price ? `₹ ${Number(product.price).toLocaleString("en-IN")}` : undefined,
              medium,
              dimensions: dims,
              isLoading: false,
            },
          }));
        })
        .catch(() => {
          setArtworkDetailsMap((prev) => ({
            ...prev,
            [artId]: {
              imageUrl: null,
              artistName: "Master Artist (Primo Curated)",
              isLoading: false,
            },
          }));
        });
    });
  }, [visible, enquiries, artworkDetailsMap]);

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedEnquiry(null);
    onClose();
  };

  const handleSelectEnquiry = (enquiry: CollectorEnquiryItem) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedEnquiry(enquiry);
  };

  const handleBackToList = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedEnquiry(null);
  };

  const handleOpenPainting = (artworkId: number) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    handleClose();
    router.push(`/painting/${artworkId}` as any);
  };

  const handleContactCurator = (enquiry: CollectorEnquiryItem) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const text = `Hello Primo Art Gallery,\n\nI am inquiring about my active acquisition request:\n• Artwork: "${enquiry.artworkTitle}" (Item #${enquiry.artworkId})\n• Dossier Reference: ${enquiry.enquiryId}\n• Collector: ${enquiry.collectorName}\n\nPlease provide curatorial updates, pricing dossier, and acquisition terms.`;
    const cleanPhone = GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "");
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`).catch(() => {
      Linking.openURL(
        `mailto:${GALLERY_CONFIG.email}?subject=${encodeURIComponent(`Acquisition Inquiry ${enquiry.enquiryId}`)}&body=${encodeURIComponent(text)}`
      ).catch(() => {});
    });
  };

  const handleShareDossier = (enquiry: CollectorEnquiryItem) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const shareMessage = `Primo Art Gallery — Acquisition Dossier\n\nArtwork: ${enquiry.artworkTitle}\nItem #${enquiry.artworkId}\nReference ID: ${enquiry.enquiryId}\nStatus: ${formatStatus(enquiry.status, colors.gold).label}\nDate: ${formatDate(enquiry.createdAt)}\n\nCurated by Primo Art Gallery, New Delhi`;
    Share.share({
      title: `Acquisition Enquiry: ${enquiry.artworkTitle}`,
      message: shareMessage,
    }).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={selectedEnquiry ? handleBackToList : handleClose}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDark ? "#0D0D0F" : colors.background },
        ]}
        edges={["top", "bottom"]}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        {/* LUXURY HEADER */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? "#0D0D0F" : colors.headerBackground,
              borderBottomColor: isDark
                ? "rgba(255,255,255,0.08)"
                : colors.borderLight,
            },
          ]}
        >
          {selectedEnquiry ? (
            <Pressable
              style={[
                styles.headerButton,
                {
                  backgroundColor: isDark ? "#1A1C24" : colors.card,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border,
                },
              ]}
              onPress={handleBackToList}
              accessibilityLabel="Back to inquiries list"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.headerButton,
                {
                  backgroundColor: isDark ? "#1A1C24" : colors.card,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border,
                },
              ]}
              onPress={handleClose}
              accessibilityLabel="Close inquiries modal"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          )}

          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>
              {selectedEnquiry ? "CURATORIAL DOSSIER" : "PRIVATE COLLECTION"}
            </Text>
            <Text
              style={[styles.title, { color: isDark ? "#FFFFFF" : colors.text }]}
            >
              {selectedEnquiry ? "Inquiry Details" : "Acquisition Inquiries"}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {!selectedEnquiry ? (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(212, 175, 55, 0.15)"
                      : colors.goldBadge,
                    borderColor: colors.gold,
                  },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: colors.gold }]}>
                  {enquiries.length}
                </Text>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.headerButton,
                  {
                    backgroundColor: isDark ? "#1A1C24" : colors.card,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : colors.border,
                  },
                ]}
                onPress={handleClose}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>

        {/* BODY CONTENT */}
        {selectedEnquiry ? (
          <InquiryDetailSheet
            enquiry={selectedEnquiry}
            enrichment={artworkDetailsMap[selectedEnquiry.artworkId]}
            onOpenPainting={handleOpenPainting}
            onContactCurator={handleContactCurator}
            onShareDossier={handleShareDossier}
          />
        ) : (
          <InquiriesListView
            enquiries={enquiries}
            artworkDetailsMap={artworkDetailsMap}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onSelectEnquiry={handleSelectEnquiry}
            onExplore={() => {
              handleClose();
              router.push("/explore" as any);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 19,
    fontFamily: FONTS.serifBold,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  countBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
});
