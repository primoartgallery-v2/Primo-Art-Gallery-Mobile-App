import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ExitConfirmModal } from "@/components/ExitConfirmModal";
import { AuthProvider } from "@/context/AuthContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { registerForPushNotificationsAsync } from "@/services/notifications";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const [showExitModal, setShowExitModal] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Check for OTA Updates in the background (downloads for next launch without abrupt startup crash)
  useEffect(() => {
    async function checkAppUpdates() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          // Downloaded in background for next launch
        }
      } catch (err) {
        console.log("OTA update check info:", err);
      }
    }
    void checkAppUpdates();
  }, []);

  // Push notifications listener & deep-linking
  useEffect(() => {
    void registerForPushNotificationsAsync();

    // Foreground listener
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Foreground notification received:", notification.request.content.title);
      });

    // Tap/Response listener for Deep-Linking
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.deepLink) {
          console.log("Deep-linking to:", data.deepLink);
          router.push(data.deepLink as any);
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  // Intelligent Android Back Handler
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onBackPress = () => {
      // If Exit modal is already open, close it
      if (showExitModal) {
        setShowExitModal(false);
        return true;
      }

      // If user is on the Home screen, trigger the bottom exit confirmation modal
      if (pathname === "/" || pathname === "/index" || !pathname) {
        setShowExitModal(true);
        return true;
      }

      // If user is on top level tabs (Explore, Auctions, Profile)
      if (pathname === "/explore" || pathname === "/auctions" || pathname === "/profile") {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
        return true;
      }

      // If user is on any inner subpage (Painting Details, Artists, Exhibitions, Notifications, Auth, etc.)
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => {
      backSubscription.remove();
    };
  }, [pathname, showExitModal, router]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colorScheme === "dark" ? "#0D0E12" : "#FAF8F5"}
      />
      <AuthProvider>
        <WishlistProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="explore" />
              <Stack.Screen name="auctions" />
              <Stack.Screen name="exhibitions" />
              <Stack.Screen
                name="artists"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen name="profile" />
              <Stack.Screen
                name="signup"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="login"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="verify-otp"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="forgot-password"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="notifications"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="painting/[id]"
                options={{ animation: "fade_from_bottom" }}
              />
            </Stack>

            {/* Bottom Exit Confirmation Popup */}
            <ExitConfirmModal
              visible={showExitModal}
              onClose={() => setShowExitModal(false)}
            />
          </GestureHandlerRootView>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

