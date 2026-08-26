import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
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
import {
  deleteAddress,
  getStoredAddresses,
  saveAddress,
  setDefaultAddress,
  type UserAddress,
} from "@/services/address";

type ManageAddressModalProps = {
  visible: boolean;
  onClose: () => void;
};

const ADDRESS_TYPES = ["Home", "Office", "Studio", "Gallery"];

export function ManageAddressModal({
  visible,
  onClose,
}: ManageAddressModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const currentUserId = user?.id ? String(user.id) : null;

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("Home");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAddresses = async () => {
    const list = await getStoredAddresses(currentUserId);
    setAddresses(list);
  };

  useEffect(() => {
    if (visible) {
      loadAddresses();
      setShowAddForm(false);
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("Home");
    setFullName("");
    setPhone("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setStateName("");
    setPincode("");
    setIsDefault(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  const handleStartAdd = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    resetForm();
    setShowAddForm(true);
  };

  const handleStartEdit = (item: UserAddress) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setEditingId(item.id);
    setTitle(item.title || "Home");
    setFullName(item.fullName);
    setPhone(item.phone);
    setAddressLine1(item.addressLine1);
    setAddressLine2(item.addressLine2 || "");
    setCity(item.city);
    setStateName(item.state);
    setPincode(item.pincode);
    setIsDefault(item.isDefault);
    setShowAddForm(true);
  };

  const handleSetDefault = async (id: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const updated = await setDefaultAddress(id, currentUserId);
    setAddresses(updated);
  };

  const handleDelete = (id: string, addrName: string) => {
    Alert.alert(
      "Delete Address",
      `Are you sure you want to remove "${addrName}" from your address book?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            const updated = await deleteAddress(id, currentUserId);
            setAddresses(updated);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage("Please enter recipient full name.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }
    if (!addressLine1.trim()) {
      setErrorMessage("Please enter street address.");
      return;
    }
    if (!city.trim()) {
      setErrorMessage("Please enter city.");
      return;
    }
    if (!stateName.trim()) {
      setErrorMessage("Please enter state.");
      return;
    }
    if (!pincode.trim()) {
      setErrorMessage("Please enter PIN / postal code.");
      return;
    }

    const updated = await saveAddress(
      {
        id: editingId || undefined,
        title,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state: stateName,
        pincode,
        country: "India",
        isDefault,
      },
      currentUserId
    );

    setAddresses(updated);
    setShowAddForm(false);
    resetForm();
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
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>
              COLLECTOR DELIVERIES
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Manage Addresses
            </Text>
          </View>

          <Pressable
            style={[
              styles.addHeaderBtn,
              { backgroundColor: colors.goldSoft, borderColor: colors.gold },
            ]}
            onPress={handleStartAdd}
          >
            <Ionicons name="add" size={18} color={colors.gold} />
          </Pressable>
        </View>

        {showAddForm ? (
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
                            borderColor: isSelected
                              ? colors.gold
                              : colors.border,
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
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
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
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
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
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
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
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
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
                      style={[
                        styles.fieldLabel,
                        { color: colors.textSecondary },
                      ]}
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
                      style={[
                        styles.fieldLabel,
                        { color: colors.textSecondary },
                      ]}
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
                  <Text
                    style={[styles.fieldLabel, { color: colors.textSecondary }]}
                  >
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
                  <Text
                    style={[
                      styles.defaultCheckboxText,
                      { color: colors.text },
                    ]}
                  >
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
                    onPress={() => setShowAddForm(false)}
                  >
                    <Text
                      style={[
                        styles.cancelFormBtnText,
                        { color: colors.text },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.saveAddressBtn,
                      { backgroundColor: colors.gold },
                    ]}
                    onPress={handleSave}
                  >
                    <Text style={styles.saveAddressBtnText}>SAVE ADDRESS</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Pressable
                style={[
                  styles.addNewCardBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleStartAdd}
              >
                <View
                  style={[
                    styles.addNewIconWrap,
                    {
                      backgroundColor: colors.goldSoft,
                      borderColor: colors.gold,
                    },
                  ]}
                >
                  <Ionicons name="add" size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.addNewTitle, { color: colors.text }]}
                  >
                    Add New Address
                  </Text>
                  <Text
                    style={[
                      styles.addNewSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    For gallery masterwork dispatch & provenance delivery
                  </Text>
                </View>
              </Pressable>
            }
            renderItem={({ item }) => {
              return (
                <View
                  style={[
                    styles.addressCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: item.isDefault
                        ? colors.gold
                        : colors.border,
                    },
                  ]}
                >
                  <View style={styles.addressHeaderRow}>
                    <View style={styles.titleWithIcon}>
                      <Ionicons
                        name={
                          item.title === "Office"
                            ? "business-outline"
                            : "home-outline"
                        }
                        size={18}
                        color={colors.gold}
                      />
                      <Text
                        style={[
                          styles.addressTitle,
                          { color: colors.text },
                        ]}
                      >
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
                        onPress={() => handleSetDefault(item.id)}
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

                  <Text
                    style={[styles.recipientName, { color: colors.text }]}
                  >
                    {item.fullName}
                  </Text>
                  <Text
                    style={[
                      styles.addressLines,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.addressLine1}
                    {item.addressLine2 ? `, ${item.addressLine2}` : ""}
                  </Text>
                  <Text
                    style={[
                      styles.addressCityState,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.city}, {item.state} - {item.pincode}
                  </Text>
                  <Text
                    style={[styles.addressPhone, { color: colors.textSecondary }]}
                  >
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
                      onPress={() => handleStartEdit(item)}
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
                      onPress={() => handleDelete(item.id, item.title)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color="#C0392B"
                      />
                      <Text
                        style={[styles.actionBtnText, { color: "#C0392B" }]}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}
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
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  addNewCardBtn: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  addNewIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addNewTitle: {
    fontSize: 14,
    fontFamily: FONTS.sansBold,
  },
  addNewSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.sansRegular,
    marginTop: 2,
  },
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
