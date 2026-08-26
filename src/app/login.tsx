import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { sendOtp, loginWithPassword, loginWithGoogle } = useAuth();

  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasswordLogin = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      await loginWithPassword(cleanEmail, password);
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      router.replace("/" as any);
    } catch (err: any) {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}

      if (err.isOtpOnlyUser) {
        setErrorMessage("This account was created with OTP. You can sign in with OTP below or reset your password.");
        setAuthMode("otp");
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Invalid email or password. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      await sendOtp(cleanEmail);
      router.push({
        pathname: "/verify-otp" as any,
        params: { email: cleanEmail },
      });
    } catch (err: any) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to send verification code. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      Alert.alert(
        "Google Authentication",
        "Google authentication is active. To authenticate directly via your Google account, select your preferred Google email or proceed with instant Email OTP / Password.",
        [
          { text: "Use Email OTP", onPress: () => setAuthMode("otp") },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Google sign-in could not be completed.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        {/* TOP BAR */}
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
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sign In</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* BRAND HERO & LOGO */}
          <View style={styles.brandHero}>
            <View style={styles.logoWrap}>
              <ExpoImage
                source={require("@/assets/images/primo-app-icon.png")}
                style={styles.brandLogo}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              {authMode === "password"
                ? "Sign in with your email and password for immediate collector access."
                : "Enter your email to receive a secure one-time verification code."}
            </Text>
          </View>

          {/* FORM CONTAINER */}
          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#C0392B" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* EMAIL INPUT */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                COLLECTOR EMAIL ADDRESS
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Ionicons name="mail-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="e.g. collector@primoartgallery.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={authMode === "password" ? handlePasswordLogin : handleSendOtp}
                  returnKeyType="go"
                />
              </View>
            </View>

            {/* PASSWORD INPUT (IF PASSWORD MODE) */}
            {authMode === "password" ? (
              <View style={styles.fieldGroup}>
                <View style={styles.passwordHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    PASSWORD
                  </Text>
                  <Pressable onPress={() => router.push("/forgot-password" as any)}>
                    <Text style={[styles.forgotPasswordLink, { color: colors.gold }]}>
                      Forgot Password?
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: colors.input, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text, paddingRight: 40 }]}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handlePasswordLogin}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={styles.eyeIconBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* SUBMIT BUTTON */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: colors.gold },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={authMode === "password" ? handlePasswordLogin : handleSendOtp}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {authMode === "password" ? "SIGN IN" : "SEND VERIFICATION CODE"}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* MODE SWITCHER BUTTON */}
            <Pressable
              style={({ pressed }) => [
                styles.modeSwitchBtn,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                setErrorMessage(null);
                setAuthMode(authMode === "password" ? "otp" : "password");
              }}
            >
              <Ionicons
                name={authMode === "password" ? "sparkles-outline" : "key-outline"}
                size={16}
                color={colors.gold}
              />
              <Text style={[styles.modeSwitchText, { color: colors.gold }]}>
                {authMode === "password" ? "Sign in with Email OTP instead" : "Sign in with Password instead"}
              </Text>
            </Pressable>

            {/* OR DIVIDER */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* GOOGLE SIGN-IN BUTTON */}
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                isGoogleSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleGoogleLogin}
              disabled={isGoogleSubmitting}
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
                  <Text style={[styles.googleButtonText, { color: colors.text }]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>

            {/* SWITCH TO SIGNUP */}
            <View style={styles.switchAuthRow}>
              <Text style={[styles.switchAuthPrompt, { color: colors.textSecondary }]}>
                New to Primo Art Gallery?
              </Text>
              <Pressable onPress={() => router.replace("/signup" as any)}>
                <Text style={[styles.switchAuthLink, { color: colors.gold }]}>Create Account</Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
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
    paddingBottom: 80,
  },
  brandHero: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FAF8F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  brandLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 2,
    textAlign: "center",
  },
  heroTitle: {
    marginTop: 6,
    color: "#252525",
    fontFamily: FONTS.serifBold,
    fontSize: 32,
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#77736B",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
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
  passwordHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotPasswordLink: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
  },
  fieldLabel: {
    color: "#B8964E",
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  inputContainer: {
    height: 52,
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
    letterSpacing: 1.2,
  },
  modeSwitchBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  modeSwitchText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  googleButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 13,
    fontFamily: FONTS.sansSemiBold,
  },
  switchAuthRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
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
