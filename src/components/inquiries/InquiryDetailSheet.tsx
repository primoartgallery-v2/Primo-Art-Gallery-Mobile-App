import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { CollectorEnquiryItem } from "@/services/enquiryService";
import {
  formatDateTime,
  formatStatus,
  type ArtworkEnrichment,
} from "./inquiryTypes";

export type InquiryDetailSheetProps = {
  enquiry: CollectorEnquiryItem;
  enrichment?: ArtworkEnrichment;
  onOpenPainting: (artworkId: number) => void;
  onContactCurator: (enquiry: CollectorEnquiryItem) => void;
  onShareDossier: (enquiry: CollectorEnquiryItem) => void;
};

export function InquiryDetailSheet({
  enquiry,
  enrichment,
  onOpenPainting,
  onContactCurator,
  onShareDossier,
}: InquiryDetailSheetProps) {
  const { colors, isDark } = useAppTheme();
  const statusInfo = formatStatus(enquiry.status, colors.gold);

  return (
    <ScrollView
      style={styles.detailScrollView}
      contentContainerStyle={styles.detailScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ARTWORK HERO IMAGE */}
      <Pressable
        style={styles.detailImageWrapper}
        onPress={() => onOpenPainting(enquiry.artworkId)}
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
            <Text
              style={[styles.fallbackTitle, { color: colors.textSecondary }]}
            >
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
        <Text
          style={[
            styles.detailArtworkTitle,
            { color: isDark ? "#FFFFFF" : colors.text },
          ]}
        >
          {enquiry.artworkTitle}
        </Text>
        <Text
          style={[
            styles.detailArtistName,
            { color: isDark ? "#E5C07B" : colors.gold },
          ]}
        >
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
            <Text
              style={[
                styles.detailStatusTitle,
                { color: statusInfo.textColor },
              ]}
            >
              {statusInfo.label}
            </Text>
          </View>
          <Text
            style={[styles.detailStatusDesc, { color: colors.textSecondary }]}
          >
            {statusInfo.desc}
          </Text>
        </View>

        {/* METADATA GRID */}
        <View
          style={[
            styles.metaGrid,
            {
              backgroundColor: isDark ? "#14151B" : "#FFFFFF",
              borderColor: isDark
                ? "rgba(212, 175, 55, 0.16)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text
                style={[styles.metaLabel, { color: colors.textSecondary }]}
              >
                ITEM NUMBER
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                #{enquiry.artworkId}
              </Text>
            </View>
            <View style={styles.metaCol}>
              <Text
                style={[styles.metaLabel, { color: colors.textSecondary }]}
              >
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

          <View
            style={[
              styles.metaDivider,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : colors.borderLight,
              },
            ]}
          />

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text
                style={[styles.metaLabel, { color: colors.textSecondary }]}
              >
                SUBMITTED DATE
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatDateTime(enquiry.createdAt)}
              </Text>
            </View>
            <View style={styles.metaCol}>
              <Text
                style={[styles.metaLabel, { color: colors.textSecondary }]}
              >
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
              borderColor: isDark
                ? "rgba(212, 175, 55, 0.16)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={18}
              color={colors.gold}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Collector&apos;s Inquiry Request
            </Text>
          </View>
          <Text
            style={[styles.collectorMessageText, { color: colors.text }]}
          >
            &ldquo;
            {enquiry.message ||
              "I am interested in acquiring this original artwork."}
            &rdquo;
          </Text>
        </View>

        {/* CURATORIAL NEXT STEPS */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? "#14151B" : "#FFFFFF",
              borderColor: isDark
                ? "rgba(212, 175, 55, 0.16)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.gold}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Curatorial Protocol & Next Steps
            </Text>
          </View>
          <Text
            style={[styles.protocolText, { color: colors.textSecondary }]}
          >
            • Direct Private Advisory: A senior art consultant will review the
            current reserve, collector terms, and authenticated provenance.
          </Text>
          <Text
            style={[styles.protocolText, { color: colors.textSecondary }]}
          >
            • Physical Inspection & CoA: Every acquisition includes an official
            sealed Certificate of Authenticity and museum-grade condition
            dossier.
          </Text>
          <Text
            style={[styles.protocolText, { color: colors.textSecondary }]}
          >
            • White-Glove Logistics: Worldwide insured art courier and
            professional white-glove installation available upon acquisition.
          </Text>
        </View>

        {/* COLLECTOR CONTACT ON RECORD */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? "#14151B" : "#FFFFFF",
              borderColor: isDark
                ? "rgba(212, 175, 55, 0.16)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.gold}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Collector Contact On Record
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Text
              style={[styles.contactLabel, { color: colors.textSecondary }]}
            >
              Name:
            </Text>
            <Text style={[styles.contactValue, { color: colors.text }]}>
              {enquiry.collectorName || "Collector"}
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Text
              style={[styles.contactLabel, { color: colors.textSecondary }]}
            >
              Email:
            </Text>
            <Text style={[styles.contactValue, { color: colors.text }]}>
              {enquiry.collectorEmail || "—"}
            </Text>
          </View>
          {enquiry.collectorPhone ? (
            <View style={styles.contactRow}>
              <Text
                style={[styles.contactLabel, { color: colors.textSecondary }]}
              >
                Phone:
              </Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>
                {enquiry.collectorPhone}
              </Text>
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
            onPress={() => onContactCurator(enquiry)}
          >
            <Ionicons
              name="logo-whatsapp"
              size={20}
              color="#0D0D0F"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryCuratorButtonText}>
              CONTACT SENIOR CURATOR
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: isDark ? "#1E202B" : "#F4EFE6",
                borderColor: isDark
                  ? "rgba(212, 175, 55, 0.3)"
                  : colors.border,
              },
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
            ]}
            onPress={() => onOpenPainting(enquiry.artworkId)}
          >
            <Ionicons
              name="images-outline"
              size={18}
              color={colors.gold}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              VIEW PAINTING IN CATALOGUE
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.shareDossierButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onShareDossier(enquiry)}
          >
            <Ionicons
              name="share-social-outline"
              size={16}
              color={colors.gold}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.shareDossierText, { color: colors.gold }]}>
              Share Dossier Reference
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
