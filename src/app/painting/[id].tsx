import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CertificateOfAuthenticityModal } from "@/components/CertificateOfAuthenticityModal";
import { ArtworkDescriptionHtml } from "@/components/painting/ArtworkDescriptionHtml";
import { ArtworkGallery } from "@/components/painting/ArtworkGallery";
import { PaintingEnquiryModal } from "@/components/painting/PaintingEnquiryModal";
import {
  ViewInRoomModal,
  type FrameStyle,
} from "@/components/painting/ViewInRoomModal";
import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { recordArtworkView } from "@/services/recentlyViewedStorage";
import {
  getArtist,
  getArtistBiography,
  getProduct,
  getProducts,
  type WooCommerceProduct,
} from "@/services/woocommerce";
import {
  ARTIST_FIELD_KEYS,
  type ArtistProfile,
  extractArtistProfile,
  getArtistId,
  getArtworkValue,
  getInitials,
} from "@/utils/artworkHelpers";

const COLORS = {
  charcoal: "#171717",
  ink: "#252525",
  gold: "#B8964E",
  goldSoft: "#E9D9B4",
  ivory: "#FAF8F3",
  paper: "#FFFFFF",
  muted: "#77736B",
  line: "#E8E2D8",
  success: "#4F765D",
};

export default function PaintingDetailScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { isSaved, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<WooCommerceProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<WooCommerceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);

  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showCoaModal, setShowCoaModal] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<FrameStyle>("gold");

  const requestId = useRef(0);
  const recordedViewForId = useRef<number | null>(null);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const loadArtwork = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setIsLoading(true);
    setErrorMessage(null);
    setArtistProfile(null);
    setRelatedProducts([]);

    try {
      const artwork = await getProduct(productId);
      if (currentRequestId !== requestId.current) return;

      setProduct(artwork);
      setIsLoading(false);

      // Record artwork view for Recently Viewed history (deduped per load)
      if (artwork && artwork.id && recordedViewForId.current !== artwork.id) {
        recordedViewForId.current = artwork.id;
        void recordArtworkView(artwork, userIdRef.current);
      }

      const artistId = getArtistId(artwork);
      if (artistId) {
        void getArtist(artistId)
          .then(async (fetchedArtist) => {
            const profile = extractArtistProfile(fetchedArtist);
            const biography = profile.bio || (await getArtistBiography(fetchedArtist));
            if (currentRequestId === requestId.current) {
              setArtistProfile({ ...profile, bio: biography });
            }
          })
          .catch(() => {});
      }

      const categoryId = artwork.categories[0]?.id;
      if (categoryId) {
        getProducts({ page: 1, perPage: 8, category: categoryId, exclude: [artwork.id] })
          .then((res) => {
            if (currentRequestId === requestId.current) {
              setRelatedProducts(res.products.slice(0, 6));
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Artwork not found.");
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadArtwork();
  }, [loadArtwork]);

  const shareArtwork = async () => {
    if (!product) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const artistName =
      artistProfile?.name ||
      getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery");
    const link = product.images[0]?.src || GALLERY_CONFIG.website;
    const message = `Check out "${product.name}" by ${artistName} on Primo Art Gallery:\n${link}`;

    try {
      await Share.share({ message, url: link, title: product.name });
    } catch {}
  };

  if (isLoading) {
    return <PaintingSkeleton />;
  }

  if (!product || errorMessage) {
    return (
      <SafeAreaView
        style={[styles.errorScreen, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <Pressable
          style={[styles.errorBackButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Ionicons name="sparkles-outline" size={38} color={colors.gold} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Artwork unavailable</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {errorMessage || "The requested painting could not be loaded."}
        </Text>
        <Pressable
          style={[styles.errorRetryBtn, { backgroundColor: colors.gold }]}
          onPress={loadArtwork}
        >
          <Text style={styles.errorRetryBtnText}>TRY AGAIN</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const images = product.images.length
    ? product.images
    : [{ id: 0, src: "", alt: product.name }];
  const price = product.price || product.regular_price;
  const isOnSale = Boolean(product.on_sale && product.sale_price);
  const artist =
    artistProfile?.name ||
    getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery");
  const descriptionHtml = product.description || product.short_description || "";
  const cleanedDescriptionText = descriptionHtml.replace(/<[^>]*>/g, "").trim();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ARTWORK GALLERY */}
        <View style={styles.galleryContainer}>
          <ArtworkGallery images={images} title={product.name} />

          {/* TOP CONTROLS */}
          <SafeAreaView edges={["top"]} style={styles.topControls}>
            <Pressable
              style={styles.topControl}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>

            <View style={styles.topActions}>
              <Pressable
                style={styles.topControl}
                onPress={shareArtwork}
                accessibilityLabel="Share artwork"
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable
                style={styles.topControl}
                onPress={() => {
                  try {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch {}
                  void toggleWishlist(product);
                }}
                accessibilityLabel="Toggle wishlist"
              >
                <Ionicons
                  name={isSaved(product.id) ? "heart" : "heart-outline"}
                  size={19}
                  color={isSaved(product.id) ? "#C0392B" : "#FFFFFF"}
                />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* VIEW IN ROOM BUTTON */}
          <Pressable
            style={styles.roomButton}
            onPress={() => setShowRoomModal(true)}
          >
            <Ionicons name="cube-outline" size={14} color={COLORS.goldSoft} />
            <Text style={styles.roomButtonText}>VIEW IN ROOM</Text>
          </Pressable>
        </View>

        {/* DETAILS CONTENT */}
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>ORIGINAL MASTERWORK</Text>
          <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>
          <Text style={[styles.artist, { color: colors.textSecondary }]}>{artist}</Text>

          {/* PRICE ROW */}
          <View style={[styles.priceRow, { borderTopColor: colors.borderLight }]}>
            <View>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>ESTIMATED VALUATION</Text>
              <Text style={[styles.price, { color: colors.text }]}>
                {price ? `₹ ${Number(price).toLocaleString("en-IN")}` : "Price on request"}
              </Text>
            </View>
            {isOnSale ? (
              <View style={[styles.saleBadge, { backgroundColor: colors.goldBadge }]}>
                <Text style={[styles.saleBadgeText, { color: colors.goldBadgeText }]}>GALLERY SPECIAL</Text>
              </View>
            ) : null}
          </View>

          {/* CURATOR'S NOTES / HTML DESCRIPTION */}
          <SectionHeading number="01" title="Curator's Notes" />
          {descriptionHtml ? (
            <ArtworkDescriptionHtml html={descriptionHtml} />
          ) : (
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              {cleanedDescriptionText || "Original fine art painting curated by Primo Art Gallery."}
            </Text>
          )}

          {/* CERTIFICATE OF AUTHENTICITY BADGE CARD */}
          <Pressable
            style={[styles.certificateCard, { backgroundColor: isDark ? "#17171C" : COLORS.charcoal }]}
            onPress={() => setShowCoaModal(true)}
          >
            <View style={styles.certificateIcon}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.gold} />
            </View>
            <View style={styles.certificateCopy}>
              <Text style={styles.certificateTitle}>Certificate of Authenticity</Text>
              <Text style={styles.certificateText}>
                Hand-signed by artist & curatorial provenance recorded &bull; Tap to view
              </Text>
            </View>
            <View style={styles.authenticBadge}>
              <Ionicons name="checkmark-circle" size={10} color={COLORS.charcoal} />
              <Text style={styles.authenticBadgeText}>VERIFIED</Text>
            </View>
          </Pressable>

          {/* ARTIST BIOGRAPHY */}
          <SectionHeading number="02" title="About the Artist" />
          <View style={[styles.artistCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
            <View style={styles.artistMonogram}>
              <Text style={styles.artistMonogramText}>{getInitials(artist)}</Text>
            </View>
            <View style={styles.artistCopy}>
              <Text style={[styles.artistName, { color: colors.text }]}>{artist}</Text>
              <Text style={[styles.artistBio, { color: colors.textSecondary }]}>
                {artistProfile?.bio ||
                  "A master practitioner of traditional and contemporary Indian fine art, represented by Primo Art Gallery."}
              </Text>
            </View>
          </View>

          {/* RELATED ARTWORKS */}
          {relatedProducts.length > 0 ? (
            <>
              <SectionHeading number="03" title="Related Masterpieces" />
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={relatedProducts}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.relatedList}
                renderItem={({ item }) => <RelatedPaintingCard product={item} />}
              />
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* ACTION BAR */}
      <SafeAreaView edges={["bottom"]} style={[styles.bottomBar, { backgroundColor: colors.headerBackground, borderTopColor: colors.borderLight }]}>
        <Pressable
          style={[styles.wishlistCircle, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            if (product) {
              try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch {}
              void toggleWishlist(product);
            }
          }}
          accessibilityLabel="Wishlist"
        >
          <Ionicons
            name={product && isSaved(product.id) ? "heart" : "heart-outline"}
            size={20}
            color={product && isSaved(product.id) ? "#C0392B" : colors.text}
          />
        </Pressable>

        <Pressable
          style={styles.enquireButton}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowEnquiryModal(true);
          }}
        >
          <Ionicons name="chatbubbles-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.enquireButtonText}>ENQUIRE NOW</Text>
        </Pressable>
      </SafeAreaView>

      {/* VIEW IN ROOM MODAL */}
      <ViewInRoomModal
        visible={showRoomModal}
        imageUrl={images[0]?.src}
        selectedFrame={selectedFrame}
        onSelectFrame={setSelectedFrame}
        onClose={() => setShowRoomModal(false)}
      />

      {/* VIP ACQUISITION ENQUIRY MODAL */}
      <PaintingEnquiryModal
        visible={showEnquiryModal}
        product={product}
        artistProfile={artistProfile}
        user={user}
        onClose={() => setShowEnquiryModal(false)}
      />

      {/* DIGITAL CERTIFICATE OF AUTHENTICITY & PROVENANCE MODAL */}
      <CertificateOfAuthenticityModal
        visible={showCoaModal}
        onClose={() => setShowCoaModal(false)}
        artworkId={product?.id || productId}
        artworkTitle={product?.name}
        artistName={artist}
        imageUrl={product?.images[0]?.src}
      />
    </View>
  );
}

const RelatedPaintingCard = React.memo(function RelatedPaintingCard({
  product,
}: {
  product: WooCommerceProduct;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const image = product.images[0];
  const price = product.price || product.regular_price;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.relatedCard,
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
      ]}
      onPress={() => {
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
        router.push({ pathname: "/painting/[id]", params: { id: String(product.id) } });
      }}
    >
      {image ? (
        <ExpoImage
          source={{ uri: image.src }}
          style={styles.relatedImage}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          accessibilityLabel={image.alt || product.name}
        />
      ) : (
        <View style={[styles.relatedImage, styles.relatedImageFallback, { backgroundColor: isDark ? "#20222C" : "#E9E2D5" }]}>
          <Ionicons name="image-outline" size={25} color={colors.gold} />
        </View>
      )}
      <Text style={[styles.relatedName, { color: isDark ? colors.gold : colors.text }]} numberOfLines={2}>{product.name}</Text>
      <Text style={[styles.relatedPrice, { color: colors.gold }]}>{price ? `₹ ${price}` : "Price on request"}</Text>
    </Pressable>
  );
});

function SectionHeading({ number, title }: { number: string; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionNumber, { color: colors.gold }]}>{number}</Text>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.sectionLine, { backgroundColor: colors.borderLight }]} />
    </View>
  );
}

function PaintingSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.gallery, { backgroundColor: colors.backgroundElement }]} />
      <View style={{ padding: 24 }}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "35%", height: 12 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "80%", height: 28, marginTop: 14 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "42%", height: 16, marginTop: 12 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "55%", height: 24, marginTop: 34 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "100%", height: 14, marginTop: 42 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "90%", height: 14, marginTop: 11 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "72%", height: 14, marginTop: 11 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivory },
  galleryContainer: { height: 490, position: "relative" },
  gallery: { height: 490, backgroundColor: COLORS.charcoal, overflow: "hidden" },
  topControls: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: 10 },
  topControl: { width: 43, height: 43, borderRadius: 22, backgroundColor: "rgba(20,20,20,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  roomButton: {
    position: "absolute",
    bottom: 56,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(23, 32, 42, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(233, 217, 180, 0.35)",
  },
  roomButtonText: {
    color: COLORS.goldSoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  content: { paddingTop: 30 },
  eyebrow: { marginHorizontal: 24, color: COLORS.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { marginHorizontal: 24, marginTop: 10, color: COLORS.ink, fontFamily: FONTS.serifBold, fontSize: 34, lineHeight: 42 },
  artist: { marginHorizontal: 24, marginTop: 7, color: COLORS.muted, fontSize: 16, fontFamily: FONTS.serifItalic },
  priceRow: { marginHorizontal: 24, marginTop: 27, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { color: COLORS.muted, fontSize: 9, fontFamily: FONTS.sansExtraBold, letterSpacing: 1.3 },
  price: { marginTop: 6, color: COLORS.ink, fontSize: 22, fontFamily: FONTS.sansBold },
  saleBadge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#F2E8D2" },
  saleBadgeText: { color: "#85652B", fontSize: 9, fontFamily: FONTS.sansExtraBold, letterSpacing: 0.7 },
  sectionHeading: { marginHorizontal: 24, marginTop: 43, flexDirection: "row", alignItems: "center", gap: 10 },
  sectionNumber: { color: COLORS.gold, fontSize: 10, fontFamily: FONTS.sansExtraBold, letterSpacing: 1 },
  sectionTitle: { color: COLORS.ink, fontFamily: FONTS.serifBold, fontSize: 22 },
  sectionLine: { flex: 1, height: 1, marginLeft: 4, backgroundColor: COLORS.line },
  bodyText: { marginHorizontal: 24, marginTop: 17, color: COLORS.muted, fontSize: 15, fontFamily: FONTS.sansRegular, lineHeight: 25 },
  certificateCard: { marginHorizontal: 24, marginTop: 18, padding: 17, borderRadius: 17, backgroundColor: COLORS.charcoal, flexDirection: "row", alignItems: "center" },
  certificateIcon: { width: 47, height: 47, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(184,150,78,0.14)", borderWidth: 1, borderColor: "rgba(233,217,180,0.22)" },
  certificateCopy: { flex: 1, marginLeft: 13, marginRight: 8 },
  certificateTitle: { color: COLORS.paper, fontSize: 14, fontFamily: FONTS.sansBold },
  certificateText: { marginTop: 4, color: "#CBC5BB", fontSize: 11, fontFamily: FONTS.sansRegular, lineHeight: 16 },
  authenticBadge: { position: "absolute", right: 15, top: 12, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.goldSoft },
  authenticBadgeText: { color: COLORS.charcoal, fontSize: 7, fontFamily: FONTS.sansExtraBold, letterSpacing: 0.5 },
  artistCard: { marginHorizontal: 24, marginTop: 19, padding: 18, borderRadius: 17, backgroundColor: "#F0EBE1", flexDirection: "row" },
  artistMonogram: { width: 51, height: 51, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.charcoal },
  artistMonogramText: { color: COLORS.goldSoft, fontFamily: FONTS.serifBold, fontSize: 19 },
  artistCopy: { flex: 1, marginLeft: 14 },
  artistName: { color: COLORS.ink, fontSize: 16, fontFamily: FONTS.sansBold },
  artistBio: { marginTop: 6, color: COLORS.muted, fontSize: 12, fontFamily: FONTS.sansRegular, lineHeight: 18 },
  relatedList: { paddingLeft: 24, paddingRight: 10, paddingTop: 18 },
  relatedCard: { width: 164, marginRight: 13 },
  relatedImage: { width: 164, height: 194, borderRadius: 14, backgroundColor: "#E9E2D5" },
  relatedImageFallback: { alignItems: "center", justifyContent: "center" },
  relatedName: { marginTop: 10, color: COLORS.ink, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  relatedPrice: { marginTop: 4, color: COLORS.gold, fontSize: 12, fontWeight: "800" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 82,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  wishlistCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  enquireButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: COLORS.gold,
  },
  enquireButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  errorBackButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontFamily: FONTS.serifBold,
    marginTop: 18,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  errorRetryBtn: {
    marginTop: 22,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
  },
  errorRetryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  skeletonLine: {
    borderRadius: 8,
  },
});
