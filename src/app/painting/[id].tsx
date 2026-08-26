import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import RenderHTML from "react-native-render-html";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GALLERY_CONFIG } from "@/constants/galleryConfig";
import { FONTS } from "@/constants/typography";
import { useWishlist } from "@/context/WishlistContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getArtist,
  getArtistBiography,
  getProduct,
  getProducts,
  type WooCommerceProduct,
  type WooCommerceProductAttribute,
  type WooCommerceProductMetaData,
  type WordPressArtist,
} from "@/services/woocommerce";

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

const ARTIST_FIELD_KEYS = [
  "artist",
  "artist name",
  "artist_name",
  "artists",
  "select artist",
  "select artists",
  "selected artist",
  "selected artists",
];

type ArtistProfile = {
  name: string;
  bio: string;
};

export default function PaintingDetailScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();

  const { isSaved, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<WooCommerceProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<WooCommerceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);

  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<"gold" | "black" | "wood" | "none">("gold");

  const requestId = useRef(0);

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

  const enquireWhatsApp = () => {
    if (!product) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setShowEnquiryModal(false);

    const artistName =
      artistProfile?.name ||
      getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery");
    const link = product.images[0]?.src || GALLERY_CONFIG.website;
    const msg = `Hello Primo Art Gallery, I am interested in acquiring "${product.name}" by ${artistName} (Item ID: #${product.id}).\n\nLink: ${link}\n\nPlease share price, provenance, and delivery details.`;
    const url = `https://wa.me/${GALLERY_CONFIG.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {});
  };

  const enquireEmail = () => {
    if (!product) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setShowEnquiryModal(false);

    const artistName =
      artistProfile?.name ||
      getArtworkValue(product, ARTIST_FIELD_KEYS, "Primo Art Gallery");
    const link = product.images[0]?.src || GALLERY_CONFIG.website;
    const subject = encodeURIComponent(`Acquisition Enquiry: ${product.name}`);
    const body = encodeURIComponent(
      `Hello Primo Curators,\n\nI am interested in acquiring the following artwork:\n- Artwork: ${product.name}\n- Artist: ${artistName}\n- Artwork ID: #${product.id}\n- Image/Link: ${link}\n\nPlease share price, catalogue, and purchase terms.\n\nThank you.`
    );
    Linking.openURL(`mailto:${GALLERY_CONFIG.email}?subject=${subject}&body=${body}`).catch(
      () => {}
    );
  };

  const callAdvisory = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setShowEnquiryModal(false);
    Linking.openURL(`tel:${GALLERY_CONFIG.phoneRaw}`).catch(() => {});
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
          {errorMessage ?? "This artwork is no longer available."}
        </Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.gold }]} onPress={loadArtwork}>
          <Text style={styles.retryButtonText}>TRY AGAIN</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const artist =
    artistProfile?.name ||
    getArtworkValue(product, ARTIST_FIELD_KEYS, "Artist details on request");
  const artistBio =
    artistProfile?.bio ||
    getArtworkValue(
      product,
      ["artist bio", "artist_bio", "bio", "biography"],
      "Artist biography is available on request."
    );
  const price = product.price || product.regular_price;
  const images = product.images.length ? product.images : [];
  const wishlisted = isSaved(product.id);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <FlatList
        data={[product]}
        keyExtractor={(item) => String(item.id)}
        renderItem={() => (
          <>
            <View style={styles.galleryContainer}>
              <ArtworkGallery images={images} title={product.name} />

              {images[0]?.src ? (
                <Pressable
                  style={styles.roomButton}
                  onPress={() => setShowRoomModal(true)}
                >
                  <Ionicons name="cube-outline" size={15} color={colors.gold} />
                  <Text style={styles.roomButtonText}>VIEW IN A ROOM</Text>
                </Pressable>
              ) : null}

              <SafeAreaView style={styles.topControls} edges={["top"]} pointerEvents="box-none">
                <Pressable
                  style={styles.topControl}
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </Pressable>
                <View style={styles.topActions}>
                  <Pressable style={styles.topControl} onPress={shareArtwork} accessibilityLabel="Share artwork">
                    <Ionicons name="share-outline" size={21} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    style={styles.topControl}
                    onPress={() => toggleWishlist(product)}
                    accessibilityLabel={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Ionicons
                      name={wishlisted ? "heart" : "heart-outline"}
                      size={21}
                      color={wishlisted ? "#E74C3C" : "#FFFFFF"}
                    />
                  </Pressable>
                </View>
              </SafeAreaView>
            </View>

            <View style={[styles.content, { backgroundColor: colors.background }]}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>
                {product.categories[0]?.name ?? "ORIGINAL ARTWORK"}
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>
              <Text style={[styles.artist, { color: colors.textSecondary }]}>by {artist}</Text>

              <View
                style={[
                  styles.priceRow,
                  { borderTopColor: colors.borderLight },
                ]}
              >
                <View>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>ACQUISITION PRICE</Text>
                  <Text style={[styles.price, { color: colors.gold }]}>
                    {price ? `₹ ${price}` : "Price on request"}
                  </Text>
                </View>
                {product.on_sale && product.regular_price ? (
                  <View style={[styles.saleBadge, { backgroundColor: colors.goldBadge }]}>
                    <Text style={[styles.saleBadgeText, { color: colors.goldBadgeText }]}>CURATED OFFER</Text>
                  </View>
                ) : null}
              </View>

              <SectionHeading number="01" title="Artwork details" />
              {product.description ? (
                <ArtworkHtml html={product.description} />
              ) : product.short_description ? (
                <ArtworkHtml html={product.short_description} />
              ) : (
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  A distinctive original artwork, curated by Primo Art Gallery.
                </Text>
              )}

              <SectionHeading number="02" title="Artist details" />
              <View
                style={[
                  styles.artistCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.artistMonogram, { backgroundColor: colors.goldSoft }]}>
                  <Text style={[styles.artistMonogramText, { color: colors.gold }]}>{getInitials(artist)}</Text>
                </View>
                <View style={styles.artistCopy}>
                  <Text style={[styles.artistName, { color: colors.text }]}>{artist}</Text>
                  <Text style={[styles.artistBio, { color: colors.textSecondary }]}>{artistBio}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.certificateCard,
                  { backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              >
                <View style={styles.certificateIcon}>
                  <Ionicons name="ribbon-outline" size={26} color={colors.gold} />
                </View>
                <View style={styles.certificateCopy}>
                  <Text style={[styles.certificateTitle, { color: colors.text }]}>Certificate of Authenticity</Text>
                  <Text style={[styles.certificateText, { color: colors.textSecondary }]}>
                    This work is accompanied by Primo Art Gallery’s certificate of authenticity.
                  </Text>
                </View>
                <View
                  style={[
                    styles.authenticBadge,
                    { backgroundColor: colors.goldBadge },
                  ]}
                >
                  <Ionicons name="checkmark" size={13} color={colors.goldBadgeText} />
                  <Text style={[styles.authenticBadgeText, { color: colors.goldBadgeText }]}>AUTHENTIC</Text>
                </View>
              </View>

              {relatedProducts.length ? (
                <>
                  <SectionHeading number="03" title="Related paintings" />
                  <FlatList
                    horizontal
                    data={relatedProducts}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => <RelatedPaintingCard product={item} />}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.relatedList}
                  />
                </>
              ) : null}
            </View>
          </>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 108 + insets.bottom }}
      />

      <SafeAreaView
        style={[
          styles.bottomBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
        edges={["bottom"]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.wishlistBottomBtn,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            wishlisted && styles.wishlistBottomBtnActive,
            pressed && { transform: [{ scale: 0.92 }] },
          ]}
          onPress={() => toggleWishlist(product)}
          accessibilityLabel={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Ionicons
            name={wishlisted ? "heart" : "heart-outline"}
            size={22}
            color={wishlisted ? "#E74C3C" : colors.text}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.enquireButton,
            { backgroundColor: colors.gold },
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
          onPress={() => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setShowEnquiryModal(true);
          }}
        >
          <Text style={styles.enquireButtonText}>ENQUIRE / ACQUIRE</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>

      <Modal
        visible={showEnquiryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEnquiryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEnquiryModal(false)}
        >
          <Pressable
            style={[
              styles.enquirySheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetEyebrow, { color: colors.gold }]}>PRIMO ART ADVISORY</Text>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Acquisition Enquiry</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
              Connect directly with our curators regarding &ldquo;{product.name}&rdquo;.
            </Text>

            <Pressable style={styles.whatsappButton} onPress={enquireWhatsApp}>
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              <View style={styles.channelTextCol}>
                <Text style={styles.whatsappTitle}>Chat on WhatsApp</Text>
                <Text style={styles.whatsappSub}>Instant response with artwork details</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={[
                styles.emailButton,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}
              onPress={enquireEmail}
            >
              <Ionicons name="mail-outline" size={22} color={colors.text} />
              <View style={styles.channelTextCol}>
                <Text style={[styles.emailTitle, { color: colors.text }]}>Official Email Enquiry</Text>
                <Text style={[styles.emailSub, { color: colors.textSecondary }]}>Receive detailed catalogue &amp; provenance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={[
                styles.phoneButton,
                { backgroundColor: colors.goldSoft, borderColor: colors.border },
              ]}
              onPress={callAdvisory}
            >
              <Ionicons name="call-outline" size={20} color={colors.gold} />
              <Text style={[styles.phoneText, { color: colors.gold }]}>Call Art Advisory ({GALLERY_CONFIG.phone})</Text>
            </Pressable>

            <Pressable
              style={[
                styles.cancelButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setShowEnquiryModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* VIEW IN ROOM MODAL */}
      <Modal
        visible={showRoomModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowRoomModal(false)}
      >
        <SafeAreaView style={styles.roomModalContainer} edges={["top", "bottom"]}>
          <View style={styles.roomModalHeader}>
            <Text style={styles.roomModalTitle}>Curated Room Scale Preview</Text>
            <Pressable
              style={styles.roomCloseBtn}
              onPress={() => setShowRoomModal(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* ROOM WALL VIEW */}
          <View style={styles.virtualRoomWall}>
            <View style={styles.wallLighting} />

            <View
              style={[
                styles.framedArtworkFrame,
                selectedFrame === "gold" && styles.frameGold,
                selectedFrame === "black" && styles.frameBlack,
                selectedFrame === "wood" && styles.frameWood,
                selectedFrame === "none" && styles.frameNone,
              ]}
            >
              {images[0]?.src ? (
                <ExpoImage
                  source={{ uri: images[0].src }}
                  style={styles.roomArtworkImage}
                  contentFit="contain"
                />
              ) : null}
            </View>

            <View style={styles.roomFurniture}>
              <View style={styles.sofaBack} />
              <View style={styles.sofaSeat} />
            </View>
          </View>

          {/* FRAME SELECTOR */}
          <View style={styles.frameSelectorBar}>
            <Text style={styles.frameSelectorLabel}>FRAME STYLE:</Text>
            <View style={styles.frameOptionsRow}>
              {(
                [
                  { id: "gold", label: "Gold Leaf" },
                  { id: "black", label: "Matte Black" },
                  { id: "wood", label: "Natural Oak" },
                  { id: "none", label: "Frameless" },
                ] as const
              ).map((f) => (
                <Pressable
                  key={f.id}
                  style={[
                    styles.frameOptionPill,
                    selectedFrame === f.id && styles.frameOptionPillActive,
                  ]}
                  onPress={() => setSelectedFrame(f.id)}
                >
                  <Text
                    style={[
                      styles.frameOptionText,
                      selectedFrame === f.id && styles.frameOptionTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function ArtworkGallery({
  images,
  title,
}: {
  images: WooCommerceProduct["images"];
  title: string;
}) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={styles.gallery}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={images.length ? images : [{ id: 0, src: "", alt: title }]}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <GallerySlide uri={item.src} alt={item.alt || title} width={width} />
        )}
      />

      {images.length > 1 ? (
        <View style={styles.pagination}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.zoomHint}>
        <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
        <Text style={styles.zoomHintText}>PINCH TO ZOOM</Text>
      </View>
    </View>
  );
}

function GallerySlide({
  uri,
  alt,
  width,
}: {
  uri: string;
  alt: string;
  width: number;
}) {
  const scale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(e.scale, 1), 3.5);
    })
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 250 });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = scale.value > 1.2 ? withTiming(1) : withTiming(2.2);
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
      <View style={[styles.galleryImageFrame, { width }]}>
        <Animated.View style={[styles.zoomLayer, imageStyle]}>
          <ExpoImage
            source={{ uri }}
            style={styles.galleryImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={240}
            accessibilityLabel={alt}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function ArtworkHtml({ html }: { html: string }) {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();

  return (
    <View style={styles.artworkHtmlWrapper}>
      <RenderHTML
        contentWidth={width - 48}
        source={{ html }}
        baseStyle={{
          ...styles.htmlBase,
          color: colors.textSecondary,
        }}
        tagsStyles={{
          p: { ...styles.htmlParagraph, color: colors.textSecondary },
          li: { ...styles.htmlListItem, color: colors.textSecondary },
          strong: { ...styles.htmlStrong, color: colors.text },
          h1: { ...styles.htmlHeading, color: colors.text },
          h2: { ...styles.htmlHeading, color: colors.text },
          h3: { ...styles.htmlHeading, color: colors.text },
          h5: { ...styles.htmlHeading, color: colors.text },
          h6: { ...styles.htmlHeading, color: colors.text },
        }}
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
      <Text style={[styles.relatedName, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
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
      <StatusBar barStyle="light-content" />
      <View style={[styles.skeletonHero, { backgroundColor: colors.backgroundElement }]} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "34%", height: 10 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "80%", height: 34, marginTop: 16 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "42%", height: 16, marginTop: 12 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "55%", height: 24, marginTop: 34 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "100%", height: 14, marginTop: 42 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "90%", height: 14, marginTop: 11 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundElement, width: "72%", height: 14, marginTop: 11 }]} />
      </View>
    </View>
  );
}

function getArtistId(product: WooCommerceProduct): string | number | undefined {
  const artistMeta = product.meta_data.find((item) => item.key === "egns_product_meta");
  const value = artistMeta?.value;

  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const artistIds = (value as Record<string, unknown>).artists_list_ids;
  if (!Array.isArray(artistIds)) return undefined;

  const artistId = artistIds[0];
  return typeof artistId === "string" || typeof artistId === "number"
    ? artistId
    : undefined;
}

function extractArtistProfile(artist: WordPressArtist): ArtistProfile {
  const name = getArtistField(artist, [
    ["name"],
    ["artist_name"],
    ["display_name"],
    ["title", "rendered"],
    ["title"],
    ["acf", "name"],
    ["acf", "artist_name"],
  ]);
  const bio = getArtistField(artist, [
    ["biography"],
    ["bio"],
    ["description"],
    ["details"],
    ["content", "rendered"],
    ["content"],
    ["excerpt", "rendered"],
    ["excerpt"],
    ["acf", "biography"],
    ["acf", "bio"],
    ["acf", "description"],
    ["acf", "details"],
  ]);

  return { name, bio };
}

function getArtistField(source: WordPressArtist, paths: string[][]) {
  for (const path of paths) {
    let value: unknown = source;
    for (const key of path) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[key];
    }

    const text = getArtistText(value);
    if (text) return text;
  }

  return "";
}

function getArtistText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return cleanArtistText(String(value));
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["rendered", "raw", "value", "name", "title"]) {
    const text = getArtistText(record[key]);
    if (text) return text;
  }
  return "";
}

function cleanArtistText(value: string) {
  return value
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getArtworkValue(product: WooCommerceProduct, keys: string[], fallback: string) {
  const normalizedKeys = keys.map(normalizeKey);
  const attribute = product.attributes.find((item) => normalizedKeys.includes(normalizeKey(item.name)));
  const attributeValue = getAttributeValue(attribute);
  if (attributeValue) return attributeValue;

  const meta = product.meta_data.find((item) => normalizedKeys.includes(normalizeKey(item.key)));
  const metaValue = getMetaValue(meta);
  return metaValue || fallback;
}

function getAttributeValue(attribute?: WooCommerceProductAttribute) {
  if (!attribute) return "";
  return attribute.option || attribute.options.filter(Boolean).join(", ");
}

function getMetaValue(meta?: WooCommerceProductMetaData) {
  if (!meta || meta.value === null || meta.value === undefined) return "";
  if (Array.isArray(meta.value)) return meta.value.filter(Boolean).join(", ");
  if (typeof meta.value === "object") return "";
  return String(meta.value).trim();
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function getInitials(name: unknown) {
  if (typeof name !== "string") {
    return "AR";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivory },

  artworkHtmlWrapper: { marginHorizontal: 24, marginTop: 1 },
  galleryContainer: { height: 490, position: "relative" },
  gallery: { height: 490, backgroundColor: COLORS.charcoal, overflow: "hidden" },
  galleryImageFrame: { height: 490, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  zoomLayer: { width: "100%", height: "100%" },
  galleryImage: { width: "100%", height: "100%" },
  topControls: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: 10 },
  topControl: { width: 43, height: 43, borderRadius: 22, backgroundColor: "rgba(20,20,20,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  pagination: { position: "absolute", bottom: 60, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { width: 19, backgroundColor: COLORS.goldSoft },
  zoomHint: { position: "absolute", bottom: 19, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(20,20,20,0.48)" },
  zoomHintText: { color: COLORS.paper, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
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
  htmlBase: { color: COLORS.muted, fontSize: 15, fontFamily: FONTS.sansRegular, lineHeight: 25, textAlign: "left" },
  bodyText: { marginHorizontal: 24, marginTop: 17, color: COLORS.muted, fontSize: 15, fontFamily: FONTS.sansRegular, lineHeight: 25 },
  htmlParagraph: { marginTop: 17, marginBottom: 5, color: COLORS.muted, fontSize: 15, fontFamily: FONTS.sansRegular, lineHeight: 25, textAlign: "left" },
  htmlListItem: { color: COLORS.muted, fontSize: 15, fontFamily: FONTS.sansRegular, lineHeight: 25, marginBottom: 7 },
  htmlStrong: { color: COLORS.ink, fontFamily: FONTS.sansBold },
  htmlHeading: { color: COLORS.ink, fontFamily: FONTS.serifBold, marginTop: 24, marginBottom: 8, lineHeight: 28 },
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
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    gap: 11,
    backgroundColor: "rgba(250,248,243,0.97)",
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  wishlistBottomBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.paper,
  },
  wishlistBottomBtnActive: {
    borderColor: "#F5B7B1",
    backgroundColor: "#FDEDEC",
  },
  enquireButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    flexDirection: "row",
    backgroundColor: COLORS.gold,
  },
  enquireButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  enquirySheet: {
    backgroundColor: "#FAF8F3",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 38,
    gap: 14,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D3CEC5",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetEyebrow: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  sheetTitle: {
    color: COLORS.ink,
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    fontWeight: "700",
  },
  sheetSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
    marginBottom: 6,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  channelTextCol: {
    flex: 1,
  },
  whatsappTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.sansBold,
  },
  whatsappSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
    marginTop: 2,
  },
  emailButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  emailTitle: {
    color: COLORS.ink,
    fontSize: 15,
    fontFamily: FONTS.sansBold,
  },
  emailSub: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
    marginTop: 2,
  },
  phoneButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  phoneText: {
    color: COLORS.gold,
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  cancelButton: {
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEAE0",
    marginTop: 4,
  },
  cancelButtonText: {
    color: COLORS.ink,
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
  },
  roomModalContainer: {
    flex: 1,
    backgroundColor: "#1A1A1D",
    justifyContent: "space-between",
  },
  roomModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  roomModalTitle: {
    color: "#FFFFFF",
    fontFamily: FONTS.serifBold,
    fontSize: 22,
  },
  roomCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  virtualRoomWall: {
    flex: 1,
    backgroundColor: "#2E3036",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  wallLighting: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 180,
    backgroundColor: "rgba(255, 248, 225, 0.08)",
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  framedArtworkFrame: {
    width: 220,
    height: 270,
    backgroundColor: "#FAF8F3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 20,
    marginBottom: 60,
  },
  frameGold: {
    borderWidth: 10,
    borderColor: "#D4AF37",
  },
  frameBlack: {
    borderWidth: 10,
    borderColor: "#171717",
  },
  frameWood: {
    borderWidth: 10,
    borderColor: "#8B5A2B",
  },
  frameNone: {
    borderWidth: 0,
  },
  roomArtworkImage: {
    width: "100%",
    height: "100%",
  },
  roomFurniture: {
    position: "absolute",
    bottom: 0,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  sofaBack: {
    width: "100%",
    height: 50,
    backgroundColor: "#42454E",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sofaSeat: {
    width: "105%",
    height: 35,
    backgroundColor: "#353840",
    borderRadius: 8,
  },
  frameSelectorBar: {
    backgroundColor: "#17171A",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  frameSelectorLabel: {
    color: "#E9D9B4",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  frameOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  frameOptionPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  frameOptionPillActive: {
    backgroundColor: "#B8964E",
    borderColor: "#E9D9B4",
  },
  frameOptionText: {
    color: "#CBC5BB",
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  frameOptionTextActive: {
    color: "#FFFFFF",
  },
  errorScreen: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.charcoal },
  errorBackButton: { position: "absolute", left: 22, top: 58, width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  errorTitle: { marginTop: 18, color: COLORS.paper, fontFamily: FONTS.serifBold, fontSize: 30 },
  errorText: { marginTop: 10, color: "#C8C1B6", fontSize: 14, fontFamily: FONTS.sansRegular, lineHeight: 21, textAlign: "center" },
  retryButton: { marginTop: 25, paddingHorizontal: 20, height: 45, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.gold },
  retryButtonText: { color: COLORS.charcoal, fontSize: 11, fontFamily: FONTS.sansExtraBold, letterSpacing: 1 },
  skeletonHero: { height: 490, backgroundColor: "#2A2A2A" },
  skeletonContent: { padding: 24 },
  skeletonLine: { borderRadius: 5, backgroundColor: "#E9E3D8" },
});
