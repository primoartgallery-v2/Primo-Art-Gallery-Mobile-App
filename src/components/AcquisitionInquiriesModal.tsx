import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

type ArtworkEnrichment = {
  imageUrl?: string | null;
  artistName?: string;
  price?: string;
  medium?: string;
  dimensions?: string;
  isLoading: boolean;
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
      Linking.openURL(`mailto:${GALLERY_CONFIG.email}?subject=${encodeURIComponent(`Acquisition Inquiry ${enquiry.enquiryId}`)}&body=${encodeURIComponent(text)}`).catch(() => {});
    });
  };

  const handleShareDossier = (enquiry: CollectorEnquiryItem) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const shareMessage = `Primo Art Gallery — Acquisition Dossier\n\nArtwork: ${enquiry.artworkTitle}\nItem #${enquiry.artworkId}\nReference ID: ${enquiry.enquiryId}\nStatus: ${formatStatus(enquiry.status).label}\nDate: ${formatDate(enquiry.createdAt)}\n\nCurated by Primo Art Gallery, New Delhi`;
    Share.share({
      title: `Acquisition Enquiry: ${enquiry.artworkTitle}`,
      message: shareMessage,
    }).catch(() => {});
  };

  // Helper for formatting status
  function formatStatus(status: string) {
    switch (status?.toLowerCase()) {
      case "contacted":
        return {
          label: "Curator Contacted",
          badgeBg: "rgba(46, 204, 113, 0.14)",
          badgeBorder: "rgba(46, 204, 113, 0.4)",
          textColor: "#2ECC71",
          icon: "chatbubbles-outline",
          desc: "Our curatorial concierge has reached out to your contact on record.",
        };
      case "in_progress":
      case "under_review":
        return {
          label: "Dossier In Preparation",
          badgeBg: "rgba(52, 152, 219, 0.14)",
          badgeBorder: "rgba(52, 152, 219, 0.4)",
          textColor: "#3498DB",
          icon: "document-text-outline",
          desc: "A bespoke valuation and condition dossier is currently being prepared.",
        };
      case "closed":
      case "acquired":
        return {
          label: "Acquisition Concluded",
          badgeBg: "rgba(142, 142, 147, 0.14)",
          badgeBorder: "rgba(142, 142, 147, 0.4)",
          textColor: "#8E8E93",
          icon: "checkmark-done-circle-outline",
          desc: "This curatorial inquiry has been successfully fulfilled or archived.",
        };
      case "pending_review":
      default:
        return {
          label: "Under Curatorial Review",
          badgeBg: "rgba(212, 175, 55, 0.14)",
          badgeBorder: "rgba(212, 175, 55, 0.4)",
          textColor: colors.gold,
          icon: "time-outline",
          desc: "Our curatorial board is reviewing provenance, valuation, and custom logistics.",
        };
    }
  }

  // Format Date cleanly e.g. "02 Sep 2026, 11:30 AM"
  function formatDate(dateStr: string) {
    if (!dateStr) return "Recently Submitted";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Recently Submitted";
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Recently Submitted";
    }
  }

  function formatDateTime(dateStr: string) {
    if (!dateStr) return "Recently Submitted";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Recently Submitted";
      return `${d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })} at ${d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return "Recently Submitted";
    }
  }

  // RENDER INDIVIDUAL ENQUIRY CARD
  const renderEnquiryCard = ({ item }: { item: CollectorEnquiryItem }) => {
    const enrichment = artworkDetailsMap[item.artworkId];
    const statusInfo = formatStatus(item.status);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDark ? "#14151B" : "#FFFFFF",
            borderColor: isDark ? "rgba(212, 175, 55, 0.16)" : "rgba(0,0,0,0.08)",
          },
          pressed && {
            transform: [{ scale: 0.985 }],
            borderColor: colors.gold,
          },
        ]}
        onPress={() => handleSelectEnquiry(item)}
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
              <Text style={[styles.cardItemNumber, { color: colors.textSecondary }]}>
                Item #{item.artworkId}
              </Text>
              <Text style={[styles.cardMetaDot, { color: colors.border }]}>•</Text>
              <Text style={[styles.cardDateText, { color: colors.textSecondary }]}>
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
                  style={[styles.statusBadgeText, { color: statusInfo.textColor }]}
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
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <Text
              style={[styles.messageSnippetText, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              "{item.message}"
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  // RENDER DETAIL VIEW
  const renderDetailView = (enquiry: CollectorEnquiryItem) => {
    const enrichment = artworkDetailsMap[enquiry.artworkId];
    const statusInfo = formatStatus(enquiry.status);

    return (
      <ScrollView
        style={styles.detailScrollView}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ARTWORK HERO IMAGE */}
        <Pressable
          style={styles.detailImageWrapper}
          onPress={() => handleOpenPainting(enquiry.artworkId)}
        >
          {enrichment?.imageUrl ? (
            <ExpoImage
              source={{ uri: enrichment.imageUrl }}
              style={styles.detailArtworkImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                styles.detailArtworkImageFallback,
                { backgroundColor: isDark ? "#1E202B" : "#F0ECE1" },
              ]}
            >
              <Ionicons name="image-outline" size={54} color={colors.gold} />
              <Text style={[styles.fallbackTitle, { color: colors.textSecondary }]}>
                {enquiry.artworkTitle}
              </Text>
            </View>
          )}

          {/* TAP TO VIEW CATALOGUE OVERLAY */}
          <View style={styles.viewCataloguePill}>
            <Ionicons name="open-outline" size={14} color="#FFFFFF" />
            <Text style={styles.viewCatalogueText}>View in Catalogue</Text>
          </View>
        </Pressable>

        {/* ARTWORK TITLE & ARTIST */}
        <View style={styles.detailInfoSection}>
          <Text style={[styles.detailEyebrow, { color: colors.gold }]}>
            ACQUISITION DOSSIER
          </Text>
          <Text style={[styles.detailArtworkTitle, { color: isDark ? "#FFFFFF" : colors.text }]}>
            {enquiry.artworkTitle}
          </Text>
          <Text style={[styles.detailArtistName, { color: isDark ? "#E5C07B" : colors.gold }]}>
            by {enrichment?.artistName || "Master Artist (Primo Curated)"}
          </Text>

          {/* STATUS BANNER */}
          <View
            style={[
              styles.detailStatusBanner,
              {
                backgroundColor: statusInfo.badgeBg,
                borderColor: statusInfo.badgeBorder,
              },
            ]}
          >
            <View style={styles.detailStatusHeader}>
              <Ionicons
                name={statusInfo.icon as any}
                size={18}
                color={statusInfo.textColor}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.detailStatusTitle, { color: statusInfo.textColor }]}>
                {statusInfo.label}
              </Text>
            </View>
            <Text style={[styles.detailStatusDesc, { color: colors.textSecondary }]}>
              {statusInfo.desc}
            </Text>
          </View>

          {/* METADATA GRID */}
          <View
            style={[
              styles.metaGrid,
              {
                backgroundColor: isDark ? "#14151B" : "#FFFFFF",
                borderColor: isDark ? "rgba(212, 175, 55, 0.16)" : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                  ITEM NUMBER
                </Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  #{enquiry.artworkId}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                  DOSSIER REF
                </Text>
                <Text
                  style={[styles.metaValue, { color: colors.gold }]}
                  numberOfLines={1}
                >
                  {enquiry.enquiryId}
                </Text>
              </View>
            </View>

            <View style={[styles.metaDivider, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.borderLight }]} />

            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                  SUBMITTED DATE
                </Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {formatDateTime(enquiry.createdAt)}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                  CURATORIAL DESK
                </Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  New Delhi, IN
                </Text>
              </View>
            </View>
          </View>

          {/* COLLECTOR'S MESSAGE */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? "#14151B" : "#FFFFFF",
                borderColor: isDark ? "rgba(212, 175, 55, 0.16)" : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Collector's Inquiry Request
              </Text>
            </View>
            <Text style={[styles.collectorMessageText, { color: colors.text }]}>
              "{enquiry.message || "I am interested in acquiring this original artwork."}"
            </Text>
          </View>

          {/* CURATORIAL NEXT STEPS */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? "#14151B" : "#FFFFFF",
                borderColor: isDark ? "rgba(212, 175, 55, 0.16)" : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Curatorial Protocol & Next Steps
              </Text>
            </View>
            <Text style={[styles.protocolText, { color: colors.textSecondary }]}>
              • Direct Private Advisory: A senior art consultant will review the current reserve, collector terms, and authenticated provenance.
            </Text>
            <Text style={[styles.protocolText, { color: colors.textSecondary }]}>
              • Physical Inspection & CoA: Every acquisition includes an official sealed Certificate of Authenticity and museum-grade condition dossier.
            </Text>
            <Text style={[styles.protocolText, { color: colors.textSecondary }]}>
              • White-Glove Logistics: Worldwide insured art courier and professional white-glove installation available upon acquisition.
            </Text>
          </View>

          {/* COLLECTOR CONTACT ON RECORD */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? "#14151B" : "#FFFFFF",
                borderColor: isDark ? "rgba(212, 175, 55, 0.16)" : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-outline" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Collector Contact On Record
              </Text>
            </View>
            <View style={styles.contactRow}>
              <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Name:</Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>{enquiry.collectorName || "Collector"}</Text>
            </View>
            <View style={styles.contactRow}>
              <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>{enquiry.collectorEmail || "—"}</Text>
            </View>
            {enquiry.collectorPhone ? (
              <View style={styles.contactRow}>
                <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Phone:</Text>
                <Text style={[styles.contactValue, { color: colors.text }]}>{enquiry.collectorPhone}</Text>
              </View>
            ) : null}
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.detailActionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryCuratorButton,
                { backgroundColor: colors.gold },
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
              onPress={() => handleContactCurator(enquiry)}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#0D0D0F" style={{ marginRight: 8 }} />
              <Text style={styles.primaryCuratorButtonText}>CONTACT SENIOR CURATOR</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: isDark ? "#1E202B" : "#F4EFE6",
                  borderColor: isDark ? "rgba(212, 175, 55, 0.3)" : colors.border,
                },
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
              onPress={() => handleOpenPainting(enquiry.artworkId)}
            >
              <Ionicons name="images-outline" size={18} color={colors.gold} style={{ marginRight: 8 }} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                VIEW PAINTING IN CATALOGUE
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.shareDossierButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleShareDossier(enquiry)}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.gold} style={{ marginRight: 6 }} />
              <Text style={[styles.shareDossierText, { color: colors.gold }]}>
                Share Dossier Reference
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
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
              borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : colors.borderLight,
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
            <Text style={[styles.title, { color: isDark ? "#FFFFFF" : colors.text }]}>
              {selectedEnquiry ? "Inquiry Details" : "Acquisition Inquiries"}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {!selectedEnquiry ? (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isDark ? "rgba(212, 175, 55, 0.15)" : colors.goldBadge,
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
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border,
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
          renderDetailView(selectedEnquiry)
        ) : enquiries.length > 0 ? (
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
        ) : (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: isDark ? "#171821" : "#F4EFE6",
                  borderColor: isDark ? "rgba(212, 175, 55, 0.25)" : colors.goldSoft,
                },
              ]}
            >
              <Ionicons name="cube-outline" size={44} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? "#FFFFFF" : colors.text }]}>
              No Acquisition Inquiries Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              When you submit an acquisition enquiry on any masterpiece, your private curatorial dossiers and advisory updates will appear here.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyExploreButton,
                { backgroundColor: colors.gold },
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
              ]}
              onPress={() => {
                handleClose();
                router.push("/explore" as any);
              }}
            >
              <Text style={styles.emptyExploreButtonText}>EXPLORE MASTERWORKS</Text>
            </Pressable>
          </View>
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

  // DETAIL VIEW STYLES
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    paddingBottom: 50,
  },
  detailImageWrapper: {
    width: "100%",
    height: 280,
    position: "relative",
    backgroundColor: "#111218",
  },
  detailArtworkImage: {
    width: "100%",
    height: "100%",
  },
  detailArtworkImageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  fallbackTitle: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
  },
  viewCataloguePill: {
    position: "absolute",
    bottom: 14,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  viewCatalogueText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  detailInfoSection: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  detailEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  detailArtworkTitle: {
    fontSize: 24,
    fontFamily: FONTS.serifBold,
    lineHeight: 30,
    marginBottom: 4,
  },
  detailArtistName: {
    fontSize: 15,
    fontFamily: FONTS.sansSemiBold,
    marginBottom: 16,
  },
  detailStatusBanner: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  detailStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailStatusTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.3,
  },
  detailStatusDesc: {
    fontSize: 12.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
  },
  metaGrid: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9.5,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13.5,
    fontFamily: FONTS.sansSemiBold,
  },
  metaDivider: {
    height: 1,
    marginVertical: 12,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  collectorMessageText: {
    fontSize: 13.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 20,
    fontStyle: "italic",
  },
  protocolText: {
    fontSize: 12.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  contactLabel: {
    fontSize: 12.5,
    fontFamily: FONTS.sansRegular,
  },
  contactValue: {
    fontSize: 13,
    fontFamily: FONTS.sansSemiBold,
  },
  detailActionButtons: {
    marginTop: 8,
    gap: 12,
  },
  primaryCuratorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 28,
  },
  primaryCuratorButtonText: {
    color: "#0D0D0F",
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  shareDossierButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  shareDossierText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
});
