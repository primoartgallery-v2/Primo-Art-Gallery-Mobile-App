import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

const items = [
  { label: "Home", icon: "home-outline", activeIcon: "home", href: "/" },
  { label: "Explore", icon: "images-outline", activeIcon: "images", href: "/explore" },
  { label: "Auction", icon: "hammer-outline", activeIcon: "hammer", href: "/auctions" },
  { label: "Profile", icon: "person-outline", activeIcon: "person", href: "/profile" },
] as const;

export const AppBottomNav = React.memo(function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const bottomPadding = Math.max(insets.bottom, 8);

  const handleTabPress = (href: string, active: boolean) => {
    if (!active) {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      router.replace(href as any);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          backgroundColor: colors.navBackground,
          borderTopColor: colors.navBorder,
        },
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Pressable
            key={item.href}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.itemPressed,
            ]}
            onPress={() => handleTabPress(item.href, active)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <View
              style={[
                styles.iconContainer,
                active && {
                  backgroundColor: colors.navActivePill,
                },
              ]}
            >
              <Ionicons
                name={active ? (item.activeIcon as any) : (item.icon as any)}
                size={20}
                color={active ? colors.navActive : colors.navInactive}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? colors.navActive : colors.navInactive },
                active && styles.labelActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  item: {
    width: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  itemPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
  iconContainer: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: FONTS.sansMedium,
  },
  labelActive: {
    fontFamily: FONTS.sansExtraBold,
  },
});

