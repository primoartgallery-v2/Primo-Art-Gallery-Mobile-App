import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddressCardItem } from "@/components/address/AddressCardItem";
import { AddressEntryForm } from "@/components/address/AddressEntryForm";
import { FONTS } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  deleteAddress,
  getCloudAddresses,
  getStoredAddresses,
  saveAddress,
  setDefaultAddress,
  syncPendingAddressesToCloud,
  type UserAddress,
} from "@/services/address";

type ManageAddressModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ManageAddressModal({
  visible,
  onClose,
}: ManageAddressModalProps) {
  const { colors } = useAppTheme();
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

  const loadAddresses = useCallback(async () => {
    const list = await getStoredAddresses(currentUserId);
    setAddresses(list);

    if (currentUserId) {
      void syncPendingAddressesToCloud(currentUserId);
      getCloudAddresses()
        .then((cloudList) => {
          if (cloudList && cloudList.length > 0) {
            setAddresses(cloudList);
          }
        })
        .catch(() => {});
    }
  }, [currentUserId]);

  useEffect(() => {
    if (visible) {
      void loadAddresses();
      setShowAddForm(false);
      resetForm();
    }
  }, [visible, loadAddresses]);

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
          <AddressEntryForm
            editingId={editingId}
            title={title}
            setTitle={setTitle}
            fullName={fullName}
            setFullName={setFullName}
            phone={phone}
            setPhone={setPhone}
            addressLine1={addressLine1}
            setAddressLine1={setAddressLine1}
            addressLine2={addressLine2}
            setAddressLine2={setAddressLine2}
            city={city}
            setCity={setCity}
            stateName={stateName}
            setStateName={setStateName}
            pincode={pincode}
            setPincode={setPincode}
            isDefault={isDefault}
            setIsDefault={setIsDefault}
            errorMessage={errorMessage}
            onCancel={() => setShowAddForm(false)}
            onSave={handleSave}
          />
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
                  <Text style={[styles.addNewTitle, { color: colors.text }]}>
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
            renderItem={({ item }) => (
              <AddressCardItem
                item={item}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            )}
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
});
