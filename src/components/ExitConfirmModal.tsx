import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ExitConfirmModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ExitConfirmModal({ visible, onClose }: ExitConfirmModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleConfirmExit = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onClose();
    BackHandler.exitApp();
  };

  const handleCancel = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              {/* Drag Handle */}
              <View
                style={[
                  styles.handle,
                  { backgroundColor: isDark ? "#3A3C4A" : "#D8D2C5" },
                ]}
              />

              {/* Icon Container */}
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.goldSoft,
                    borderColor: isDark ? "#43371E" : "#EAD9B5",
                  },
                ]}
              >
                <Ionicons name="exit-outline" size={26} color={colors.gold} />
              </View>

              {/* Header Texts */}
              <Text style={[styles.title, { color: colors.text }]}>
                Exit Primo Art Gallery?
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Are you sure you want to exit the application?
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundElement,
                    },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Stay in Gallery"
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                    Stay
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.exitButton,
                    { backgroundColor: colors.gold },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleConfirmExit}
                  accessibilityRole="button"
                  accessibilityLabel="Exit application"
                >
                  <Text style={styles.exitButtonText}>Exit App</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.serifBold,
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 16,
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
    letterSpacing: 0.5,
  },
  exitButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B8964E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  exitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.88,
  },
});
