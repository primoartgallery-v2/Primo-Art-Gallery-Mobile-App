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

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { sendOtp, setPendingRegistration } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (phone.trim() && phone.replace(/[^\d]/g, "").length < 8) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate();
  };

  const handleSignUp = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setBackendError(null);

    setTouched({
      fullName: true,
      email: true,
      password: true,
      phone: true,
    });

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Store sensitive registration payload strictly in RAM (AuthContext)
      setPendingRegistration({
        email: cleanEmail,
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      await sendOtp(cleanEmail);

      // Navigate to /verify-otp with ONLY the email parameter (No password in navigation params)
      router.push({
        pathname: "/verify-otp" as any,
        params: {
          email: cleanEmail,
        },
      });
    } catch (err: any) {
      const msg =
        err instanceof Error ? err.message : "Unable to register. Please try again.";
      setBackendError(msg);
    } finally {
      setIsSubmitting(false);
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
        {/* HEADER */}
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
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* BRAND HERO */}
          <View style={styles.brandHero}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>PRIMO ART GALLERY</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Join Primo Collectors</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Experience curated contemporary art, private previews, and bespoke acquisition advisory.
            </Text>
          </View>

          {/* FORM FIELDS */}
          <View style={styles.formContainer}>
            {/* FULL NAME */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  touched.fullName && errors.fullName && styles.inputError,
                ]}
              >
                <Ionicons name="person-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="e.g. Manik Haldar"
                  placeholderTextColor={colors.textMuted}
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    if (touched.fullName) validate();
                  }}
                  onBlur={() => handleBlur("fullName")}
                  autoCapitalize="words"
                />
              </View>
              {touched.fullName && errors.fullName ? (
                <Text style={styles.errorText}>{errors.fullName}</Text>
              ) : null}
            </View>

            {/* EMAIL */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  touched.email && errors.email && styles.inputError,
                ]}
              >
                <Ionicons name="mail-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="e.g. collector@primoartgallery.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (touched.email) validate();
                  }}
                  onBlur={() => handleBlur("email")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {touched.email && errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>

            {/* PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CREATE PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  touched.password && errors.password && styles.inputError,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text, paddingRight: 40 }]}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (touched.password) validate();
                  }}
                  onBlur={() => handleBlur("password")}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
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
              {touched.password && errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
            </View>

            {/* PHONE NUMBER (OPTIONAL) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                PHONE NUMBER (OPTIONAL)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  touched.phone && errors.phone && styles.inputError,
                ]}
              >
                <Ionicons name="call-outline" size={19} color={colors.gold} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (touched.phone) validate();
                  }}
                  onBlur={() => handleBlur("phone")}
                  keyboardType="phone-pad"
                />
              </View>
              {touched.phone && errors.phone ? (
                <Text style={styles.errorText}>{errors.phone}</Text>
              ) : null}
            </View>

            {/* BACKEND ERROR BANNER */}
            {backendError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#C0392B" />
                <Text style={styles.errorBannerText}>{backendError}</Text>
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
              onPress={handleSignUp}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>CONTINUE WITH EMAIL OTP</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* SWITCH TO LOGIN */}
            <View style={styles.switchAuthRow}>
              <Text style={[styles.switchAuthPrompt, { color: colors.textSecondary }]}>Already have an account?</Text>
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
  screen: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE0",
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
  headerSpacer: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 80,
  },
  brandHero: {
    marginBottom: 26,
  },
  eyebrow: {
    color: "#B8964E",
    fontSize: 10,
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#77736B",
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  inputContainer: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: "#C0392B",
  },
  fieldIcon: {
    marginRight: 10,
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
  errorText: {
    color: "#C0392B",
    fontSize: 11,
    fontFamily: FONTS.sansSemiBold,
    marginTop: 2,
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
    marginTop: 4,
  },
  errorBannerText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    lineHeight: 16,
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
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
