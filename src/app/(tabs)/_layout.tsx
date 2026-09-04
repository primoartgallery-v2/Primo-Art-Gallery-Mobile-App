import { Tabs } from "expo-router";
import React from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppBottomNav {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
        }}
      />
      <Tabs.Screen
        name="auctions"
        options={{
          title: "Auction",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
