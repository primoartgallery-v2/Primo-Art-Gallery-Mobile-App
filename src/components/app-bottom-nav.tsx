import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

type TabRouteName = "index" | "explore" | "auctions" | "profile";

const TAB_CONFIG: Record<
  TabRouteName,
  { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }
> = {
  index: {
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
  },
  explore: {
    label: "Explore",
    icon: "images-outline",
    activeIcon: "images",
  },
  auctions: {
    label: "Auction",
    icon: "hammer-outline",
    activeIcon: "hammer",
  },
  profile: {
    label: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
};

export const AppBottomNav = React.memo(function AppBottomNav(props?: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const bottomPadding = Math.max(insets.bottom, 8);

  if (props && props.state) {
    const { state, descriptors, navigation } = props;

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
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name as TabRouteName];
          if (!config) return null;

          const descriptor = descriptors[route.key];
          const options = descriptor ? descriptor.options : undefined;
          const label =
            options?.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options?.title !== undefined
              ? options.title
              : config.label;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={
                options?.tabBarAccessibilityLabel ||
                (typeof label === "string" ? label : config.label)
              }
            >
              <View
                style={[
                  styles.iconContainer,
                  isFocused && {
                    backgroundColor: colors.navActivePill,
                  },
                ]}
              >
                <Ionicons
                  name={isFocused ? config.activeIcon : config.icon}
                  size={20}
                  color={isFocused ? colors.navActive : colors.navInactive}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.navActive : colors.navInactive },
                  isFocused && styles.labelActive,
                ]}
              >
                {typeof label === "string" ? label : config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return null;
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

