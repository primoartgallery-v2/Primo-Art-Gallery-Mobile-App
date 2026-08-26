import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";

type EditProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

const LUXURY_AVATARS = [
  { id: "avatar_1", icon: "person", label: "Classic" },
  { id: "avatar_2", icon: "shield-checkmark", label: "Verified" },
  { id: "avatar_3", icon: "diamond", label: "Patron" },
  { id: "avatar_4", icon: "color-palette", label: "Curator" },
  { id: "avatar_5", icon: "star", label: "VIP" },
  { id: "avatar_6", icon: "sparkles", label: "Master" },
];

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar_1");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
      setPhone(user.billing?.phone || "");
      setSelectedAvatar(user.avatar_url || "avatar_1");
    }
  }, [user, visible]);

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setErrorMessage(null);
    onClose();
  };

  const handleSave = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanFirst) {
      setErrorMessage("Please enter your first name.");
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
        email: cleanEmail,
        phone: cleanPhone,
        avatarUrl: selectedAvatar,
      });

      Alert.alert(
        "Profile Updated",
        "Your collector profile and contact information have been updated successfully.",
        [{ text: "OK", onPress: handleClose }]
      );
    } catch (err: any) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <StatusBar barStyle={colors.statusBar} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* HEADER */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.headerBackground,
                borderBottomColor: colors.borderLight,
              },
            ]}
          >
            <Pressable
              style={[
                styles.backButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handleClose}
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>
                ACCOUNT SETTINGS
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Edit Profile
              </Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* AVATAR SELECTION */}
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardHeading, { color: colors.gold }]}>
                PROFILE AVATAR
              </Text>
              <Text
                style={[styles.cardSubtitle, { color: colors.textSecondary }]}
              >
                Choose your official Primo collector badge avatar:
              </Text>

              <View style={styles.avatarRow}>
                {LUXURY_AVATARS.map((av) => {
                  const isSelected = selectedAvatar === av.id;
                  return (
                    <Pressable
                      key={av.id}
                      style={[
                        styles.avatarOption,
                        {
                          backgroundColor: isSelected
                            ? colors.goldSoft
                            : colors.backgroundElement,
                          borderColor: isSelected
                            ? colors.gold
                            : colors.border,
                        },
                      ]}
                      onPress={() => {
                        try {
                          void Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light
                          );
                        } catch {}
                        setSelectedAvatar(av.id);
                      }}
                    >
                      <Ionicons
                        name={av.icon as any}
                        size={22}
                        color={isSelected ? colors.gold : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.avatarLabel,
                          {
                            color: isSelected
                              ? colors.gold
                              : colors.textSecondary,
                            fontFamily: isSelected
                              ? FONTS.sansBold
                              : FONTS.sansRegular,
                          },
                        ]}
                      >
                        {av.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* FORM CARD */}
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardHeading, { color: colors.gold }]}>
                PERSONAL DETAILS
              </Text>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#C0392B" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* FIRST NAME */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  FIRST NAME
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={colors.gold}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="First Name"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>

              {/* LAST NAME */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  LAST NAME
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={colors.gold}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Last Name"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              {/* EMAIL */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  EMAIL ADDRESS
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={colors.gold}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Email address"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* PHONE */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  TELEPHONE / WHATSAPP NUMBER
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={colors.gold}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="e.g. +91 98765 43210"
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* SAVE BUTTON */}
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.gold },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  isSaving && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>SAVE PROFILE</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 19,
    fontFamily: FONTS.serifBold,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 60,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  cardHeading: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.3,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.sansRegular,
    marginTop: -8,
  },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  avatarOption: {
    width: "30.5%",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  avatarLabel: {
    fontSize: 11,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDF2F2",
    borderWidth: 1,
    borderColor: "#F5C6CB",
    padding: 12,
    borderRadius: 14,
  },
  errorBannerText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
  inputContainer: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  fieldIcon: {
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  saveButton: {
    height: 50,
    marginTop: 8,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
});
