import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

interface AboutContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutContactModal({ visible, onClose }: AboutContactModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleLink = (url: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(url).catch(() => {});
  };

  const handleCall = () => handleLink(`tel:${GALLERY_CONFIG.phoneRaw}`);
  const handleWhatsApp = () => {
    const msg = encodeURIComponent("Hello Primo Art Gallery, I would like to inquire about your art collections and exhibitions.");
    handleLink(`https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=${msg}`);
  };
  const handleEmail = () => handleLink(`mailto:${GALLERY_CONFIG.email}`);
  const handleMaps = () => handleLink(GALLERY_CONFIG.mapsUrl);
  const handleWebsite = () => handleLink(GALLERY_CONFIG.website);
  const handleInstagram = () => handleLink(GALLERY_CONFIG.instagram);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              {/* Header Bar */}
              <View style={styles.topBar}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: isDark ? "#3A3C4A" : "#D8D2C5" },
                  ]}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.closeBtn,
                    { backgroundColor: colors.backgroundElement },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={onClose}
                  accessibilityLabel="Close modal"
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Brand Hero */}
                <View style={styles.brandHero}>
                  <View
                    style={[
                      styles.logoBadge,
                      {
                        backgroundColor: colors.goldSoft,
                        borderColor: isDark ? "#43371E" : "#EAD9B5",
                      },
                    ]}
                  >
                    <Ionicons name="color-palette-outline" size={30} color={colors.gold} />
                  </View>
                  <Text style={[styles.galleryTitle, { color: colors.text }]}>
                    {GALLERY_CONFIG.name}
                  </Text>
                  <Text style={[styles.galleryTagline, { color: colors.gold }]}>
                    {GALLERY_CONFIG.tagline}
                  </Text>
                </View>

                {/* About Section */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: colors.cardAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      About Our Gallery
                    </Text>
                  </View>
                  <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
                    {GALLERY_CONFIG.aboutStory}
                  </Text>

                  <View
                    style={[
                      styles.authenticityBadge,
                      {
                        backgroundColor: colors.goldBadge,
                        borderColor: isDark ? "#3F3720" : "#E8D8B6",
                      },
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={16} color={colors.gold} />
                    <Text style={[styles.authenticityText, { color: colors.goldBadgeText }]}>
                      100% Guaranteed Authenticity with Certificates
                    </Text>
                  </View>
                </View>

                {/* Direct Contact Actions Grid */}
                <Text style={[styles.gridHeading, { color: colors.textSecondary }]}>
                  CONNECT WITH OUR CURATORS
                </Text>

                <View style={styles.contactGrid}>
                  {/* WhatsApp */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionCard,
                      {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.border,
                      },
                      pressed && styles.cardPressed,
                    ]}
                    onPress={handleWhatsApp}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: isDark ? "#163422" : "#E8F7EE" }]}>
                      <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>WhatsApp</Text>
                    <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Instant Concierge</Text>
                  </Pressable>

                  {/* Phone Call */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionCard,
                      {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.border,
                      },
                      pressed && styles.cardPressed,
                    ]}
                    onPress={handleCall}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: colors.goldSoft }]}>
                      <Ionicons name="call-outline" size={20} color={colors.gold} />
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Call Us</Text>
                    <Text style={[styles.actionSub, { color: colors.textSecondary }]}>{GALLERY_CONFIG.phone}</Text>
                  </Pressable>

                  {/* Email */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionCard,
                      {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.border,
                      },
                      pressed && styles.cardPressed,
                    ]}
                    onPress={handleEmail}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: isDark ? "#28253A" : "#ECEBF8" }]}>
                      <Ionicons name="mail-outline" size={20} color="#7C69EF" />
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Email Support</Text>
                    <Text style={[styles.actionSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {GALLERY_CONFIG.email}
                    </Text>
                  </Pressable>

                  {/* Google Maps Location */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionCard,
                      {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.border,
                      },
                      pressed && styles.cardPressed,
                    ]}
                    onPress={handleMaps}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: isDark ? "#38231E" : "#FDECE8" }]}>
                      <Ionicons name="location-outline" size={22} color="#E05638" />
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Location</Text>
                    <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Open in Google Maps</Text>
                  </Pressable>
                </View>

                {/* Additional Info / Timings */}
                <View
                  style={[
                    styles.infoRowCard,
                    {
                      backgroundColor: colors.cardAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="time-outline" size={20} color={colors.gold} />
                  <View style={styles.infoRowText}>
                    <Text style={[styles.infoRowTitle, { color: colors.text }]}>Gallery Hours</Text>
                    <Text style={[styles.infoRowSub, { color: colors.textSecondary }]}>
                      {GALLERY_CONFIG.hours}
                    </Text>
                  </View>
                </View>

                {/* Web & Instagram Links */}
                <View style={styles.linksRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.linkPill,
                      { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleWebsite}
                  >
                    <Ionicons name="globe-outline" size={15} color={colors.gold} />
                    <Text style={[styles.linkPillText, { color: colors.text }]}>Official Website</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.linkPill,
                      { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleInstagram}
                  >
                    <Ionicons name="logo-instagram" size={15} color="#E1306C" />
                    <Text style={[styles.linkPillText, { color: colors.text }]}>Instagram</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 24,
  },
  topBar: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    position: "relative",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
  },
  brandHero: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  galleryTitle: {
    fontSize: 22,
    fontFamily: FONTS.serifBold,
    letterSpacing: 0.5,
  },
  galleryTagline: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    fontStyle: "italic",
    marginTop: 3,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.3,
  },
  aboutText: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
  },
  authenticityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  authenticityText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    flex: 1,
  },
  gridHeading: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 2,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    width: "48%",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  cardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.88,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
  },
  infoRowCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoRowText: {
    flex: 1,
  },
  infoRowTitle: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    marginBottom: 3,
  },
  infoRowSub: {
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
  },
  linksRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  linkPillText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
});
