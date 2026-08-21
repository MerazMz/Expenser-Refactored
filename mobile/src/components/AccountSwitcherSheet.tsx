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
  Edit2,
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
  const { colors, isDark } = useAppTheme();
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
                My Accounts & Ledgers
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
              >
                Switch or manage your expense ledgers
              </Text>
            </View>

            <TouchableOpacity
              onPress={closeSwitcher}
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? "rgba(39, 39, 42, 0.6)" : "#f4f4f5" },
              ]}
            >
              <X size={16} color={isDark ? "#a1a1aa" : "#71717a"} />
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

              return (
                <TouchableOpacity
                  key={acc.id}
                  activeOpacity={0.75}
                  onPress={() => switchAccount(acc.id)}
                  style={[
                    styles.accountCard,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? "rgba(16, 185, 129, 0.08)"
                          : "rgba(16, 185, 129, 0.06)"
                        : isDark
                        ? "#181a20"
                        : "#f9fafb",
                      borderColor: isActive
                        ? "#10b981"
                        : isDark
                        ? "#27272a"
                        : "#e5e7eb",
                    },
                  ]}
                >
                  {/* Left Icon Pill */}
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: acc.color ? `${acc.color}25` : "rgba(16, 185, 129, 0.2)" },
                    ]}
                  >
                    <IconComp size={18} color={acc.color || "#10b981"} />
                  </View>

                  {/* Center Info */}
                  <View style={styles.accountInfo}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.accountName,
                          { color: isDark ? "#ffffff" : "#111827" },
                        ]}
                        numberOfLines={1}
                      >
                        {acc.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activeTag}>
                          <Text style={styles.activeTagText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.modePill,
                          {
                            backgroundColor: isFlex
                              ? "rgba(59, 130, 246, 0.15)"
                              : "rgba(16, 185, 129, 0.15)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modePillText,
                            { color: isFlex ? "#60a5fa" : "#34d399" },
                          ]}
                        >
                          {isFlex ? "Track As You Go" : `Fixed Budget: ₹${acc.dailyBudget}/day`}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.balanceText,
                          { color: isDark ? "#a1a1aa" : "#6b7280" },
                        ]}
                      >
                        {isFlex ? `Balance: ₹${acc.initialBalance.toLocaleString()}` : `Limit: ₹${acc.monthlyBudget.toLocaleString()}`}
                      </Text>
                    </View>
                  </View>

                  {/* Right Actions */}
                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditModal(acc);
                      }}
                      style={[
                        styles.editButton,
                        { backgroundColor: isDark ? "rgba(39, 39, 42, 0.6)" : "#f3f4f6" },
                      ]}
                    >
                      <Edit2 size={13} color={isDark ? "#a1a1aa" : "#6b7280"} />
                    </TouchableOpacity>

                    {isActive && (
                      <View style={styles.checkCircle}>
                        <Check size={12} color="#ffffff" strokeWidth={3} />
                      </View>
                    )}
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
                  borderColor: isDark ? "rgba(16, 185, 129, 0.4)" : "rgba(16, 185, 129, 0.3)",
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.05)" : "#ecfdf5",
                },
              ]}
            >
              <View style={styles.addIconCircle}>
                <Plus size={16} color="#10b981" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addAccountTitle}>Add New Account</Text>
                <Text style={styles.addAccountSubtitle}>
                  Create food, travel, or flex expense tracker
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
                  borderTopColor: isDark ? "#27272a" : "#f3f4f6",
                  backgroundColor: isDark ? "#0d0e12" : "#f9fafb",
                },
              ]}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
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
                  {user.displayName || "Expenser Account"}
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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
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
    maxHeight: height * 0.85,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3f3f46",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
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
  accountList: {
    maxHeight: height * 0.55,
  },
  accountListContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  accountName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    marginRight: 6,
  },
  activeTag: {
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeTagText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 8,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  modePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modePillText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 10,
  },
  balanceText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  editButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  addAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 16,
    marginTop: 4,
  },
  addIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  addAccountTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#10b981",
  },
  addAccountSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
    color: "#71717a",
    marginTop: 2,
  },
  userFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  userAvatarText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#ffffff",
  },
  userNameText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
  },
  userEmailText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11,
  },
});
