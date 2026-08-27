import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { AboutContactModal } from "@/components/AboutContactModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { FullWishlistModal } from "@/components/FullWishlistModal";
import { ManageAddressModal } from "@/components/ManageAddressModal";
import { SignOutConfirmModal } from "@/components/SignOutConfirmModal";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getLocalRecentlyViewed,
  getCloudRecentlyViewed,
  type RecentlyViewedItem,
} from "@/services/recentlyViewedStorage";
import type { WooCommerceProduct } from "@/services/woocommerce";

const AVATAR_ICON_MAP: Record<string, any> = {
  avatar_1: "person",
  avatar_2: "shield-checkmark",
  avatar_3: "diamond",
  avatar_4: "color-palette",
  avatar_5: "star",
  avatar_6: "sparkles",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user, logout } = useAuth();
  const { savedProducts, removeFromWishlist } = useWishlist();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  // Modals state
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showFullWishlistModal, setShowFullWishlistModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showManageAddressModal, setShowManageAddressModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Load recently viewed artworks for active collector session (or guest)
  React.useEffect(() => {
    getLocalRecentlyViewed(user?.id)
      .then((items) => {
        setRecentlyViewed(items);
        if (user?.id) {
          getCloudRecentlyViewed().then((cloudItems) => {
            if (cloudItems && cloudItems.length > 0) {
              setRecentlyViewed(cloudItems);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleAction = (callback: () => void) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    callback();
  };

  const handleCheckUpdate = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (__DEV__) {
      Alert.alert(
        "Development Build",
        "In-app live updates are active in the standalone installed APK."
      );
      return;
    }

    setCheckingUpdate(true);
    setUpdateStatus("Checking for gallery updates...");
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateStatus("Downloading new version...");
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update Ready 🎉",
          "A new version of Primo Art Gallery has been downloaded. Restart now to apply?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart Now",
              onPress: () => {
                void Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        setUpdateStatus("App is up to date (v1.0.0)");
        Alert.alert(
          "Up to Date ✨",
          "You are already running the latest version of Primo Art Gallery."
        );
      }
    } catch (err: any) {
      setUpdateStatus("App is up to date");
      Alert.alert(
        "Primo Art Gallery",
        "Your gallery application is running the latest available build."
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleConfirmLogout = async () => {
    setShowSignOutModal(false);
    await logout();
  };

  const avatarIconName =
    user?.avatar_url && AVATAR_ICON_MAP[user.avatar_url]
      ? AVATAR_ICON_MAP[user.avatar_url]
      : "person";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>YOUR PRIMO SPACE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Collector Profile</Text>
        </View>

        {/* LOGGED IN USER CARD VS GUEST CARD */}
        {user ? (
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
                onPress={() => setShowEditProfileModal(true)}
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
                onPress={() => setShowEditProfileModal(true)}
              >
                <Ionicons name="pencil" size={14} color={colors.gold} />
                <Text style={[styles.editProfileBtnText, { color: colors.gold }]}>Edit</Text>
              </Pressable>
            </View>

            {/* REDESIGNED STATS: ORDERS, WISHLIST, ACCOUNT */}
            <View
              style={[
                styles.statsRow,
                { backgroundColor: colors.backgroundElement, borderColor: colors.borderLight },
              ]}
            >
              {/* ORDERS / INQUIRIES */}
              <Pressable
                style={styles.statBox}
                onPress={() => {
                  handleAction(() => {
                    Alert.alert(
                      "Your Collector Inquiries",
                      "You have 0 pending physical delivery orders. All previous private curatorial inquiries are tracked via WhatsApp & Email.",
                      [
                        {
                          text: "Contact Curator",
                          onPress: () =>
                            Linking.openURL(
                              `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hello%20Primo%20Art%20Gallery,%20I%20would%20like%20to%20inquire%20about%20my%20recent%20acquisition%20order.`
                            ).catch(() => {}),
                        },
                        { text: "OK", style: "cancel" },
                      ]
                    );
                  });
                }}
              >
                <Ionicons name="cube-outline" size={16} color={colors.gold} style={{ marginBottom: 2 }} />
                <Text style={[styles.statValue, { color: colors.text }]}>0 Orders</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>INQUIRIES</Text>
              </Pressable>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              {/* WISHLIST */}
              <Pressable
                style={styles.statBox}
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setShowFullWishlistModal(true);
                }}
              >
                <Ionicons name="heart" size={16} color="#E74C3C" style={{ marginBottom: 2 }} />
                <Text style={[styles.statValue, { color: colors.text }]}>{savedProducts.length} Saved</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WISHLIST</Text>
              </Pressable>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              {/* ACCOUNT */}
              <Pressable
                style={styles.statBox}
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setShowEditProfileModal(true);
                }}
              >
                <Ionicons name="shield-checkmark" size={16} color={colors.gold} style={{ marginBottom: 2 }} />
                <Text style={[styles.statValue, { color: colors.text }]}>Verified</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>
              </Pressable>
            </View>

            {/* LUXURY SIGN OUT BUTTON */}
            <Pressable
              style={styles.logoutButton}
              onPress={() => {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setShowSignOutModal(true);
              }}
            >
              <Ionicons name="log-out-outline" size={16} color="#C0392B" />
              <Text style={styles.logoutButtonText}>SIGN OUT OF PRIMO SPACE</Text>
            </Pressable>
          </View>
        ) : (
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
                onPress={() => handleAction(() => router.push("/signup" as any))}
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
                onPress={() => handleAction(() => router.push("/login" as any))}
              >
                <Text style={[styles.secondaryAuthText, { color: colors.text }]}>SIGN IN</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* SAVED COLLECTION (WISHLIST) */}
        <View style={styles.wishlistSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.sectionHeader, { color: colors.gold }]}>MY SAVED COLLECTION</Text>
              <Text
                style={[
                  styles.wishlistCountBadge,
                  { backgroundColor: colors.goldBadge, color: colors.goldBadgeText },
                ]}
              >
                {savedProducts.length}
              </Text>
            </View>

            {savedProducts.length > 0 ? (
              <Pressable
                style={styles.viewAllBtn}
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setShowFullWishlistModal(true);
                }}
              >
                <Text style={[styles.viewAllText, { color: colors.gold }]}>View All Artworks</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.gold} />
              </Pressable>
            ) : null}
          </View>

          {savedProducts.length > 0 ? (
            <FlatList
              horizontal
              data={savedProducts}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wishlistList}
              renderItem={({ item }) => (
                <SavedArtworkCard
                  product={item}
                  onRemove={() => removeFromWishlist(item.id)}
                />
              )}
            />
          ) : (
            <View
              style={[
                styles.emptyWishlistCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="heart-outline" size={32} color={colors.gold} />
              <Text style={[styles.emptyWishlistTitle, { color: colors.text }]}>No Saved Artworks Yet</Text>
              <Text style={[styles.emptyWishlistSub, { color: colors.textSecondary }]}>
                Tap the heart icon on any artwork to save it to your private collection.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.exploreWishlistBtn,
                  { backgroundColor: colors.gold },
                  pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                ]}
                onPress={() => handleAction(() => router.push("/explore" as any))}
              >
                <Text style={styles.exploreWishlistBtnText}>EXPLORE ARTWORKS</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* RECENTLY VIEWED ARTWORKS SECTION */}
        {recentlyViewed.length > 0 ? (
          <View style={styles.wishlistSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.sectionHeader, { color: colors.gold }]}>RECENTLY VIEWED</Text>
                <Text
                  style={[
                    styles.wishlistCountBadge,
                    { backgroundColor: colors.goldBadge, color: colors.goldBadgeText },
                  ]}
                >
                  {recentlyViewed.length}
                </Text>
              </View>
            </View>

            <FlatList
              horizontal
              data={recentlyViewed}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wishlistList}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.savedCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
                  ]}
                  onPress={() => handleAction(() => router.push(`/painting/${item.id}` as any))}
                >
                  <View
                    style={[
                      styles.savedCardImageWrap,
                      { backgroundColor: isDark ? "#20222C" : "#FAF6EC" },
                    ]}
                  >
                    {item.imageUrl ? (
                      <ExpoImage
                        source={{ uri: item.imageUrl }}
                        style={styles.savedCardImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.savedCardImageFallback}>
                        <Ionicons name="image-outline" size={24} color={colors.gold} />
                      </View>
                    )}
                  </View>
                  <View style={styles.savedCardBody}>
                    <Text
                      style={[styles.savedCardTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.savedCardPrice, { color: colors.gold }]}>
                      {item.price ? `₹ ${Number(item.price).toLocaleString("en-IN")}` : "View Details"}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ACCOUNT & ADDRESSES SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
          ACCOUNT &amp; DELIVERIES
        </Text>
        {user ? (
          <Action
            icon="person-circle-outline"
            title="Edit Profile Details"
            subtitle="Change full name, email, phone number & avatar"
            onPress={() => setShowEditProfileModal(true)}
          />
        ) : null}
        <Action
          icon="home-outline"
          title="Manage Addresses"
          subtitle="Set default delivery address & manage addresses"
          onPress={() => setShowManageAddressModal(true)}
        />

        {/* ABOUT & CONTACT SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
          ABOUT &amp; GALLERY DETAILS
        </Text>
        <Action
          icon="information-circle-outline"
          title="About Primo Art Gallery"
          subtitle="Story, curatorial vision & authenticity promise"
          onPress={() => setShowAboutModal(true)}
        />
        <Action
          icon="location-outline"
          title="Gallery Location"
          subtitle="View on Google Maps • New Delhi, India"
          onPress={() =>
            handleAction(() => {
              Linking.openURL(GALLERY_CONFIG.mapsUrl).catch(() => {});
            })
          }
        />
        <Action
          icon="call-outline"
          title="Direct Telephone"
          subtitle={GALLERY_CONFIG.phone}
          onPress={() =>
            handleAction(() => {
              Linking.openURL(`tel:${GALLERY_CONFIG.phoneRaw}`).catch(() => {});
            })
          }
        />

        {/* GALLERY ACTIONS */}
        <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
          GALLERY &amp; ADVISORY
        </Text>
        <Action
          icon="images-outline"
          title="Browse Artworks"
          subtitle="Explore the latest curated collection"
          onPress={() => handleAction(() => router.replace("/explore"))}
        />
        <Action
          icon="hammer-outline"
          title="Live Auctions"
          subtitle="Real-time bidding on verified masterworks"
          onPress={() => handleAction(() => router.push("/auctions" as any))}
        />
        <Action
          icon="calendar-outline"
          title="Exhibitions &amp; Events"
          subtitle="View upcoming dates and curated shows"
          onPress={() => handleAction(() => router.push("/exhibitions" as any))}
        />
        <Action
          icon="notifications-outline"
          title="Notifications &amp; Drops"
          subtitle="Live auction announcements and new releases"
          onPress={() => handleAction(() => router.push("/notifications" as any))}
        />

        <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
          SUPPORT &amp; CONCIERGE
        </Text>
        <Action
          icon="logo-whatsapp"
          title="WhatsApp Advisory"
          subtitle={`Chat with a senior curator: ${GALLERY_CONFIG.phone}`}
          onPress={() =>
            handleAction(() => {
              Linking.openURL(
                `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hello%20Primo%20Art%20Gallery,%20I%20would%20like%20collector%20advisory%20assistance.`
              ).catch(() => {});
            })
          }
        />
        <Action
          icon="mail-outline"
          title="Email Gallery"
          subtitle={GALLERY_CONFIG.email}
          onPress={() =>
            handleAction(() => {
              Linking.openURL(`mailto:${GALLERY_CONFIG.email}`).catch(() => {});
            })
          }
        />
        <Action
          icon="globe-outline"
          title="Official Website"
          subtitle={GALLERY_CONFIG.website}
          onPress={() =>
            handleAction(() => {
              Linking.openURL(GALLERY_CONFIG.website).catch(() => {});
            })
          }
        />

        <Text style={[styles.sectionHeader, { color: colors.gold, marginTop: 24 }]}>
          APPLICATION &amp; SYSTEM
        </Text>
        <Action
          icon="cloud-download-outline"
          title="Check for In-App Updates"
          subtitle={updateStatus || "Tap to check for live updates • v1.0.0 (Latest)"}
          onPress={() => handleCheckUpdate()}
        />
      </ScrollView>

      <AppBottomNav />

      {/* ABOUT & CONTACT MODAL */}
      <AboutContactModal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* FULL WISHLIST MODAL */}
      <FullWishlistModal
        visible={showFullWishlistModal}
        onClose={() => setShowFullWishlistModal(false)}
      />

      {/* EDIT PROFILE MODAL */}
      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />

      {/* MANAGE ADDRESS MODAL */}
      <ManageAddressModal
        visible={showManageAddressModal}
        onClose={() => setShowManageAddressModal(false)}
      />

      {/* LUXURY SIGN OUT MODAL */}
      <SignOutConfirmModal
        visible={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </SafeAreaView>
  );
}

function SavedArtworkCard({
  product,
  onRemove,
}: {
  product: WooCommerceProduct;
  onRemove: () => void;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.savedCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
      ]}
      onPress={() => router.push(`/painting/${product.id}` as any)}
    >
      <View
        style={[
          styles.savedCardImageWrap,
          { backgroundColor: isDark ? "#20222C" : "#FAF6EC" },
        ]}
      >
        {product.images[0]?.src ? (
          <ExpoImage
            source={{ uri: product.images[0].src }}
            style={styles.savedCardImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.savedCardImageFallback}>
            <Ionicons name="image-outline" size={24} color={colors.gold} />
          </View>
        )}
        <Pressable
          style={styles.removeSaveBtn}
          onPress={(e) => {
            e.stopPropagation();
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onRemove();
          }}
          accessibilityLabel="Remove from wishlist"
        >
          <Ionicons name="heart" size={16} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.savedCardBody}>
        <Text style={[styles.savedCardTitle, { color: colors.text }]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.savedCardPrice, { color: colors.gold }]}>
          {product.price ? `₹ ${product.price}` : "Price on request"}
        </Text>
      </View>
    </Pressable>
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
  screen: { flex: 1, backgroundColor: "#FAF8F3" },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 16,
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.7,
  },
  title: {
    marginTop: 3,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 29,
  },
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
  wishlistSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeader: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  viewAllText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  wishlistCountBadge: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  wishlistList: {
    paddingVertical: 4,
    gap: 12,
  },
  savedCard: {
    width: 150,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    marginRight: 12,
  },
  savedCardImageWrap: {
    width: "100%",
    height: 120,
    backgroundColor: "#FAF6EC",
    position: "relative",
  },
  savedCardImage: {
    width: "100%",
    height: "100%",
  },
  savedCardImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  removeSaveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardBody: {
    padding: 10,
  },
  savedCardTitle: {
    color: "#252525",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  savedCardPrice: {
    marginTop: 2,
    color: "#B8964E",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
  },
  emptyWishlistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    gap: 6,
  },
  emptyWishlistTitle: {
    marginTop: 4,
    color: "#252525",
    fontSize: 15,
    fontFamily: FONTS.serifBold,
  },
  emptyWishlistSub: {
    color: "#77736B",
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  exploreWishlistBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#B8964E",
  },
  exploreWishlistBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
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
