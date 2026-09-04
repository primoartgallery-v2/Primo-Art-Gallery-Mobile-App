import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";

export type FrameStyle = "gold" | "black" | "wood" | "none";

export type ViewInRoomModalProps = {
  visible: boolean;
  imageUrl?: string | null;
  selectedFrame: FrameStyle;
  onSelectFrame: (frame: FrameStyle) => void;
  onClose: () => void;
};

const FRAME_OPTIONS = [
  { id: "gold", label: "Gold Leaf" },
  { id: "black", label: "Matte Black" },
  { id: "wood", label: "Natural Oak" },
  { id: "none", label: "Frameless" },
] as const;

export function ViewInRoomModal({
  visible,
  imageUrl,
  selectedFrame,
  onSelectFrame,
  onClose,
}: ViewInRoomModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.roomModalContainer} edges={["top", "bottom"]}>
        <View style={styles.roomModalHeader}>
          <Text style={styles.roomModalTitle}>Curated Room Scale Preview</Text>
          <Pressable
            style={styles.roomCloseBtn}
            onPress={onClose}
            accessibilityLabel="Close room preview"
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
            {imageUrl ? (
              <ExpoImage
                source={{ uri: imageUrl }}
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
            {FRAME_OPTIONS.map((f) => (
              <Pressable
                key={f.id}
                style={[
                  styles.frameOptionPill,
                  selectedFrame === f.id && styles.frameOptionPillActive,
                ]}
                onPress={() => onSelectFrame(f.id)}
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
  );
}

const styles = StyleSheet.create({
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
});
