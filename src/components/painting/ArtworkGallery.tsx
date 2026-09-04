import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useState } from "react";
import {
  FlatList,
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

import type { WooCommerceProduct } from "@/services/woocommerce";

const COLORS = {
  charcoal: "#171717",
  goldSoft: "#E9D9B4",
  paper: "#FFFFFF",
};

export type ArtworkGalleryProps = {
  images: WooCommerceProduct["images"];
  title: string;
};

export function ArtworkGallery({ images, title }: ArtworkGalleryProps) {
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

const styles = StyleSheet.create({
  gallery: {
    height: 490,
    backgroundColor: COLORS.charcoal,
    overflow: "hidden",
  },
  galleryImageFrame: {
    height: 490,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomLayer: {
    width: "100%",
    height: "100%",
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  pagination: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    width: 19,
    backgroundColor: COLORS.goldSoft,
  },
  zoomHint: {
    position: "absolute",
    bottom: 19,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(20,20,20,0.48)",
  },
  zoomHintText: {
    color: COLORS.paper,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});
