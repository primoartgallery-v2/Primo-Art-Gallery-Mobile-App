import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; fullName?: string; phone?: string }>();
  const email = (params.email || "").trim().toLowerCase();
  const fullName = (params.fullName || "").trim();
  const phone = (params.phone || "").trim();

  const { colors } = useAppTheme();
  const { verifyOtp, sendOtp, updateProfile } = useAuth();

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(60);
  const cooldownTargetRef = useRef<number>(Date.now() + 60 * 1000);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMinutes, setLockMinutes] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [collectorName, setCollectorName] = useState("");

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // 60-second real-time timestamp countdown (persists accurately when app goes to background / Gmail)
  useEffect(() => {
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownTargetRef.current - Date.now()) / 1000));
      setCooldown(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        updateRemaining();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);

  const handleDigitChange = (text: string, index: number) => {
    setErrorMessage(null);

    // Handle full paste
    if (text.length > 1) {
      const clean = text.replace(/[^0-9]/g, "").slice(0, 6);
      if (clean.length > 0) {
        const newDigits = [...digits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = clean[i] || "";
        }
        setDigits(newDigits);
        if (clean.length === 6) {
          inputRefs.current[5]?.blur();
          void submitOtp(newDigits.join(""));
        } else {
          inputRefs.current[Math.min(clean.length, 5)]?.focus();
        }
        return;
      }
    }

    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits filled, auto-submit
    const fullCode = newDigits.join("");
    if (fullCode.length === 6) {
      void submitOtp(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    if (isVerifying || isLocked) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits of your verification code.");
      return;
    }

    setIsVerifying(true);

    try {
      let user = await verifyOtp(email, code);
      if (fullName || phone) {
        try {
          const parts = fullName.split(" ");
          const firstName = parts[0] || user.first_name || "Collector";
          const lastName = parts.slice(1).join(" ") || "";
          user = await updateProfile({
            firstName,
            lastName,
            email: user.email,
            phone: phone || user.billing?.phone || "",
            avatarUrl: user.avatar_url,
          });
        } catch (profileErr) {
          console.warn("[VerifyOtp] Profile save notice:", profileErr);
        }
      }
      const displayName = fullName || user.first_name || (user.email ? user.email.split("@")[0] : "Collector");
      setCollectorName(displayName);
      setIsSuccess(true);
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 400);
    } catch (err: any) {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}

      if (err.locked) {
        setIsLocked(true);
        setLockMinutes(err.remainingMinutes || 30);
      }

      setErrorMessage(
        err.message || "Invalid verification code. Please check and try again."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending || isLocked) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setErrorMessage(null);
    setIsResending(true);

    try {
      await sendOtp(email);
      cooldownTargetRef.current = Date.now() + 60 * 1000;
      setCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      Alert.alert("Code Resent", `A fresh 6-digit verification code has been dispatched to ${email}.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resend code. Please try again later.");
    } finally {
      setIsResending(false);
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
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Code</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* HERO */}
          <View style={styles.brandHero}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <Ionicons
                name={isSuccess ? "checkmark-circle" : "shield-checkmark"}
                size={34}
                color={isSuccess ? colors.success : colors.gold}
              />
            </View>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>SECURITY VERIFICATION</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Enter 6-Digit Code</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              We sent a 6-digit verification code to:
            </Text>
            <Text style={[styles.emailHighlight, { color: colors.gold }]}>{email}</Text>
          </View>

          {/* ERROR BANNER */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#C0392B" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* LOCKOUT NOTICE */}
          {isLocked ? (
            <View style={styles.lockoutBanner}>
              <Ionicons name="lock-closed" size={20} color="#C0392B" />
              <Text style={styles.lockoutBannerText}>
                Account verification is temporarily locked. Please retry in {lockMinutes} minutes.
              </Text>
            </View>
          ) : null}

          {/* OTP 6-BOX INPUT ROW */}
          <View style={styles.otpBoxesRow}>
            {digits.map((digit, index) => {
              const isFocused = inputRefs.current[index]?.isFocused();
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: digit ? colors.goldSoft : colors.input,
                      borderColor: digit
                        ? colors.gold
                        : isFocused
                        ? colors.borderFocus
                        : colors.border,
                    },
                  ]}
                >
                  <TextInput
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    style={[
                      styles.otpTextInput,
                      { color: digit ? colors.gold : colors.text },
                    ]}
                    value={digit}
                    onChangeText={(val) => handleDigitChange(val, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    editable={!isVerifying && !isLocked}
                  />
                </View>
              );
            })}
          </View>

          {/* VERIFY BUTTON */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: isSuccess ? colors.success : colors.gold },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              (isVerifying || digits.join("").length !== 6 || isLocked) &&
                styles.submitButtonDisabled,
            ]}
            onPress={() => submitOtp(digits.join(""))}
            disabled={isVerifying || digits.join("").length !== 6 || isLocked}
          >
            {isVerifying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : isSuccess ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>VERIFIED SUCCESSFULLY</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitButtonText}>VERIFY & CONTINUE</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          {/* RESEND SECTION */}
          <View style={styles.resendContainer}>
            {cooldown > 0 ? (
              <Text style={[styles.cooldownText, { color: colors.textSecondary }]}>
                Resend code in <Text style={{ color: colors.gold, fontFamily: FONTS.sansBold }}>{cooldown}s</Text>
              </Text>
            ) : (
              <Pressable
                onPress={handleResend}
                disabled={isResending || isLocked}
                style={({ pressed }) => [
                  styles.resendButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                {isResending ? (
                  <ActivityIndicator color={colors.gold} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color={colors.gold} />
                    <Text style={[styles.resendButtonText, { color: colors.gold }]}>
                      Resend Verification Code
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* EXPIRY FOOTNOTE */}
          <Text style={[styles.footerNotice, { color: colors.textMuted }]}>
            Codes expire automatically after 10 minutes. For assistance, contact Primo Concierge.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* LUXURY WELCOME CELEBRATION MODAL */}
      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowWelcomeModal(false);
          router.replace("/profile");
        }}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.welcomeCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.gold,
              },
            ]}
          >
            {/* Luxury Gold Icon Emblem */}
            <View
              style={[
                styles.welcomeIconWrap,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <Ionicons name="sparkles" size={34} color={colors.gold} />
            </View>

            {/* Gold Eyebrow */}
            <Text style={[styles.welcomeEyebrow, { color: colors.gold }]}>
              EXCLUSIVE MEMBERSHIP ACTIVATED
            </Text>

            {/* Main Title */}
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Welcome to Primo
            </Text>

            {/* Personalized Greeting */}
            <Text style={[styles.welcomeGreeting, { color: colors.gold }]}>
              Hello, {collectorName || "Collector"}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
              Your private collector space, bespoke acquisitions advisory, and saved collection are ready.
            </Text>

            {/* Verified Email Chip */}
            <View
              style={[
                styles.verifiedChip,
                { backgroundColor: colors.goldSoft, borderColor: colors.gold },
              ]}
            >
              <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
              <Text style={[styles.verifiedChipText, { color: colors.gold }]}>{email}</Text>
            </View>

            {/* Continue Button */}
            <Pressable
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: colors.gold },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
                setShowWelcomeModal(false);
                router.replace("/profile");
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>ENTER THE GALLERY</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
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
    marginBottom: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 2,
    textAlign: "center",
  },
  heroTitle: {
    marginTop: 6,
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
  },
  emailHighlight: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: FONTS.sansBold,
    textAlign: "center",
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
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    lineHeight: 16,
  },
  lockoutBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FBEAEB",
    borderWidth: 1.5,
    borderColor: "#C0392B",
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  lockoutBannerText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  otpBoxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 18,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  otpTextInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: 24,
    fontFamily: FONTS.sansBold,
  },
  submitButton: {
    height: 52,
    marginTop: 12,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  resendContainer: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cooldownText: {
    fontSize: 13,
    fontFamily: FONTS.sansMedium,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendButtonText: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  footerNotice: {
    marginTop: 28,
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  welcomeIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 6,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: FONTS.serifBold,
    textAlign: "center",
    marginBottom: 4,
  },
  welcomeGreeting: {
    fontSize: 16,
    fontFamily: FONTS.serifSemiBold,
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  verifiedChipText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
  },
  modalPrimaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
});
