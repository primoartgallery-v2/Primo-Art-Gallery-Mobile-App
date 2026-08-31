import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
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
import {
  EXHIBITION_REGISTRATION_URL,
  getExhibitions,
  type Exhibition,
} from "@/services/exhibitions";

export default function ExhibitionsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getExhibitions();
      setExhibitions(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to load exhibitions."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRegistrationForm = (exhibition?: Exhibition) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const targetUrl =
      exhibition?.registrationUrl || EXHIBITION_REGISTRATION_URL;
    Linking.openURL(targetUrl).catch(() => {});
  };

  const openVenueMap = (venue: string, city: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const query = encodeURIComponent(`${venue}, ${city}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(
      () => {}
    );
  };

  const openWhatsAppExhibitionConcierge = (exhibition?: Exhibition) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const title = exhibition?.title || "The Emerging Perspectives";
    const msg = `Hello Primo Art Gallery, I would like VIP curator registration & private passes for "${title}" at India Habitat Centre.`;
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
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
          <Text style={[styles.title, { color: colors.text }]}>Exhibitions</Text>
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Curating gallery exhibitions…</Text>
        </View>
      ) : errorMessage && exhibitions.length === 0 ? (
        <View style={[styles.stateContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.gold} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Exhibitions Unavailable</Text>
          <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>{errorMessage}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.gold }]} onPress={load}>
            <Text style={styles.retryButtonText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : exhibitions.length === 0 ? (
        <View style={styles.stateContainer}>
          <Ionicons name="calendar-outline" size={42} color="#B8964E" />
          <Text style={styles.stateTitle}>No Upcoming Exhibitions</Text>
          <Text style={styles.stateSubtitle}>
            New exhibition dates and events will be announced soon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={exhibitions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View
              style={[
                styles.topAnnouncementBanner,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <View style={[styles.announcementDot, { backgroundColor: colors.gold }]} />
              <Text style={[styles.announcementText, { color: colors.gold }]}>
                COMPLIMENTARY ENTRY • ADVANCE REGISTRATION OPEN
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.exhibitionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* POSTER IMAGE */}
              {item.imageUrl ? (
                <View style={styles.imageContainer}>
                  <ExpoImage
                    source={{ uri: item.imageUrl }}
                    style={styles.image}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.badgeRow}>
                    <View style={[styles.statusBadge, { backgroundColor: colors.gold }]}>
                      <Text style={styles.statusBadgeText}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.entryBadge}>
                      <Text style={styles.entryBadgeText}>{item.entry}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* CARD DETAILS */}
              <View style={styles.cardBody}>
                <Text style={[styles.cardEyebrow, { color: colors.gold }]}>FEATURED GROUP SHOWCASE</Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                ) : null}

                {/* INFO GRID */}
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
                  ]}
                >
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar" size={17} color={colors.gold} />
                    <Text style={[styles.infoText, { color: colors.text }]}>{item.dates}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={17} color={colors.gold} />
                    <Text style={[styles.infoText, { color: colors.text }]}>{item.timings}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="location" size={17} color={colors.gold} />
                    <Text style={[styles.infoText, { color: colors.text }]}>
                      {item.venue}, {item.city}
                    </Text>
                  </View>
                </View>

                {/* DESCRIPTION */}
                <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{item.description}</Text>

                {/* PRIMARY ACTION: DIRECT GOOGLE FORM REGISTRATION */}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryRegisterButton,
                    { backgroundColor: colors.gold },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => openRegistrationForm(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Register for exhibition"
                >
                  <Ionicons name="ticket" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryRegisterButtonText}>
                    REGISTER / RSVP FOR FREE PASS
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>

                <Text style={[styles.registerFootnote, { color: colors.textMuted }]}>
                  Official entry pass &amp; QR code issued via Google Form
                </Text>

                {/* SECONDARY ACTION BUTTONS */}
                <View style={styles.secondaryButtonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.outlineButton,
                      { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => openVenueMap(item.venue, item.city)}
                  >
                    <Ionicons name="navigate-outline" size={16} color={colors.text} />
                    <Text style={[styles.outlineButtonText, { color: colors.text }]}>MAP DIRECTIONS</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.whatsappButton,
                      { backgroundColor: "#25D366" },
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => openWhatsAppExhibitionConcierge(item)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                    <Text style={styles.whatsappButtonText}>VIP PASS</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}

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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE0",
    backgroundColor: "#FAF8F3",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  headerCenter: {
    alignItems: "center",
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 2,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 24,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 110,
  },
  topAnnouncementBanner: {
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EADCC2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
  },
  announcementDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#B8964E",
  },
  announcementText: {
    color: "#B8964E",
    fontSize: 9.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.9,
  },
  exhibitionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  imageContainer: {
    height: 250,
    width: "100%",
    backgroundColor: "#252525",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badgeRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusBadge: {
    backgroundColor: "#B8964E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  entryBadge: {
    backgroundColor: "rgba(23, 32, 42, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  entryBadgeText: {
    color: "#E9D9B4",
    fontSize: 9,
    fontFamily: FONTS.sansBold,
  },
  cardBody: {
    padding: 20,
  },
  cardEyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  cardTitle: {
    marginTop: 6,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 32,
  },
  cardSubtitle: {
    marginTop: 4,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.serifItalic,
  },
  infoBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8F5EE",
    gap: 9,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  infoText: {
    color: "#252525",
    fontSize: 12,
    fontFamily: FONTS.sansSemiBold,
    flex: 1,
  },
  descriptionText: {
    marginTop: 16,
    color: "#6B655B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 21,
  },
  primaryRegisterButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#B8964E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#B8964E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryRegisterButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  registerFootnote: {
    marginTop: 8,
    color: "#8A847B",
    fontSize: 10,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  secondaryButtonRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  outlineButton: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#DCD5C8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outlineButtonText: {
    color: "#252525",
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.8,
  },
  whatsappButton: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  whatsappButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  loadingText: {
    marginTop: 12,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 80,
  },
  stateTitle: {
    marginTop: 14,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 22,
  },
  stateSubtitle: {
    marginTop: 6,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#B8964E",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
});
