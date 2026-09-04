import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useCallback, useState } from "react";
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

import { AboutContactModal } from "@/components/AboutContactModal";
import { AcquisitionInquiriesModal } from "@/components/AcquisitionInquiriesModal";
import { CertificateOfAuthenticityModal } from "@/components/CertificateOfAuthenticityModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { ExhibitionRsvpModal } from "@/components/ExhibitionRsvpModal";
import { FullWishlistModal } from "@/components/FullWishlistModal";
import { ManageAddressModal } from "@/components/ManageAddressModal";
import { ProfileActionsList } from "@/components/profile/ProfileActionsList";
import { ProfileHeaderCard } from "@/components/profile/ProfileHeaderCard";
import { ProfileWishlistSection } from "@/components/profile/ProfileWishlistSection";
import { SignOutConfirmModal } from "@/components/SignOutConfirmModal";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getCollectorCloudBids,
  getLocalBids,
  type AuctionBid,
} from "@/services/auctions";
import {
  getCollectorEnquiries,
  getStoredEnquiries,
  type CollectorEnquiryItem,
} from "@/services/enquiryService";
import {
  getCloudExhibitionPasses,
  getLocalExhibitionPasses,
  type ExhibitionVipPass,
} from "@/services/exhibitionService";
import {
  getCloudRecentlyViewed,
  getLocalRecentlyViewed,
  type RecentlyViewedItem,
} from "@/services/recentlyViewedStorage";
import { onSessionExpired } from "@/services/sessionManager";

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
  const [selectedCoaArtwork, setSelectedCoaArtwork] = useState<{ id: number; title: string; artist?: string; image?: string } | null>(null);
  const [exhibitionPasses, setExhibitionPasses] = useState<ExhibitionVipPass[]>([]);
  const [selectedPassToView, setSelectedPassToView] = useState<ExhibitionVipPass | null>(null);
  const [myBids, setMyBids] = useState<AuctionBid[]>([]);
  const [myEnquiries, setMyEnquiries] = useState<CollectorEnquiryItem[]>([]);
  const [showInquiriesModal, setShowInquiriesModal] = useState(false);
  const [selectedEnquiryToView, setSelectedEnquiryToView] = useState<CollectorEnquiryItem | null>(null);
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [, setEnquiriesError] = useState<string | null>(null);
  const [, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Session expiration listener: gracefully prompts re-login if refresh token revoked
  React.useEffect(() => {
    const unsubscribe = onSessionExpired((reason) => {
      Alert.alert(
        "Session Expired",
        reason || "Your collector session has expired. Please sign in again.",
        [
          {
            text: "Sign In",
            onPress: () => {
              void logout();
              router.push("/login");
            },
          },
        ]
      );
    });
    return () => unsubscribe();
  }, [logout, router]);

  const loadEnquiries = useCallback(() => {
    if (!user?.id) {
      setMyEnquiries([]);
      setEnquiriesLoading(false);
      setEnquiriesError(null);
      return;
    }

    // 1. Immediately render cached data from user-scoped storage
    getStoredEnquiries(user.id)
      .then((cached) => {
        if (cached && cached.length > 0) {
          setMyEnquiries(cached);
        }
      })
      .catch(() => {});

    // 2. Reconcile with cloud in background
    setEnquiriesLoading(true);
    setEnquiriesError(null);
    getCollectorEnquiries(user.id)
      .then((result) => {
        if (result.success && result.enquiries) {
          setMyEnquiries(result.enquiries);
          setEnquiriesError(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        setEnquiriesLoading(false);
      });
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEnquiries();
    }, [loadEnquiries])
  );

  // Load recently viewed artworks and sync cloud collector profile, passes, and auction bids
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

    // Sync VIP Exhibition Passes
    if (user?.id) {
      getLocalExhibitionPasses(user.id).then(setExhibitionPasses);
      getCloudExhibitionPasses().then((passes) => {
        if (passes && passes.length > 0) {
          setExhibitionPasses(passes);
        }
      }).catch(() => {});
    } else {
      setExhibitionPasses([]);
    }

    // Sync Auction Bids
    if (user?.id) {
      getLocalBids(user.id).then(setMyBids);
      getCollectorCloudBids().then((bids) => {
        if (bids && bids.length > 0) {
          setMyBids(bids);
        }
      }).catch(() => {});
    } else {
      setMyBids([]);
    }
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
    } catch {
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
    setMyEnquiries([]);
    setEnquiriesError(null);
    setEnquiriesLoading(false);
    await logout();
  };

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

        {/* PROFILE HEADER CARD (LOGGED IN OR GUEST) */}
        <ProfileHeaderCard
          user={user}
          enquiriesCount={myEnquiries.length}
          enquiriesLoading={enquiriesLoading}
          wishlistCount={savedProducts.length}
          onEditProfile={() => setShowEditProfileModal(true)}
          onSignOut={() => setShowSignOutModal(true)}
          onOpenInquiries={() => {
            handleAction(() => {
              setSelectedEnquiryToView(null);
              setShowInquiriesModal(true);
            });
          }}
          onOpenWishlist={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowFullWishlistModal(true);
          }}
          onCreateAccount={() => handleAction(() => router.push("/signup" as any))}
          onSignIn={() => handleAction(() => router.push("/login" as any))}
        />

        {/* ACQUISITION INQUIRIES SECTION */}
        {myEnquiries.length > 0 ? (
          <View style={styles.wishlistSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.sectionHeader, { color: colors.gold }]}>ACQUISITION INQUIRIES</Text>
                <Text
                  style={[
                    styles.wishlistCountBadge,
                    { backgroundColor: colors.goldBadge, color: colors.goldBadgeText },
                  ]}
                >
                  {myEnquiries.length}
                </Text>
              </View>

              <Pressable
                style={styles.viewAllBtn}
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSelectedEnquiryToView(null);
                  setShowInquiriesModal(true);
                }}
              >
                <Text style={[styles.viewAllText, { color: colors.gold }]}>View All ({myEnquiries.length})</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.gold} />
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={myEnquiries}
              keyExtractor={(item) => item.enquiryId || String(item.artworkId)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wishlistList}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.savedCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isDark ? "rgba(212, 175, 55, 0.2)" : colors.border,
                      width: 220,
                    },
                    pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
                  ]}
                  onPress={() => {
                    try {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setSelectedEnquiryToView(item);
                    setShowInquiriesModal(true);
                  }}
                >
                  <View
                    style={[
                      styles.savedCardImageWrap,
                      {
                        backgroundColor: isDark ? "#20222C" : "#FAF6EC",
                        height: 110,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Ionicons name="cube-outline" size={36} color={colors.gold} />
                    <View
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        backgroundColor: isDark ? "rgba(20,21,27,0.88)" : "rgba(255,255,255,0.92)",
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(212,175,55,0.3)" : "rgba(0,0,0,0.1)",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontFamily: FONTS.sansBold,
                          color: colors.gold,
                        }}
                      >
                        Item #{item.artworkId}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.savedCardBody}>
                    <Text
                      style={[styles.savedCardTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.artworkTitle}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontFamily: FONTS.sansBold,
                          color: item.status === "contacted" ? "#2ECC71" : colors.gold,
                        }}
                      >
                        {item.status === "contacted"
                          ? "Curator Contacted"
                          : item.status === "closed"
                          ? "Concluded"
                          : "Under Review"}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* SAVED COLLECTION (WISHLIST SECTION) */}
        <ProfileWishlistSection
          savedProducts={savedProducts}
          onRemove={(id) => removeFromWishlist(id)}
          onViewAll={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowFullWishlistModal(true);
          }}
          onExplore={() => handleAction(() => router.push("/explore" as any))}
          onSelectArtwork={(id) => router.push(`/painting/${id}` as any)}
        />

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

        {/* ACCOUNT, GALLERY, SUPPORT, AND SYSTEM ACTIONS LIST */}
        <ProfileActionsList
          user={user}
          exhibitionPassesCount={exhibitionPasses.length}
          bidsCount={myBids.length}
          enquiriesCount={myEnquiries.length}
          updateStatus={updateStatus}
          onEditProfile={() => setShowEditProfileModal(true)}
          onManageAddresses={() => setShowManageAddressModal(true)}
          onOpenCoaVault={() => {
            if (savedProducts.length > 0) {
              const top = savedProducts[0];
              setSelectedCoaArtwork({
                id: top.id,
                title: top.name,
                artist: top.attributes?.find((a) => /artist/i.test(a.name))?.options[0] || "Master Artist",
                image: top.images[0]?.src,
              });
            } else if (recentlyViewed.length > 0) {
              const top = recentlyViewed[0];
              setSelectedCoaArtwork({
                id: top.id,
                title: top.name,
                artist: top.artist,
                image: top.imageUrl,
              });
            } else {
              setSelectedCoaArtwork({
                id: 1260,
                title: "The Emerging Perspectives",
                artist: "Primo Master Curated",
              });
            }
          }}
          onOpenPasses={() => {
            if (exhibitionPasses.length > 0) {
              setSelectedPassToView(exhibitionPasses[0]);
            } else {
              handleAction(() => router.push("/exhibitions" as any));
            }
          }}
          onOpenBids={() => {
            handleAction(() => router.push("/auctions" as any));
          }}
          onOpenInquiries={() => {
            handleAction(() => {
              setSelectedEnquiryToView(null);
              setShowInquiriesModal(true);
            });
          }}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenLocation={() => {
            handleAction(() => {
              Linking.openURL(GALLERY_CONFIG.mapsUrl).catch(() => {});
            });
          }}
          onCallPhone={() => {
            handleAction(() => {
              Linking.openURL(`tel:${GALLERY_CONFIG.phoneRaw}`).catch(() => {});
            });
          }}
          onBrowseArtworks={() => handleAction(() => router.replace("/explore"))}
          onOpenAuctions={() => handleAction(() => router.push("/auctions" as any))}
          onOpenExhibitions={() => handleAction(() => router.push("/exhibitions" as any))}
          onOpenNotifications={() => handleAction(() => router.push("/notifications" as any))}
          onOpenWhatsApp={() => {
            handleAction(() => {
              Linking.openURL(
                `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hello%20Primo%20Art%20Gallery,%20I%20would%20like%20collector%20advisory%20assistance.`
              ).catch(() => {});
            });
          }}
          onSendEmail={() => {
            handleAction(() => {
              Linking.openURL(`mailto:${GALLERY_CONFIG.email}`).catch(() => {});
            });
          }}
          onOpenWebsite={() => {
            handleAction(() => {
              Linking.openURL(GALLERY_CONFIG.website).catch(() => {});
            });
          }}
          onCheckUpdates={() => handleCheckUpdate()}
        />
      </ScrollView>

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

      {/* PROVENANCE & AUTHENTICITY VAULT MODAL */}
      <CertificateOfAuthenticityModal
        visible={Boolean(selectedCoaArtwork)}
        onClose={() => setSelectedCoaArtwork(null)}
        artworkId={selectedCoaArtwork?.id || 0}
        artworkTitle={selectedCoaArtwork?.title}
        artistName={selectedCoaArtwork?.artist}
        imageUrl={selectedCoaArtwork?.image}
      />

      {/* EXHIBITION VIP PASS VIEWER MODAL */}
      <ExhibitionRsvpModal
        visible={Boolean(selectedPassToView)}
        onClose={() => setSelectedPassToView(null)}
        exhibition={null}
        initialPass={selectedPassToView}
      />

      {/* ACQUISITION INQUIRIES MODAL */}
      <AcquisitionInquiriesModal
        visible={showInquiriesModal}
        onClose={() => {
          setShowInquiriesModal(false);
          setSelectedEnquiryToView(null);
        }}
        enquiries={myEnquiries}
        isLoading={enquiriesLoading}
        onRefresh={loadEnquiries}
        initialSelectedEnquiry={selectedEnquiryToView}
      />
    </SafeAreaView>
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
});
