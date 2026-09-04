import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export const ADDRESS_TYPES = ["Home", "Office", "Studio", "Gallery"];

export type AddressEntryFormProps = {
  editingId: string | null;
  title: string;
  setTitle: (title: string) => void;
  fullName: string;
  setFullName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  addressLine1: string;
  setAddressLine1: (line1: string) => void;
  addressLine2: string;
  setAddressLine2: (line2: string) => void;
  city: string;
  setCity: (city: string) => void;
  stateName: string;
  setStateName: (state: string) => void;
  pincode: string;
  setPincode: (pincode: string) => void;
  isDefault: boolean;
  setIsDefault: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string | null;
  onCancel: () => void;
  onSave: () => void;
};

export function AddressEntryForm({
  editingId,
  title,
  setTitle,
  fullName,
  setFullName,
  phone,
  setPhone,
  addressLine1,
  setAddressLine1,
  addressLine2,
  setAddressLine2,
  city,
  setCity,
  stateName,
  setStateName,
  pincode,
  setPincode,
  isDefault,
  setIsDefault,
  errorMessage,
  onCancel,
  onSave,
}: AddressEntryFormProps) {
  const { colors } = useAppTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formScroll}
      >
        <View
          style={[
            styles.formCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.formHeading, { color: colors.gold }]}>
            {editingId ? "EDIT ADDRESS" : "ADD NEW ADDRESS"}
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#C0392B" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* ADDRESS TYPE CHIPS */}
          <View style={styles.typeChipsRow}>
            {ADDRESS_TYPES.map((t) => {
              const isSelected = title === t;
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isSelected
                        ? colors.gold
                        : colors.backgroundElement,
                      borderColor: isSelected ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setTitle(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: isSelected ? "#FFFFFF" : colors.text,
                        fontFamily: isSelected
                          ? FONTS.sansBold
                          : FONTS.sansRegular,
                      },
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* FULL NAME */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              RECIPIENT FULL NAME
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Atul Pandey"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* PHONE */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              CONTACT TELEPHONE
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* ADDRESS LINE 1 */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              STREET ADDRESS / BUILDING / SUITE
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Flat 402, Royal Palms Residency"
              placeholderTextColor={colors.textMuted}
              value={addressLine1}
              onChangeText={setAddressLine1}
            />
          </View>

          {/* ADDRESS LINE 2 */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              LANDMARK / AREA (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Near City Center"
              placeholderTextColor={colors.textMuted}
              value={addressLine2}
              onChangeText={setAddressLine2}
            />
          </View>

          {/* CITY & STATE ROW */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                CITY
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. New Delhi"
                placeholderTextColor={colors.textMuted}
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                STATE
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. Delhi"
                placeholderTextColor={colors.textMuted}
                value={stateName}
                onChangeText={setStateName}
              />
            </View>
          </View>

          {/* PINCODE */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              PIN CODE
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. 110001"
              placeholderTextColor={colors.textMuted}
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
            />
          </View>

          {/* DEFAULT TOGGLE */}
          <Pressable
            style={styles.defaultCheckboxRow}
            onPress={() => setIsDefault((prev) => !prev)}
          >
            <Ionicons
              name={isDefault ? "checkbox" : "square-outline"}
              size={22}
              color={isDefault ? colors.gold : colors.textSecondary}
            />
            <Text style={[styles.defaultCheckboxText, { color: colors.text }]}>
              Set as default delivery address
            </Text>
          </Pressable>

          {/* BUTTONS */}
          <View style={styles.formButtonRow}>
            <Pressable
              style={[
                styles.cancelFormBtn,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[styles.cancelFormBtnText, { color: colors.text }]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={[styles.saveAddressBtn, { backgroundColor: colors.gold }]}
              onPress={onSave}
            >
              <Text style={styles.saveAddressBtnText}>SAVE ADDRESS</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  formScroll: {
    padding: 20,
    paddingBottom: 60,
  },
  formCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
  },
  formHeading: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.2,
  },
  typeChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipText: {
    fontSize: 12,
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
  textInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
  },
  defaultCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingVertical: 6,
  },
  defaultCheckboxText: {
    fontSize: 13,
    fontFamily: FONTS.sansMedium,
  },
  formButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  cancelFormBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelFormBtnText: {
    fontSize: 13,
    fontFamily: FONTS.sansBold,
  },
  saveAddressBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  saveAddressBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.1,
  },
});
