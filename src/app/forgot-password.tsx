import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { sendOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSendResetCode = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      await sendOtp(cleanEmail);
      setStep(2);
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (err: any) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to send reset code. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(cleanEmail, cleanOtp, newPassword);
      setSuccessMessage("Password reset successfully! Redirecting...");
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      setTimeout(() => {
        router.replace("/" as any);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Please check your verification code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoid}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: colors.headerBackground, borderBottomColor: colors.borderLight },
          ]}
        >
          <Pressable
            style={[
              styles.backButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {
              if (step === 2) {
                setStep(1);
                setErrorMessage(null);
              } else {
                router.back();
              }
            }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 1 ? "Forgot Password" : "Reset Password"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandHero}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>SECURITY & RECOVERY</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {step === 1 ? "Recover Access" : "Set New Password"}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              {step === 1
                ? "Enter your collector email address to receive a secure 6-digit reset code."
                : `Enter the 6-digit code sent to ${email} and choose your new password.`}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#C0392B" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={[styles.errorBanner, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text style={[styles.errorBannerText, { color: "#16A34A" }]}>{successMessage}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              /* STEP 1: EMAIL */
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="mail-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="e.g. yourmail@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={handleSendResetCode}
                      returnKeyType="go"
                    />
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: colors.gold },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSendResetCode}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>SEND RESET CODE</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              /* STEP 2: OTP + NEW PASSWORD */
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>6-DIGIT VERIFICATION CODE</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="shield-checkmark-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text, letterSpacing: 4, fontFamily: FONTS.sansBold }]}
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={otp}
                      onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NEW PASSWORD</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="lock-closed-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text, paddingRight: 40 }]}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor={colors.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={styles.eyeIconBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CONFIRM NEW PASSWORD</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="lock-closed-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text, paddingRight: 40 }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={colors.textMuted}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={handleResetPassword}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: colors.gold },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>RESET PASSWORD & SIGN IN</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.resendBtn}
                  onPress={handleSendResetCode}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.resendBtnText, { color: colors.gold }]}>
                    Didn't receive code? Resend Code
                  </Text>
                </Pressable>
              </>
            )}

            <View style={styles.switchAuthRow}>
              <Text style={[styles.switchAuthPrompt, { color: colors.textSecondary }]}>Return to</Text>
              <Pressable onPress={() => router.replace("/login" as any)}>
                <Text style={[styles.switchAuthLink, { color: colors.gold }]}>Sign In</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF8F3" },
  keyboardAvoid: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE0",
    backgroundColor: "#FAF8F3",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 20,
  },
  headerSpacer: { width: 38 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
  },
  brandHero: {
    marginBottom: 26,
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.8,
  },
  heroTitle: {
    marginTop: 6,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 30,
  },
  heroSubtitle: {
    marginTop: 6,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 19,
  },
  formContainer: {
    gap: 16,
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
    marginBottom: 4,
  },
  errorBannerText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    lineHeight: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  inputContainer: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D8",
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
    color: "#252525",
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  eyeIconBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  resendBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  resendBtnText: {
    fontSize: 12,
    fontFamily: FONTS.sansSemiBold,
  },
  submitButton: {
    height: 52,
    marginTop: 8,
    borderRadius: 26,
    backgroundColor: "#B8964E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
  switchAuthRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  switchAuthPrompt: {
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  switchAuthLink: {
    color: "#B8964E",
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
});
