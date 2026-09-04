import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export type PricePreset = {
  id: string;
  label: string;
  minPrice?: number;
  maxPrice?: number;
};

export const PRICE_PRESETS: PricePreset[] = [
  { id: "all", label: "All Prices" },
  { id: "under_50k", label: "Under ₹50,000", maxPrice: 50000 },
  { id: "50k_200k", label: "₹50,000 – ₹2,00,000", minPrice: 50000, maxPrice: 200000 },
  { id: "200k_1000k", label: "₹2,00,000 – ₹10,00,000", minPrice: 200000, maxPrice: 1000000 },
  { id: "above_1000k", label: "₹10,00,000+", minPrice: 1000000 },
];

export type ExplorePriceFilterModalProps = {
  visible: boolean;
  selectedPresetId: string;
  customMinInput: string;
  customMaxInput: string;
  onSelectPreset: (preset: PricePreset) => void;
  onChangeMinInput: (val: string) => void;
  onChangeMaxInput: (val: string) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
};

export function ExplorePriceFilterModal({
  visible,
  selectedPresetId,
  customMinInput,
  customMaxInput,
  onSelectPreset,
  onChangeMinInput,
  onChangeMaxInput,
  onReset,
  onApply,
  onClose,
}: ExplorePriceFilterModalProps) {
  const { colors } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.priceSheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.priceSheetHeader}>
            <View>
              <Text style={[styles.priceSheetEyebrow, { color: colors.gold }]}>PRICE RANGE (INR ₹)</Text>
              <Text style={[styles.priceSheetTitle, { color: colors.text }]}>Filter by Value</Text>
            </View>
            <Pressable
              style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* PRESETS LIST */}
          <Text style={[styles.priceSectionLabel, { color: colors.textSecondary }]}>
            CURATED PRESETS
          </Text>
          <View style={styles.presetsGrid}>
            {PRICE_PRESETS.map((preset) => {
              const active = selectedPresetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => onSelectPreset(preset)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: active ? colors.goldSoft : colors.background,
                      borderColor: active ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      { color: active ? colors.gold : colors.text },
                      active && { fontFamily: FONTS.sansBold },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* CUSTOM INR RANGE */}
          <Text style={[styles.priceSectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>
            CUSTOM INR RANGE
          </Text>
          <View style={styles.customPriceRow}>
            <View style={[styles.priceInputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.gold }]}>₹</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="Min Price"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customMinInput}
                onChangeText={onChangeMinInput}
              />
            </View>
            <Text style={[styles.priceDivider, { color: colors.textSecondary }]}>–</Text>
            <View style={[styles.priceInputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.gold }]}>₹</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="Max Price"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customMaxInput}
                onChangeText={onChangeMaxInput}
              />
            </View>
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.priceActionRow}>
            <Pressable
              style={[styles.resetPriceBtn, { borderColor: colors.border }]}
              onPress={onReset}
            >
              <Text style={[styles.resetPriceBtnText, { color: colors.textSecondary }]}>RESET</Text>
            </Pressable>
            <Pressable
              style={[styles.applyPriceBtn, { backgroundColor: colors.gold }]}
              onPress={onApply}
            >
              <Text style={styles.applyPriceBtnText}>APPLY PRICE FILTER</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  priceSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  priceSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  priceSheetEyebrow: {
    fontSize: 10,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1.5,
  },
  priceSheetTitle: {
    fontSize: 20,
    fontFamily: FONTS.serifBold,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  priceSectionLabel: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
  },
  customPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceInputBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  priceDivider: {
    fontSize: 16,
    fontFamily: FONTS.sansBold,
  },
  priceActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    marginBottom: Platform.OS === "ios" ? 16 : 6,
  },
  resetPriceBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetPriceBtnText: {
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
  applyPriceBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyPriceBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 1,
  },
});
