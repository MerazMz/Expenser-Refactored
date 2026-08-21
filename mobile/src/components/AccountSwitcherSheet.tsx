import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import {
  Check,
  Plus,
  Settings2,
  X,
  Wallet,
  Sparkles,
  Utensils,
  ShoppingBag,
  TrendingUp,
  CreditCard,
} from "lucide-react-native";
import { useAccount } from "../context/AccountContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Account } from "../db/sqlite";

const { height } = Dimensions.get("window");

const ICON_MAP: Record<string, any> = {
  wallet: Wallet,
  utensils: Utensils,
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
};

export const AccountSwitcherSheet: React.FC = () => {
  const {
    accounts,
    activeAccount,
    isSwitcherOpen,
    closeSwitcher,
    switchAccount,
    openCreateModal,
    openEditModal,
  } = useAccount();
  const { isDark } = useAppTheme();
  const { user } = useAuth();

  if (!isSwitcherOpen) return null;

  return (
    <Modal
      visible={isSwitcherOpen}
      transparent
      animationType="fade"
      onRequestClose={closeSwitcher}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={closeSwitcher}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? "#121318" : "#ffffff",
              borderColor: isDark ? "#27272a" : "#e4e4e7",
            },
          ]}
        >
          {/* Handle Indicator */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? "#f4f4f5" : "#18181b" },
                ]}
              >
                Accounts & Ledgers
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? "#71717a" : "#a1a1aa" },
                ]}
              >
                Select active expense tracker
              </Text>
            </View>

            <TouchableOpacity
              onPress={closeSwitcher}
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? "rgba(39, 39, 42, 0.6)" : "#f4f4f5" },
              ]}
            >
              <X size={15} color={isDark ? "#a1a1aa" : "#71717a"} />
            </TouchableOpacity>
          </View>

          {/* Account List */}
          <ScrollView
            style={styles.accountList}
            contentContainerStyle={styles.accountListContent}
            showsVerticalScrollIndicator={false}
          >
            {accounts.map((acc: Account) => {
              const isActive = activeAccount?.id === acc.id;
              const IconComp = ICON_MAP[acc.icon] || Wallet;
              const isFlex = acc.type === "flex";
              const accColor = acc.color || (isFlex ? "#3b82f6" : "#10b981");

              return (
                <TouchableOpacity
                  key={acc.id}
                  activeOpacity={0.8}
                  onPress={() => switchAccount(acc.id)}
                  style={[
                    styles.accountCard,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? "rgba(16, 185, 129, 0.07)"
                          : "rgba(16, 185, 129, 0.05)"
                        : isDark
                        ? "#191b22"
                        : "#fafafa",
                      borderColor: isActive
                        ? "#10b981"
                        : isDark
                        ? "#232630"
                        : "#e5e7eb",
                    },
                  ]}
                >
                  {/* Left Icon Pill */}
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: `${accColor}20` },
                    ]}
                  >
                    <IconComp size={18} color={accColor} strokeWidth={2.2} />
                  </View>

                  {/* Center Info */}
                  <View style={styles.accountInfo}>
                    <Text
                      style={[
                        styles.accountName,
                        { color: isDark ? "#ffffff" : "#111827" },
                      ]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </Text>

                    <Text
                      style={[
                        styles.subDetailText,
                        { color: isDark ? "#828799" : "#6b7280" },
                      ]}
                      numberOfLines={1}
                    >
                      {isFlex
                        ? `₹${acc.initialBalance.toLocaleString()} available • Track as you go`
                        : `₹${acc.dailyBudget}/day • ₹${acc.monthlyBudget.toLocaleString()} limit`}
                    </Text>
                  </View>

                  {/* Right Actions */}
                  <View style={styles.rightActions}>
                    {isActive && (
                      <View style={styles.activePill}>
                        <Check size={11} color="#10b981" strokeWidth={3} />
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditModal(acc);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.settingsButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(0, 0, 0, 0.04)",
                        },
                      ]}
                    >
                      <Settings2 size={14} color={isDark ? "#828799" : "#9ca3af"} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Add New Account Button */}
            <TouchableOpacity
              onPress={openCreateModal}
              activeOpacity={0.8}
              style={[
                styles.addAccountButton,
                {
                  borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.3)",
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.04)" : "#f0fdf4",
                },
              ]}
            >
              <View style={styles.addIconCircle}>
                <Plus size={15} color="#10b981" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addAccountTitle}>Add New Account</Text>
                <Text style={styles.addAccountSubtitle}>
                  Create a custom daily budget or flex expense ledger
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Logged in User Bar */}
          {user?.email && (
            <View
              style={[
                styles.userFooter,
                {
                  borderTopColor: isDark ? "#232630" : "#f3f4f6",
                  backgroundColor: isDark ? "#0e0f14" : "#fafafa",
                },
              ]}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user.displayName
                    ? user.displayName.charAt(0).toUpperCase()
                    : user.email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.userNameText,
                    { color: isDark ? "#f4f4f5" : "#1f2937" },
                  ]}
                  numberOfLines={1}
                >
                  {user.displayName || "My Account"}
                </Text>
                <Text
                  style={[
                    styles.userEmailText,
                    { color: isDark ? "#71717a" : "#9ca3af" },
                  ]}
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: height * 0.82,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3f3f46",
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12.5,
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  accountList: {
    maxHeight: height * 0.52,
  },
  accountListContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 10,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
    justifyContent: "center",
  },
  accountName: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subDetailText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    letterSpacing: -0.1,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  activePillText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10.5,
    color: "#10b981",
    letterSpacing: 0.2,
  },
  settingsButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  addAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.2,
    borderStyle: "dashed",
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addAccountTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13.5,
    color: "#10b981",
  },
  addAccountSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
    color: "#71717a",
    marginTop: 1,
  },
  userFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    color: "#ffffff",
  },
  userNameText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13.5,
  },
  userEmailText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
    marginTop: 1,
  },
});
