import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PUSH_TOKEN_KEY = "@primo_push_token";
const NOTIFICATIONS_STORE_KEY = "@primo_notifications_list";

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
    shouldShowBanner: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export type PrimoNotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "auction" | "artwork" | "exhibition" | "general";
  deepLink?: string;
  data?: Record<string, any>;
};

/**
 * Registers device for push notifications and returns the Expo push token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("primo-art-gallery", {
      name: "Primo Art Gallery VIP Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#B8964E",
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permissions not granted.");
      return null;
    }

    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync();
      token = pushTokenData.data;
      console.log("Registered Expo Push Token:", token);
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    } catch (error) {
      console.log("Error obtaining push token (may require projectId in app.json for remote push):", error);
    }
  } else {
    console.log("Push notifications require a physical device for remote push.");
  }

  return token;
}

/**
 * Retrieves the stored Expo Push Token.
 */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Dispatches an instant local push notification.
 */
export async function sendLocalNotification({
  title,
  body,
  data = {},
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      color: "#B8964E",
    },
    trigger: null, // trigger immediately
  });

  // Store in in-app notification history
  const newItem: PrimoNotificationItem = {
    id: String(Date.now()),
    title,
    body,
    time: "Just now",
    read: false,
    type: data.type || "general",
    deepLink: data.deepLink,
    data,
  };

  await appendNotificationHistory(newItem);
}

/**
 * Appends a notification item to in-app notification center.
 */
export async function appendNotificationHistory(item: PrimoNotificationItem) {
  try {
    const existing = await getNotificationHistory();
    const updated = [item, ...existing];
    await AsyncStorage.setItem(NOTIFICATIONS_STORE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to append notification history:", err);
  }
}

/**
 * Gets all saved in-app notifications.
 */
export async function getNotificationHistory(): Promise<PrimoNotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORE_KEY);
    if (!raw) return getDefaultNotifications();
    return JSON.parse(raw);
  } catch {
    return getDefaultNotifications();
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllNotificationsAsRead(): Promise<PrimoNotificationItem[]> {
  const list = await getNotificationHistory();
  const updated = list.map((n) => ({ ...n, read: true }));
  await AsyncStorage.setItem(NOTIFICATIONS_STORE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Clears all notification history.
 */
export async function clearNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(NOTIFICATIONS_STORE_KEY);
}

function getDefaultNotifications(): PrimoNotificationItem[] {
  return [
    {
      id: "1",
      title: "🔴 Live Art Auction is Active",
      body: "Exclusive bidding is open for curated contemporary masterworks. Tap to explore lots & bid.",
      time: "2 hours ago",
      read: false,
      type: "auction",
      deepLink: "/auctions",
    },
    {
      id: "2",
      title: "🎨 Curated Art Collection Dropped",
      body: "Discover original handmade paintings curated from verified master artists.",
      time: "Yesterday",
      read: false,
      type: "artwork",
      deepLink: "/explore",
    },
    {
      id: "3",
      title: "🏛️ Free Passes Open: India Habitat Centre",
      body: "The Emerging Perspectives exhibition opens 27–30 Sept. Register your complimentary guest pass.",
      time: "3 days ago",
      read: true,
      type: "exhibition",
      deepLink: "/exhibitions",
    },
    {
      id: "4",
      title: "✨ Welcome to Primo Art Gallery",
      body: "Your private gallery concierge and certificate of authenticity are ready.",
      time: "5 days ago",
      read: true,
      type: "general",
      deepLink: "/explore",
    },
  ];
}
