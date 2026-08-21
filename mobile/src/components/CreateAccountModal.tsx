import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import {
  X,
  Wallet,
  Utensils,
  ShoppingBag,
  CreditCard,
  Sparkles,
  TrendingUp,
  Target,
  Compass,
  Trash2,
} from "lucide-react-native";
import { useAccount } from "../context/AccountContext";
import { useAppTheme } from "../theme/ThemeContext";
import { Account } from "../db/sqlite";

const { height } = Dimensions.get("window");

const PRESET_NAMES = [
  { name: "Daily Savings", icon: "wallet", color: "#10b981", type: "budget" },
  { name: "Daily Food Expenses", icon: "utensils", color: "#f59e0b", type: "flex" },
  { name: "Normal Expenses", icon: "shopping-bag", color: "#3b82f6", type: "flex" },
  { name: "Travel & Fuel", icon: "trending-up", color: "#8b5cf6", type: "flex" },
];

const COLOR_OPTIONS = [
  "#10b981", // Emerald
  "#3b82f6", // Sky Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
];

const ICON_OPTIONS = [
  { id: "wallet", Icon: Wallet, label: "Wallet" },
  { id: "utensils", Icon: Utensils, label: "Food" },
  { id: "shopping-bag", Icon: ShoppingBag, label: "Shopping" },
  { id: "credit-card", Icon: CreditCard, label: "Card" },
  { id: "trending-up", Icon: TrendingUp, label: "Growth" },
  { id: "sparkles", Icon: Sparkles, label: "Special" },
];

export const CreateAccountModal: React.FC = () => {
  const {
    isCreateModalOpen,
    editingAccount,
    closeCreateModal,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useAccount();
  const { isDark } = useAppTheme();

  const [name, setName] = useState("");
  const [type, setType] = useState<"budget" | "flex">("flex");
  const [initialBalance, setInitialBalance] = useState("5000");
  const [dailyBudget, setDailyBudget] = useState("500");
  const [color, setColor] = useState("#10b981");
  const [icon, setIcon] = useState("wallet");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setInitialBalance(editingAccount.initialBalance.toString());
      setDailyBudget(editingAccount.dailyBudget.toString());
      setColor(editingAccount.color || "#10b981");
      setIcon(editingAccount.icon || "wallet");
    } else {
      setName("");
      setType("flex");
      setInitialBalance("5000");
      setDailyBudget("500");
      setColor("#3b82f6");
      setIcon("utensils");
    }
  }, [editingAccount, isCreateModalOpen]);

  const handleSelectPreset = (preset: typeof PRESET_NAMES[0]) => {
    setName(preset.name);
    setIcon(preset.icon);
    setColor(preset.color);
    setType(preset.type as "budget" | "flex");
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Account Name Required", "Please enter a name for this account.");
      return;
    }

    const numBalance = parseFloat(initialBalance.replace(/[^0-9.]/g, "")) || 0;
    const numDaily = parseFloat(dailyBudget.replace(/[^0-9.]/g, "")) || 0;

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount({
          ...editingAccount,
          name: trimmedName,
          type,
          initialBalance: numBalance,
          monthlyBudget: type === "budget" ? numBalance : 0,
          dailyBudget: type === "budget" ? numDaily : 0,
          color,
          icon,
        });
      } else {
        await createAccount({
          name: trimmedName,
          type,
          initialBalance: numBalance,
          dailyBudget: numDaily,
          color,
          icon,
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!editingAccount) return;
    Alert.alert(
      "Delete Account",
      `Are you sure you want to delete "${editingAccount.name}"? All associated expense records will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(editingAccount.id);
              closeCreateModal();
            } catch (e: any) {
              Alert.alert("Cannot Delete", e.message || "Unable to delete account.");
            }
          },
        },
      ]
    );
  };

  if (!isCreateModalOpen) return null;

  return (
    <Modal
      visible={isCreateModalOpen}
      transparent
      animationType="slide"
      onRequestClose={closeCreateModal}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={closeCreateModal}
          />

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#121318" : "#ffffff",
                borderColor: isDark ? "#27272a" : "#e4e4e7",
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? "#f4f4f5" : "#18181b" },
                  ]}
                >
                  {editingAccount ? "Edit Account" : "Create New Account"}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: isDark ? "#a1a1aa" : "#71717a" },
                  ]}
                >
                  {editingAccount
                    ? "Update settings and balance"
                    : "Separate budgets for food, savings, and normal expenses"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeCreateModal}
                style={[
                  styles.closeButton,
                  { backgroundColor: isDark ? "rgba(39, 39, 42, 0.6)" : "#f4f4f5" },
                ]}
              >
                <X size={16} color={isDark ? "#a1a1aa" : "#71717a"} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Presets Row */}
              {!editingAccount && (
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                    QUICK SUGGESTIONS
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetsRow}
                  >
                    {PRESET_NAMES.map((p, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleSelectPreset(p)}
                        activeOpacity={0.75}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isDark ? "#181a20" : "#f4f4f5",
                            borderColor: name === p.name ? p.color : isDark ? "#27272a" : "#e5e7eb",
                          },
                        ]}
                      >
                        <View style={[styles.presetDot, { backgroundColor: p.color }]} />
                        <Text
                          style={[
                            styles.presetText,
                            { color: isDark ? "#e4e4e7" : "#374151" },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Account Name */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                  ACCOUNT NAME
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Daily Food Expenses"
                  placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? "#181a20" : "#f9fafb",
                      borderColor: isDark ? "#27272a" : "#e5e7eb",
                      color: isDark ? "#f4f4f5" : "#18181b",
                    },
                  ]}
                />
              </View>

              {/* Mode Selector */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                  TRACKING MODE
                </Text>
                <View style={styles.modeCardsRow}>
                  {/* Track As You Go Card */}
                  <TouchableOpacity
                    onPress={() => setType("flex")}
                    activeOpacity={0.8}
                    style={[
                      styles.modeCard,
                      {
                        backgroundColor: type === "flex"
                          ? isDark
                            ? "rgba(59, 130, 246, 0.12)"
                            : "#eff6ff"
                          : isDark
                          ? "#181a20"
                          : "#f9fafb",
                        borderColor: type === "flex" ? "#3b82f6" : isDark ? "#27272a" : "#e5e7eb",
                      },
                    ]}
                  >
                    <View style={styles.modeHeader}>
                      <Compass size={18} color={type === "flex" ? "#3b82f6" : "#71717a"} />
                      {type === "flex" && (
                        <View style={[styles.modeSelectedDot, { backgroundColor: "#3b82f6" }]} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.modeTitle,
                        { color: type === "flex" ? (isDark ? "#93c5fd" : "#1d4ed8") : isDark ? "#e4e4e7" : "#374151" },
                      ]}
                    >
                      Track As You Go
                    </Text>
                    <Text style={[styles.modeDesc, { color: isDark ? "#a1a1aa" : "#6b7280" }]}>
                      No fixed daily limit. Just set available balance & track expenses normally.
                    </Text>
                  </TouchableOpacity>

                  {/* Fixed Daily Budget Card */}
                  <TouchableOpacity
                    onPress={() => setType("budget")}
                    activeOpacity={0.8}
                    style={[
                      styles.modeCard,
                      {
                        backgroundColor: type === "budget"
                          ? isDark
                            ? "rgba(16, 185, 129, 0.12)"
                            : "#ecfdf5"
                          : isDark
                          ? "#181a20"
                          : "#f9fafb",
                        borderColor: type === "budget" ? "#10b981" : isDark ? "#27272a" : "#e5e7eb",
                      },
                    ]}
                  >
                    <View style={styles.modeHeader}>
                      <Target size={18} color={type === "budget" ? "#10b981" : "#71717a"} />
                      {type === "budget" && (
                        <View style={[styles.modeSelectedDot, { backgroundColor: "#10b981" }]} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.modeTitle,
                        { color: type === "budget" ? (isDark ? "#6ee7b7" : "#047857") : isDark ? "#e4e4e7" : "#374151" },
                      ]}
                    >
                      Fixed Daily Budget
                    </Text>
                    <Text style={[styles.modeDesc, { color: isDark ? "#a1a1aa" : "#6b7280" }]}>
                      Set fixed daily limit. Track daily savings %, remaining budget & streaks.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Financial Inputs */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                  {type === "flex" ? "CURRENT AVAILABLE BALANCE" : "MONTHLY STARTING BALANCE"}
                </Text>
                <View
                  style={[
                    styles.amountInputWrapper,
                    {
                      backgroundColor: isDark ? "#181a20" : "#f9fafb",
                      borderColor: isDark ? "#27272a" : "#e5e7eb",
                    },
                  ]}
                >
                  <Text style={[styles.currencyPrefix, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                    ₹
                  </Text>
                  <TextInput
                    value={initialBalance}
                    onChangeText={(val) => {
                      const clean = val.replace(/[^0-9.]/g, "");
                      setInitialBalance(clean);
                      if (type === "budget") {
                        const num = parseFloat(clean) || 0;
                        setDailyBudget(Math.round(num / 30).toString());
                      }
                    }}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="0"
                    placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                    style={[
                      styles.amountTextInput,
                      { color: isDark ? "#ffffff" : "#111827" },
                    ]}
                  />
                </View>
              </View>

              {type === "budget" && (
                <View style={styles.fieldSection}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                      DAILY BUDGET LIMIT
                    </Text>
                    <Text style={styles.helperText}>
                      Auto-calculated: ₹{Math.round((parseFloat(initialBalance) || 0) / 30)}/day
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.amountInputWrapper,
                      {
                        backgroundColor: isDark ? "#181a20" : "#f9fafb",
                        borderColor: isDark ? "#27272a" : "#e5e7eb",
                      },
                    ]}
                  >
                    <Text style={[styles.currencyPrefix, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                      ₹
                    </Text>
                    <TextInput
                      value={dailyBudget}
                      onChangeText={(val) => setDailyBudget(val.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      placeholder="500"
                      placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                      style={[
                        styles.amountTextInput,
                        { color: isDark ? "#ffffff" : "#111827" },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Color & Icon Theme */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                  ACCENT COLOR
                </Text>
                <View style={styles.colorRow}>
                  {COLOR_OPTIONS.map((c, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setColor(c)}
                      activeOpacity={0.8}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c },
                        color === c && styles.colorSwatchActive,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#a1a1aa" : "#71717a" }]}>
                  ACCOUNT ICON
                </Text>
                <View style={styles.iconRow}>
                  {ICON_OPTIONS.map((opt) => {
                    const isSelected = icon === opt.id;
                    const IconComponent = opt.Icon;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setIcon(opt.id)}
                        activeOpacity={0.8}
                        style={[
                          styles.iconButton,
                          {
                            backgroundColor: isSelected
                              ? `${color}25`
                              : isDark
                              ? "#181a20"
                              : "#f4f4f5",
                            borderColor: isSelected ? color : isDark ? "#27272a" : "#e5e7eb",
                          },
                        ]}
                      >
                        <IconComponent
                          size={18}
                          color={isSelected ? color : isDark ? "#a1a1aa" : "#6b7280"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSubmitting}
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  { backgroundColor: color },
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {editingAccount ? "Save Changes" : "Create & Switch to Account"}
                </Text>
              </TouchableOpacity>

              {editingAccount && (
                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.8}
                  style={styles.deleteButton}
                >
                  <Trash2 size={15} color="#f43f5e" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Delete Account</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: height * 0.9,
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3f3f46",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  formScroll: {
    maxHeight: height * 0.75,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  fieldSection: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helperText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 10,
    color: "#10b981",
  },
  presetsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  presetText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  textInput: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
  },
  modeCardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    minHeight: 110,
  },
  modeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modeSelectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modeTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    marginBottom: 4,
  },
  modeDesc: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    marginRight: 8,
  },
  amountTextInput: {
    flex: 1,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    color: "#ffffff",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteButtonText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    color: "#f43f5e",
  },
});
