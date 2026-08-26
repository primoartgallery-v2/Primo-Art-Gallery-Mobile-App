import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  clearNotificationHistory,
  getNotificationHistory,
  getStoredPushToken,
  markAllNotificationsAsRead,
  sendLocalNotification,
  type PrimoNotificationItem,
} from "@/services/notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [items, setItems] = useState<PrimoNotificationItem[]>([]);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const list = await getNotificationHistory();
    setItems(list);
    const token = await getStoredPushToken();
    setPushToken(token);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = (item: PrimoNotificationItem) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (item.deepLink) {
      router.push(item.deepLink as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = await markAllNotificationsAsRead();
    setItems(updated);
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear Notifications",
      "Are you sure you want to clear your notification history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await clearNotificationHistory();
            setItems([]);
          },
        },
      ]
    );
  };

  // Triggers an instant live test push notification
  const handleTriggerTestPush = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    await sendLocalNotification({
      title: "🔴 Live Art Auction Dropped!",
      body: "Exclusive masterwork live bidding is now active on Primo Art Gallery. Tap to place your bid!",
      data: {
        type: "auction",
        deepLink: "/auctions",
      },
    });

    await loadNotifications();

    Alert.alert(
      "Push Notification Sent!",
      "A live high-priority notification banner has been dispatched to your notification bar. Tap it to test deep linking to the Live Auction screen!",
      [{ text: "OK" }]
    );
  };

  const unreadCount = items.filter((i) => !i.read).length;

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
          style={[
            styles.backButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
          <Text style={[styles.title, { color: colors.text }]}>VIP Alerts</Text>
        </View>

        {unreadCount > 0 ? (
          <Pressable style={styles.markReadBtn} onPress={handleMarkAllRead}>
            <Text style={[styles.markReadText, { color: colors.gold }]}>Read All</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.topSection}>
            <View style={styles.subHeaderRow}>
              <Text style={[styles.subHeaderEyebrow, { color: colors.gold }]}>
                ALL VIP ALERTS ({items.length})
              </Text>
              {items.length > 0 ? (
                <Pressable onPress={handleClearAll}>
                  <Text style={[styles.clearAllText, { color: colors.gold }]}>Clear All</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={42} color={colors.gold} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Notifications</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              You are all caught up! New live auction alerts and curated drops will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconName =
            item.type === "auction"
              ? "hammer"
              : item.type === "exhibition"
              ? "calendar"
              : item.type === "artwork"
              ? "color-palette"
              : "sparkles";

          return (
            <Pressable
              style={({ pressed }) => [
                styles.notificationCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                !item.read && { backgroundColor: colors.cardAlt, borderColor: colors.gold },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => handleNotificationPress(item)}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.goldSoft },
                  item.type === "auction" && styles.auctionIconWrap,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={item.type === "auction" ? "#E74C3C" : colors.gold}
                />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={[styles.cardText, { color: colors.textSecondary }]}>{item.body}</Text>
                <Text style={[styles.cardTime, { color: colors.textMuted }]}>{item.time}</Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF8F3" },
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
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
  },
  markReadText: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansBold,
  },
  headerSpacer: { width: 38 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },
  topSection: {
    marginBottom: 14,
  },
  testBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EADCC2",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  testBannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  testBannerTitle: {
    color: "#252525",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  testBannerSubtitle: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 15,
  },
  testPushBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#B8964E",
    alignItems: "center",
    justifyContent: "center",
  },
  testPushBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  subHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  subHeaderEyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  clearAllText: {
    color: "#8A847B",
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
  },
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  unreadCard: {
    backgroundColor: "#FDFBF7",
    borderColor: "#EADCC2",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FAF6EC",
    borderWidth: 1,
    borderColor: "#EADCC2",
    alignItems: "center",
    justifyContent: "center",
  },
  auctionIconWrap: {
    backgroundColor: "rgba(231, 76, 60, 0.12)",
    borderColor: "rgba(231, 76, 60, 0.3)",
  },
  cardBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: "#252525",
    fontSize: 13.5,
    fontFamily: FONTS.sansBold,
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#B8964E",
    marginLeft: 6,
  },
  cardText: {
    marginTop: 4,
    color: "#77736B",
    fontSize: 11.5,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
  },
  cardTime: {
    marginTop: 6,
    color: "#A8A298",
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    marginTop: 6,
    color: "#252525",
    fontSize: 18,
    fontFamily: FONTS.serifBold,
  },
  emptySubtitle: {
    color: "#77736B",
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
