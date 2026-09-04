import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { PrimoCollectorUser } from "@/services/auth";

const AVATAR_ICON_MAP: Record<string, any> = {
  avatar_1: "person",
  avatar_2: "shield-checkmark",
  avatar_3: "diamond",
  avatar_4: "color-palette",
  avatar_5: "star",
  avatar_6: "sparkles",
};

export type ProfileHeaderCardProps = {
  user: PrimoCollectorUser | null;
  enquiriesCount: number;
  enquiriesLoading: boolean;
  wishlistCount: number;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenInquiries: () => void;
  onOpenWishlist: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
};

export function ProfileHeaderCard({
  user,
  enquiriesCount,
  enquiriesLoading,
  wishlistCount,
  onEditProfile,
  onSignOut,
  onOpenInquiries,
  onOpenWishlist,
  onCreateAccount,
  onSignIn,
}: ProfileHeaderCardProps) {
  const { colors, isDark } = useAppTheme();

  if (!user) {
    return (
      <>
        {/* GUEST WELCOME CARD */}
        <View
          style={[
            styles.welcomeCard,
            { backgroundColor: isDark ? "#171822" : "#17202A", borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.goldSoft }]}>
            <Ionicons name="person-outline" size={28} color={colors.gold} />
          </View>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeTitle}>Join Primo Collectors</Text>
            <Text style={styles.welcomeText}>
              Create an account or sign in to sync with Primo Art Gallery, save artworks, and access private previews.
            </Text>
          </View>
        </View>

        {/* AUTH BUTTONS */}
        <View style={styles.authRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryAuthButton,
              { backgroundColor: colors.gold },
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
            onPress={onCreateAccount}
          >
            <Text style={styles.primaryAuthText}>CREATE ACCOUNT</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryAuthButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
            onPress={onSignIn}
          >
            <Text style={[styles.secondaryAuthText, { color: colors.text }]}>SIGN IN</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const avatarIconName =
    user.avatar_url && AVATAR_ICON_MAP[user.avatar_url]
      ? AVATAR_ICON_MAP[user.avatar_url]
      : "person";

  return (
    <View
      style={[
        styles.profileCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.profileHeaderRow}>
        <Pressable
          style={[
            styles.profileAvatarWrap,
            { backgroundColor: colors.goldSoft, borderColor: colors.gold },
          ]}
          onPress={onEditProfile}
        >
          <Ionicons name={avatarIconName} size={26} color={colors.gold} />
          <View style={styles.avatarEditBadge}>
            <Ionicons name="create" size={10} color="#FFFFFF" />
          </View>
        </Pressable>

        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {user.first_name || user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.username}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {user.email}
          </Text>
          {user.billing?.phone ? (
            <Text style={[styles.profilePhone, { color: colors.gold }]}>
              📞 {user.billing.phone}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.editProfileBtn,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}
          onPress={onEditProfile}
        >
          <Ionicons name="pencil" size={14} color={colors.gold} />
          <Text style={[styles.editProfileBtnText, { color: colors.gold }]}>Edit</Text>
        </Pressable>
      </View>

      {/* STATS: ORDERS/INQUIRIES, WISHLIST, ACCOUNT */}
      <View
        style={[
          styles.statsRow,
          { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
        ]}
      >
        {/* ORDERS / INQUIRIES */}
        <Pressable style={styles.statBox} onPress={onOpenInquiries}>
          <Ionicons name="cube-outline" size={16} color={colors.gold} style={{ marginBottom: 2 }} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {enquiriesLoading && enquiriesCount === 0
              ? "Loading..."
              : `${enquiriesCount} ${enquiriesCount === 1 ? "Enquiry" : "Enquiries"}`}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>INQUIRIES</Text>
        </Pressable>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        {/* WISHLIST */}
        <Pressable style={styles.statBox} onPress={onOpenWishlist}>
          <Ionicons name="heart" size={16} color="#E74C3C" style={{ marginBottom: 2 }} />
          <Text style={[styles.statValue, { color: colors.text }]}>{wishlistCount} Saved</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WISHLIST</Text>
        </Pressable>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        {/* ACCOUNT */}
        <Pressable style={styles.statBox} onPress={onEditProfile}>
          <Ionicons name="shield-checkmark" size={16} color={colors.gold} style={{ marginBottom: 2 }} />
          <Text style={[styles.statValue, { color: colors.text }]}>Verified</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>
        </Pressable>
      </View>

      {/* SIGN OUT BUTTON */}
      <Pressable style={styles.logoutButton} onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={16} color="#C0392B" />
        <Text style={styles.logoutButtonText}>SIGN OUT OF PRIMO SPACE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: "#17202A",
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2C3E50",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2C3E50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#B8964E",
    position: "relative",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#B8964E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: "#FFFFFF",
    fontFamily: FONTS.serifBold,
    fontSize: 20,
  },
  profileEmail: {
    marginTop: 2,
    color: "#D3CABE",
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
  profilePhone: {
    marginTop: 2,
    color: "#B8964E",
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
  },
  editProfileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  statsRow: {
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statBox: {
    alignItems: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.sansBold,
  },
  statLabel: {
    marginTop: 2,
    color: "#8A847B",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(192, 57, 43, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(192, 57, 43, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  logoutButtonText: {
    color: "#E74C3C",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  welcomeCard: {
    backgroundColor: "#17202A",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2C3E50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B8964E",
  },
  welcomeCopy: { flex: 1 },
  welcomeTitle: {
    color: "#FFFFFF",
    fontFamily: FONTS.serifBold,
    fontSize: 18,
  },
  welcomeText: {
    marginTop: 3,
    color: "#D3CABE",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    lineHeight: 16,
  },
  authRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  primaryAuthButton: {
    flex: 1.2,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#B8964E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryAuthText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  secondaryAuthButton: {
    flex: 0.8,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryAuthText: {
    color: "#252525",
    fontSize: 10.5,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.8,
  },
});
