import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

type SignOutConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function SignOutConfirmModal({
  visible,
  onClose,
  onConfirm,
}: SignOutConfirmModalProps) {
  const { colors } = useAppTheme();

  const handleCancel = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleSignOut = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetWrapper}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* DRAG PILL */}
            <View
              style={[
                styles.dragPill,
                { backgroundColor: colors.border },
              ]}
            />

            {/* GOLD ICON EMBLEM */}
            <View
              style={[
                styles.iconEmblem,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <Ionicons name="log-out-outline" size={28} color={colors.gold} />
            </View>

            {/* TEXT */}
            <Text style={[styles.eyebrow, { color: colors.gold }]}>
              PRIMO COLLECTOR SPACE
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Sign Out of Your Account?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You can sign back in anytime to access your saved artworks, curatorial inquiries, and private previews.
            </Text>

            {/* ACTION BUTTONS */}
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Stay Logged In
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out" size={16} color="#FFFFFF" />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 12, 0.75)",
    justifyContent: "flex-end",
  },
  sheetWrapper: {
    width: "100%",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: "center",
  },
  dragPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  iconEmblem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 21,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  signOutButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#C0392B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
});
