import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { PrimoCollectorUser } from "@/services/auth";

export type ProfileActionsListProps = {
  user: PrimoCollectorUser | null;
  exhibitionPassesCount: number;
  bidsCount: number;
  enquiriesCount: number;
  updateStatus: string | null;
  onEditProfile: () => void;
  onManageAddresses: () => void;
  onOpenCoaVault: () => void;
  onOpenPasses: () => void;
  onOpenBids: () => void;
  onOpenInquiries: () => void;
  onOpenAbout: () => void;
  onOpenLocation: () => void;
  onCallPhone: () => void;
  onBrowseArtworks: () => void;
  onOpenAuctions: () => void;
  onOpenExhibitions: () => void;
  onOpenNotifications: () => void;
  onOpenWhatsApp: () => void;
  onSendEmail: () => void;
  onOpenWebsite: () => void;
  onCheckUpdates: () => void;
};

export function ProfileActionsList({
  user,
  exhibitionPassesCount,
  bidsCount,
  enquiriesCount,
  updateStatus,
  onEditProfile,
  onManageAddresses,
  onOpenCoaVault,
  onOpenPasses,
  onOpenBids,
  onOpenInquiries,
  onOpenAbout,
  onOpenLocation,
  onCallPhone,
  onBrowseArtworks,
  onOpenAuctions,
  onOpenExhibitions,
  onOpenNotifications,
  onOpenWhatsApp,
  onSendEmail,
  onOpenWebsite,
  onCheckUpdates,
}: ProfileActionsListProps) {
  const { colors } = useAppTheme();

  return (
    <>
      {/* ACCOUNT & ADDRESSES SECTION */}
      <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
        ACCOUNT &amp; DELIVERIES
      </Text>
      {user ? (
        <Action
          icon="person-circle-outline"
          title="Edit Profile Details"
          subtitle="Change full name, email, phone number & avatar"
          onPress={onEditProfile}
        />
      ) : null}
      <Action
        icon="home-outline"
        title="Manage Addresses"
        subtitle="Set default delivery address & manage addresses"
        onPress={onManageAddresses}
      />
      <Action
        icon="ribbon-outline"
        title="Certificate of Authenticity Vault"
        subtitle="Inspect official cryptographic provenance & curatorial records"
        onPress={onOpenCoaVault}
      />
      <Action
        icon="ticket-outline"
        title="VIP Exhibition Passes"
        subtitle={
          exhibitionPassesCount > 0
            ? `${exhibitionPassesCount} Confirmed Pass(es) • Tap to view & present`
            : "View confirmed exhibition RSVP guest passes"
        }
        onPress={onOpenPasses}
      />
      <Action
        icon="hammer-outline"
        title="My Auction Bids"
        subtitle={
          bidsCount > 0
            ? `${bidsCount} Active VIP Bid(s) • Tap to view live catalogue`
            : "View your active and past live auction bids"
        }
        onPress={onOpenBids}
      />
      <Action
        icon="cube-outline"
        title="Acquisition Inquiries"
        subtitle={
          enquiriesCount > 0
            ? `${enquiriesCount} Active Dossier(s) • Tap to view curatorial inquiries`
            : "View your artwork acquisition dossiers and curatorial requests"
        }
        onPress={onOpenInquiries}
      />

      {/* ABOUT & CONTACT SECTION */}
      <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
        ABOUT &amp; GALLERY DETAILS
      </Text>
      <Action
        icon="information-circle-outline"
        title="About Primo Art Gallery"
        subtitle="Story, curatorial vision & authenticity promise"
        onPress={onOpenAbout}
      />
      <Action
        icon="location-outline"
        title="Gallery Location"
        subtitle="View on Google Maps • New Delhi, India"
        onPress={onOpenLocation}
      />
      <Action
        icon="call-outline"
        title="Direct Telephone"
        subtitle={GALLERY_CONFIG.phone}
        onPress={onCallPhone}
      />

      {/* GALLERY ACTIONS */}
      <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
        GALLERY &amp; ADVISORY
      </Text>
      <Action
        icon="images-outline"
        title="Browse Artworks"
        subtitle="Explore the latest curated collection"
        onPress={onBrowseArtworks}
      />
      <Action
        icon="hammer-outline"
        title="Live Auctions"
        subtitle="Real-time bidding on verified masterworks"
        onPress={onOpenAuctions}
      />
      <Action
        icon="calendar-outline"
        title="Exhibitions &amp; Events"
        subtitle="View upcoming dates and curated shows"
        onPress={onOpenExhibitions}
      />
      <Action
        icon="notifications-outline"
        title="Notifications &amp; Drops"
        subtitle="Live auction announcements and new releases"
        onPress={onOpenNotifications}
      />

      {/* SUPPORT & CONCIERGE */}
      <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
        SUPPORT &amp; CONCIERGE
      </Text>
      <Action
        icon="logo-whatsapp"
        title="WhatsApp Advisory"
        subtitle={`Chat with a senior curator: ${GALLERY_CONFIG.phone}`}
        onPress={onOpenWhatsApp}
      />
      <Action
        icon="mail-outline"
        title="Email Gallery"
        subtitle={GALLERY_CONFIG.email}
        onPress={onSendEmail}
      />
      <Action
        icon="globe-outline"
        title="Official Website"
        subtitle={GALLERY_CONFIG.website}
        onPress={onOpenWebsite}
      />

      {/* APPLICATION & SYSTEM */}
      <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
        APPLICATION &amp; SYSTEM
      </Text>
      <Action
        icon="cloud-download-outline"
        title="Check for In-App Updates"
        subtitle={updateStatus || "Tap to check for live updates • v1.0.0 (Latest)"}
        onPress={onCheckUpdates}
      />
    </>
  );
}

function Action({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.actionIcon,
          { backgroundColor: isDark ? "#282315" : "#FAF6EC", borderColor: colors.border },
        ]}
      >
        <Ionicons name={icon} size={22} color={colors.gold} />
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FAF6EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionTextContainer: { flex: 1 },
  actionTitle: {
    color: "#252525",
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  actionSubtitle: {
    marginTop: 2,
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
  },
});
