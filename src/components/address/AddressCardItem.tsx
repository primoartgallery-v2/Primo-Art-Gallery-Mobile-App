import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { UserAddress } from "@/services/address";

export type AddressCardItemProps = {
  item: UserAddress;
  onEdit: (item: UserAddress) => void;
  onDelete: (id: string, title: string) => void;
  onSetDefault: (id: string) => void;
};

export function AddressCardItem({
  item,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressCardItemProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.addressCard,
        {
          backgroundColor: colors.card,
          borderColor: item.isDefault ? colors.gold : colors.border,
        },
      ]}
    >
      <View style={styles.addressHeaderRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons
            name={item.title === "Office" ? "business-outline" : "home-outline"}
            size={18}
            color={colors.gold}
          />
          <Text style={[styles.addressTitle, { color: colors.text }]}>
            {item.title}
          </Text>
        </View>

        {item.isDefault ? (
          <View
            style={[
              styles.defaultBadge,
              {
                backgroundColor: colors.goldBadge,
                borderColor: colors.gold,
              },
            ]}
          >
            <Text
              style={[
                styles.defaultBadgeText,
                { color: colors.goldBadgeText },
              ]}
            >
              DEFAULT
            </Text>
          </View>
        ) : (
          <Pressable
            style={styles.setDefaultBtn}
            onPress={() => onSetDefault(item.id)}
          >
            <Text
              style={[
                styles.setDefaultBtnText,
                { color: colors.gold },
              ]}
            >
              Set as Default
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.recipientName, { color: colors.text }]}>
        {item.fullName}
      </Text>
      <Text style={[styles.addressLines, { color: colors.textSecondary }]}>
        {item.addressLine1}
        {item.addressLine2 ? `, ${item.addressLine2}` : ""}
      </Text>
      <Text style={[styles.addressCityState, { color: colors.textSecondary }]}>
        {item.city}, {item.state} - {item.pincode}
      </Text>
      <Text style={[styles.addressPhone, { color: colors.textSecondary }]}>
        📞 {item.phone}
      </Text>

      {/* CARD ACTIONS */}
      <View
        style={[
          styles.cardActionsRow,
          { borderTopColor: colors.borderLight },
        ]}
      >
        <Pressable
          style={styles.actionBtn}
          onPress={() => onEdit(item)}
        >
          <Ionicons
            name="create-outline"
            size={15}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: colors.textSecondary },
            ]}
          >
            Edit
          </Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => onDelete(item.id, item.title)}
        >
          <Ionicons
            name="trash-outline"
            size={15}
            color="#C0392B"
          />
          <Text style={[styles.actionBtnText, { color: "#C0392B" }]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addressCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  addressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.sansExtraBold,
    letterSpacing: 0.8,
  },
  setDefaultBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  setDefaultBtnText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
  recipientName: {
    fontSize: 15,
    fontFamily: FONTS.sansBold,
    marginTop: 2,
  },
  addressLines: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
    lineHeight: 18,
  },
  addressCityState: {
    fontSize: 13,
    fontFamily: FONTS.sansRegular,
  },
  addressPhone: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    marginTop: 4,
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 18,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: FONTS.sansBold,
  },
});
