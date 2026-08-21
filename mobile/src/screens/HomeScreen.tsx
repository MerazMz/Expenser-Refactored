import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  AppState,
  Alert,
} from "react-native";
import { format } from "date-fns";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import {
  getLocalExpenseByDate,
  getLocalExpensesByMonth,
  getLocalSettings,
  saveLocalExpense,
  calculateStreakFromLocal,
} from "../db/sqlite";
import {
  processOfflineSyncQueue,
  pullLatestDataFromServer,
  subscribeSyncUpdates,
} from "../services/syncManager";
import { TodayCard } from "../components/TodayCard";
import { SpendInput, evaluateSpendExpression } from "../components/SpendInput";
import { MonthlySummaryCards } from "../components/MonthlySummaryCards";
import { AccountSwitcherSheet } from "../components/AccountSwitcherSheet";
import { CreateAccountModal } from "../components/CreateAccountModal";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTabNavigation } from "../context/TabNavigationContext";
import { useAccount } from "../context/AccountContext";
import { syncDailyReminderStatus, addExpenseNotificationListener } from "../services/notificationService";
import {
  X,
  Calculator,
  Sparkles,
  Check,
  Plus,
  ChevronDown,
  Wallet,
  Utensils,
  ShoppingBag,
  CreditCard,
  TrendingUp,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

const ICON_MAP: Record<string, any> = {
  wallet: Wallet,
  utensils: Utensils,
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
};

export const HomeScreen: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { activeAccount, openSwitcher } = useAccount();
  const navigation = useNavigation<any>();
  const { goToTab } = useTabNavigation();
  const keyboardHeight = useKeyboardHeight();

  const [todayExpense, setTodayExpense] = useState<{ spent: number; note: string; limit: number }>({
    spent: 0,
    note: "",
    limit: 500,
  });
  const [monthlyBudget, setMonthlyBudget] = useState(15000);
  const [dailyBudget, setDailyBudget] = useState(500);
  const [currency, setCurrency] = useState("₹");
  const [monthTotalSpent, setMonthTotalSpent] = useState(0);
  const [monthTotalSaved, setMonthTotalSaved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Notification-triggered Add Expense Modal State
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [modalSpentInput, setModalSpentInput] = useState("");
  const [modalNoteInput, setModalNoteInput] = useState("");
  const [isSavingModal, setIsSavingModal] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const currentMonthStr = format(new Date(), "yyyy-MM");
    const accountId = activeAccount?.id;

    try {
      const [today, monthExpenses, settings, currentStreak] = await Promise.all([
        getLocalExpenseByDate(user.uid, todayStr, accountId),
        getLocalExpensesByMonth(user.uid, currentMonthStr, accountId),
        getLocalSettings(user.uid),
        calculateStreakFromLocal(user.uid, accountId),
      ]);

      const effectiveDaily = activeAccount
        ? activeAccount.type === "flex" ? 0 : activeAccount.dailyBudget
        : settings?.dailyBudget || 500;
      const effectiveMonthly = activeAccount
        ? activeAccount.initialBalance || activeAccount.monthlyBudget
        : settings?.monthlyBudget || 15000;
      const effectiveCurrency = activeAccount?.currency || settings?.currency || "INR";

      setMonthlyBudget(effectiveMonthly);
      setDailyBudget(effectiveDaily);
      setCurrency(effectiveCurrency === "USD" ? "$" : effectiveCurrency === "EUR" ? "€" : "₹");

      if (today) {
        setTodayExpense({
          spent: today.spent || 0,
          note: today.note || "",
          limit: today.limit || effectiveDaily,
        });
      } else {
        setTodayExpense({ spent: 0, note: "", limit: effectiveDaily });
      }

      // Calculate monthly summary
      let totalSpent = 0;
      let totalSaved = 0;
      monthExpenses.forEach((item) => {
        totalSpent += item.spent || 0;
        const hasData = item.spent > 0 || (item.note && item.note.trim() !== "");
        if (item.date <= todayStr && (hasData || item.saved > 0)) {
          totalSaved += item.saved || 0;
        }
      });

      setMonthTotalSpent(totalSpent);
      setMonthTotalSaved(totalSaved);
      setStreak(currentStreak);
    } catch (e) {
      console.log("Error loading dashboard data:", e);
    }
  }, [user, activeAccount]);

  // Initial load and sync
  useEffect(() => {
    loadDashboardData();
    if (user?.uid) {
      pullLatestDataFromServer(user.uid);
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
    }

    const unsubscribeSync = subscribeSyncUpdates(() => {
      loadDashboardData();
    });

    // Listen for notification taps to open Add Expense modal immediately
    const unsubscribeNotification = addExpenseNotificationListener(() => {
      goToTab("Home");
      setModalSpentInput(todayExpense.spent > 0 ? todayExpense.spent.toString() : "");
      setModalNoteInput(todayExpense.note || "");
      setIsAddExpenseModalOpen(true);
    });

    // Re-verify data and resume state when app returns from background after hours
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        loadDashboardData();
        if (user?.uid) {
          pullLatestDataFromServer(user.uid);
          syncDailyReminderStatus(user.uid, user.displayName || user.email);
        }
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeNotification();
      appStateSub.remove();
    };
  }, [user?.uid, user?.displayName, user?.email, todayExpense.spent, todayExpense.note, loadDashboardData, goToTab]);

  // Screen focus reload (loads from SQLite cache instantly with 0ms delay)
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      if (user?.uid) {
        syncDailyReminderStatus(user.uid, user.displayName || user.email);
      }
    }, [loadDashboardData, user?.uid, user?.displayName, user?.email])
  );

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await pullLatestDataFromServer(user.uid);
      await loadDashboardData();
      processOfflineSyncQueue();
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveTodayExpense = async (spent: number, note: string) => {
    if (!user) {
      await refreshSession();
      if (!user) return;
    }
    const todayStr = format(new Date(), "yyyy-MM-dd");
    try {
      await saveLocalExpense(user.uid, todayStr, spent, note, dailyBudget, activeAccount?.id);
      await loadDashboardData();
      processOfflineSyncQueue();
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
    } catch (err: any) {
      console.error("Error saving today's expense:", err);
      Alert.alert("Save Error", "Could not save expense. Please try again.");
    }
  };

  const handleSaveModalExpense = async () => {
    if (!user) {
      await refreshSession();
      if (!user) return;
    }
    const { value: evaluatedSpent } = evaluateSpendExpression(modalSpentInput);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    setIsSavingModal(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await saveLocalExpense(user.uid, todayStr, evaluatedSpent, modalNoteInput.trim(), dailyBudget, activeAccount?.id);
      setIsAddExpenseModalOpen(false);
      setModalSpentInput("");
      setModalNoteInput("");
      await loadDashboardData();
      processOfflineSyncQueue();
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
    } catch (err) {
      console.error("Error saving modal expense:", err);
      Alert.alert("Save Error", "Could not save expense. Please try again.");
    } finally {
      setIsSavingModal(false);
    }
  };

  const handlePresetModalAdd = (amount: number) => {
    const { value: currentVal } = evaluateSpendExpression(modalSpentInput);
    const newVal = (isNaN(currentVal) ? 0 : currentVal) + amount;
    setModalSpentInput(newVal.toString());
  };

  const ActiveIcon = ICON_MAP[activeAccount?.icon || "wallet"] || Wallet;
  const isFlexAccount = activeAccount?.type === "flex";

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={["#10b981"]}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.brandTitle,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
            >
              expenser
            </Text>
          </View>

          {/* Streak Flame Badge */}
          {streak >= 0 && (
            <TouchableOpacity
              onPress={() => setIsStreakModalOpen(true)}
              activeOpacity={0.8}
              style={[
                styles.streakBadge,
                {
                  backgroundColor: isDark ? "rgba(24, 24, 27, 0.9)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
                },
              ]}
            >
              <Image
                source={require("../../assets/streak.gif")}
                style={[
                  styles.streakGifSmall,
                  streak === 0 && { opacity: 0.5, tintColor: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.streakText,
                  { color: isDark ? "#e4e4e7" : "#27272a" },
                ]}
              >
                {streak}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date & Account Section */}
        <View style={styles.dateSection}>
          <View>
            <Text
              style={[
                styles.dateSub,
                { color: isDark ? "#a1a1aa" : "#71717a" },
              ]}
            >
              Today
            </Text>
            <Text
              style={[
                styles.dateTitle,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
            >
              {format(new Date(), "d MMM yyyy")}
            </Text>
          </View>

          {/* Clean Account Switcher Button */}
          <TouchableOpacity
            onPress={openSwitcher}
            activeOpacity={0.8}
            style={[
              styles.accountPickerPill,
              {
                backgroundColor: isDark ? "#181920" : "#f4f4f5",
                borderColor: isDark ? "#282a36" : "#e4e4e7",
              },
            ]}
          >
            <View
              style={[
                styles.accountPickerDot,
                { backgroundColor: activeAccount?.color || (isFlexAccount ? "#3b82f6" : "#10b981") },
              ]}
            >
              <ActiveIcon size={11} color="#ffffff" />
            </View>
            <Text
              style={[
                styles.accountPickerName,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
              numberOfLines={1}
            >
              {activeAccount?.name || "Daily Savings"}
            </Text>
            <ChevronDown size={13} color={isDark ? "#828799" : "#71717a"} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        {/* Content Stack */}
        <View style={styles.stack}>
          {/* Today Liquid Glass Card */}
          <TodayCard
            limit={todayExpense.limit || dailyBudget}
            spent={todayExpense.spent}
            currency={currency}
            accountType={activeAccount?.type || "budget"}
            availableBalance={(activeAccount?.initialBalance || monthlyBudget) - monthTotalSpent}
            initialBalance={activeAccount?.initialBalance || monthlyBudget}
            monthSpent={monthTotalSpent}
            accountName={activeAccount?.name}
            accentColor={activeAccount?.color || "#10b981"}
          />

          {/* Spend Input Box */}
          <SpendInput
            initialSpent={todayExpense.spent}
            initialNote={todayExpense.note}
            currency={currency}
            onSave={handleSaveTodayExpense}
          />

        {/* Account Monthly Summary 2x2 Grid */}
        <MonthlySummaryCards
          monthlyBudget={monthlyBudget}
          totalSpent={monthTotalSpent}
          totalSaved={monthTotalSaved}
          currency={currency}
          onViewAll={() => goToTab("Calendar")}
          onEditBalance={() => goToTab("Settings")}
        />
      </View>

      {/* Streak Info Modal */}
      <Modal
        visible={isStreakModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStreakModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(63, 63, 70, 0.5)" : "#e8e4db",
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? "#ffffff" : "#18181b" },
              ]}
            >
              Daily Streak
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? "#a1a1aa" : "#71717a" },
              ]}
            >
              Keep the flame burning!
            </Text>

            <Text
              style={[
                styles.largeStreakCount,
                { color: isDark ? "#ffffff" : "#18181b" },
              ]}
            >
              {streak}
            </Text>

            <Image
              source={require("../../assets/streak.gif")}
              style={[
                styles.streakGifLarge,
                streak === 0 && { opacity: 0.4, tintColor: isDark ? "#a1a1aa" : "#71717a" },
              ]}
              resizeMode="contain"
            />

            <Text
              style={[
                styles.streakInfoText,
                { color: isDark ? "#a1a1aa" : "#71717a" },
              ]}
            >
              You build your streak by logging your saving expenses every single day. Keep entering
              your spending details daily to maintain your habits of saving and keep the flame
              alive!
            </Text>

            <TouchableOpacity
              onPress={() => setIsStreakModalOpen(false)}
              activeOpacity={0.85}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Add Expense Modal for Today (Opens directly on Notification Tap) */}
      <Modal
        visible={isAddExpenseModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddExpenseModalOpen(false)}
      >
        <View style={[styles.sheetOverlay, { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsAddExpenseModalOpen(false)}
          />
          <View
            style={[
              styles.sheetContent,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {(() => {
                const { value: evaluatedSpent, isExpression } = evaluateSpendExpression(modalSpentInput);
                const calculatedSaved = dailyBudget - (isNaN(evaluatedSpent) ? 0 : evaluatedSpent);
                const isOver = calculatedSaved < 0;

                return (
                  <View>
                    {/* Drag Handle */}
                    <View style={[styles.dragHandle, { backgroundColor: colors.cardBorder }]} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                      <View>
                        <View
                          style={[
                            styles.dayBadge,
                            {
                              backgroundColor: isDark ? "rgba(5, 46, 22, 0.5)" : "#e8f6ed",
                            },
                          ]}
                        >
                          <Text style={styles.dayBadgeText}>Today's Expense</Text>
                        </View>
                        <Text style={[styles.sheetDateTitle, { color: colors.text }]}>
                          {format(new Date(), "EEEE, d MMMM")}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setIsAddExpenseModalOpen(false)}
                        style={styles.sheetCloseBtn}
                      >
                        <X size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Mini Budget & Savings Preview */}
                    <View
                      style={[
                        styles.previewCard,
                        {
                          backgroundColor: isDark ? "#121214" : "#faf9f6",
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.previewCol}>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          Daily Budget
                        </Text>
                        <Text style={[styles.previewVal, { color: colors.text }]}>
                          {currency}{dailyBudget}
                        </Text>
                      </View>

                      <View style={[styles.previewDivider, { backgroundColor: colors.cardBorder }]} />

                      <View style={styles.previewCol}>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          {isOver ? "Over Budget" : "Savings"}
                        </Text>
                        <Text
                          style={[
                            styles.previewVal,
                            { color: isOver ? colors.accentRed : colors.accentGreen },
                          ]}
                        >
                          {isOver ? `-${currency}${Math.abs(calculatedSaved)}` : `+${currency}${calculatedSaved}`}
                        </Text>
                      </View>
                    </View>

                    {/* Spent Input Box with Calculator */}
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Spent Amount</Text>
                        {isExpression && !isNaN(evaluatedSpent) && (
                          <View
                            style={[
                              styles.calcLiveBadge,
                              { backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7" },
                            ]}
                          >
                            <Calculator size={11} color="#10b981" />
                            <Text style={styles.calcLiveText}>= {currency}{evaluatedSpent}</Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={[
                          styles.amountInputRow,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.inputBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>
                          {currency}
                        </Text>
                        <TextInput
                          style={[styles.amountInput, { color: colors.text }]}
                          placeholder="0"
                          placeholderTextColor={colors.textSubtle}
                          keyboardType="decimal-pad"
                          inputMode="decimal"
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={modalSpentInput}
                          onChangeText={(val) => {
                            const sanitized = val.replace(/[^0-9.+/*-]/g, "");
                            setModalSpentInput(sanitized);
                          }}
                          autoFocus
                        />
                      </View>

                      {/* Quick Presets */}
                      <View style={styles.presetChipsRow}>
                        {[50, 100, 200, 500].map((amt) => (
                          <TouchableOpacity
                            key={amt}
                            onPress={() => handlePresetModalAdd(amt)}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.inputBorder,
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.presetChipText, { color: colors.text }]}>
                              +{currency}{amt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => setModalSpentInput("")}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.inputBorder,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipText, { color: colors.accentRed }]}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Note Input */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Note (Optional)</Text>
                      <TextInput
                        style={[
                          styles.noteInput,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.inputBorder,
                            color: colors.text,
                          },
                        ]}
                        placeholder="What did you spend on?"
                        placeholderTextColor={colors.textSubtle}
                        value={modalNoteInput}
                        onChangeText={setModalNoteInput}
                      />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.sheetActions}>
                      <TouchableOpacity
                        onPress={() => setIsAddExpenseModalOpen(false)}
                        style={[styles.sheetCancelBtn, { borderColor: colors.cardBorder }]}
                      >
                        <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSaveModalExpense}
                        disabled={isSavingModal}
                        style={[styles.sheetSaveBtn, { backgroundColor: colors.primary }]}
                      >
                        {isSavingModal ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Text style={styles.sheetSaveText}>Save Expense</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Multi-Account Switcher Bottom Sheet */}
    <AccountSwitcherSheet />

    {/* Create / Edit Account Modal */}
    <CreateAccountModal />
  </>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 22,
    height: 22,
    marginRight: 7,
  },
  brandTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 19,
    letterSpacing: -0.4,
    textTransform: "lowercase",
  },
  dateSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateSub: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  dateTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    letterSpacing: -0.5,
  },
  accountPickerPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  accountPickerDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  accountPickerName: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    flexShrink: 1,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  streakGifSmall: {
    width: 14,
    height: 14,
    marginRight: 5,
  },
  streakText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stack: {
    gap: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  modalTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  modalSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10.5,
    marginTop: 2,
    marginBottom: 8,
  },
  largeStreakCount: {
    fontFamily: "Outfit_900Black",
    fontSize: 48,
    marginBottom: 2,
  },
  streakGifLarge: {
    width: 68,
    height: 68,
    marginBottom: 12,
  },
  streakInfoText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  modalCloseButton: {
    width: "100%",
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1d3f32",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#ffffff",
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    maxHeight: "88%",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dayBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  dayBadgeText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 9.5,
    color: "#15803d",
    textTransform: "uppercase",
  },
  sheetDateTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  previewCol: {
    flex: 1,
    alignItems: "center",
  },
  previewLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 10.5,
    marginBottom: 2,
  },
  previewVal: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  previewDivider: {
    width: 1,
    height: 28,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  inputLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
  },
  calcLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  calcLiveText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10.5,
    color: "#10b981",
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: "100%",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
  },
  presetChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
  },
  noteInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  sheetCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  sheetSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSaveText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    color: "#ffffff",
  },
});
