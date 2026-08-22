import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  AppState,
  Alert,
} from "react-native";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Tag,
  Trash2,
  Wallet,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  X,
  Calculator,
  ChevronDown,
  Utensils,
  ShoppingBag,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useAccount } from "../context/AccountContext";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import {
  getLocalExpensesByMonth,
  getLocalSettings,
  saveLocalExpense,
  getUserAvailableMonthsFromLocal,
} from "../db/sqlite";
import { processOfflineSyncQueue, pullLatestDataFromServer, subscribeSyncUpdates } from "../services/syncManager";
import { syncDailyReminderStatus } from "../services/notificationService";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { evaluateSpendExpression } from "../components/SpendInput";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const CalendarScreen: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { activeAccount } = useAccount();
  const keyboardHeight = useKeyboardHeight();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [expenses, setExpenses] = useState<{
    [date: string]: { spent: number; saved: number; note: string; limit: number };
  }>({});
  const [monthlyBudget, setMonthlyBudget] = useState(15000);
  const [dailyBudget, setDailyBudget] = useState(500);
  const [currency, setCurrency] = useState("₹");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Selected Day Bottom Sheet State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editSpent, setEditSpent] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const monthStr = format(currentDate, "yyyy-MM");
  const now = new Date();
  const isCurrentMonth = format(now, "yyyy-MM") === monthStr;

  const loadMonthData = useCallback(async () => {
    if (!user) return;
    const accountId = activeAccount?.id;
    try {
      const [list, settings, months] = await Promise.all([
        getLocalExpensesByMonth(user.uid, monthStr, accountId),
        getLocalSettings(user.uid),
        getUserAvailableMonthsFromLocal(user.uid, accountId),
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

      if (months) {
        setAvailableMonths(months);
      }

      const map: {
        [date: string]: { spent: number; saved: number; note: string; limit: number };
      } = {};

      list.forEach((item) => {
        const itemLimit = item.limit || effectiveDaily;
        map[item.date] = {
          spent: item.spent,
          saved: item.saved !== undefined ? item.saved : itemLimit > 0 ? itemLimit - item.spent : 0,
          note: item.note || "",
          limit: itemLimit,
        };
      });
      setExpenses(map);
    } catch (e) {
      console.log("Error loading calendar:", e);
    }
  }, [user, monthStr, activeAccount]);

  useEffect(() => {
    loadMonthData();
    const unsubscribe = subscribeSyncUpdates(() => {
      loadMonthData();
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        loadMonthData();
        if (user?.uid) {
          pullLatestDataFromServer(user.uid);
        }
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [loadMonthData, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadMonthData();
    }, [loadMonthData])
  );

  // Calendar calculations (Monday-first offset)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayIdx = (getDay(monthStart) + 6) % 7;

  // Monthly summary metrics
  let totalSpent = 0;
  let totalSaved = 0;
  const todayStr = format(now, "yyyy-MM-dd");

  days.forEach((day) => {
    const dStr = format(day, "yyyy-MM-dd");
    const exp = expenses[dStr];
    if (exp) {
      totalSpent += exp.spent || 0;
      const hasData = exp.spent > 0 || (exp.note && exp.note.trim() !== "");
      if (dStr <= todayStr && (hasData || exp.saved > 0)) {
        totalSaved += exp.saved || 0;
      }
    }
  });

  const remainingBudget = Math.max(0, monthlyBudget - totalSpent);

  const earliestMonthStr =
    availableMonths.length > 0
      ? availableMonths[availableMonths.length - 1]
      : format(now, "yyyy-MM");

  const canGoPrev = monthStr > earliestMonthStr;
  const canGoNext = monthStr < format(now, "yyyy-MM");

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setCurrentDate((prev) => subMonths(prev, 1));
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const handleDayClick = (day: Date) => {
    const dStr = format(day, "yyyy-MM-dd");
    const existing = expenses[dStr];
    setSelectedDate(day);
    const hasData = existing && (existing.spent > 0 || (existing.note && existing.note.trim() !== ""));
    setEditSpent(hasData ? existing.spent.toString() : "");
    setEditNote(existing ? existing.note : "");
  };

  const handleSaveDayRecord = async () => {
    if (!user || !selectedDate) {
      await refreshSession();
      if (!user || !selectedDate) return;
    }
    const dStr = format(selectedDate, "yyyy-MM-dd");
    const { value: evaluatedSpent } = evaluateSpendExpression(editSpent);
    const numSpent = isNaN(evaluatedSpent) ? 0 : evaluatedSpent;
    const noteTrimmed = editNote.trim();

    // Optimistic UI update in calendar map immediately
    setExpenses((prev) => ({
      ...prev,
      [dStr]: {
        id: `${user.uid}_${activeAccount?.id || "default"}_${dStr}`,
        userId: user.uid,
        accountId: activeAccount?.id,
        date: dStr,
        spent: numSpent,
        saved: dailyBudget > 0 ? dailyBudget - numSpent : 0,
        note: noteTrimmed,
        limit: dailyBudget,
        synced: 0,
        updatedAt: new Date().toISOString(),
      },
    }));

    setIsSaving(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await saveLocalExpense(user.uid, dStr, numSpent, noteTrimmed, dailyBudget, activeAccount?.id);
      await loadMonthData();
      processOfflineSyncQueue();
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
      setSelectedDate(null);
    } catch (err) {
      console.error("Error saving day record:", err);
      Alert.alert("Save Error", "Could not save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDayRecord = async () => {
    if (!user || !selectedDate) {
      await refreshSession();
      if (!user || !selectedDate) return;
    }
    const dStr = format(selectedDate, "yyyy-MM-dd");

    // Optimistic UI update in calendar map immediately
    setExpenses((prev) => {
      const updated = { ...prev };
      delete updated[dStr];
      return updated;
    });

    setIsSaving(true);
    try {
      await saveLocalExpense(user.uid, dStr, 0, "", dailyBudget, activeAccount?.id);
      await loadMonthData();
      processOfflineSyncQueue();
      syncDailyReminderStatus(user.uid, user.displayName || user.email);
      setSelectedDate(null);
    } catch (err) {
      console.error("Error clearing day record:", err);
      Alert.alert("Error", "Could not clear entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Month Navigator Header with Centered Title & Chevrons */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          disabled={!canGoPrev}
          style={[
            styles.chevronBtn,
            {
              backgroundColor: colors.inputBg,
              opacity: canGoPrev ? 1 : 0.3,
            },
          ]}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {format(currentDate, "MMMM yyyy")}
        </Text>

        <TouchableOpacity
          onPress={handleNextMonth}
          disabled={!canGoNext}
          style={[
            styles.chevronBtn,
            {
              backgroundColor: colors.inputBg,
              opacity: canGoNext ? 1 : 0.3,
            },
          ]}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

        {/* Weekdays Header */}
        <View style={styles.calendarWrapper}>
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.weekdayText, { color: colors.textMuted }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={[styles.horizontalDivider, { backgroundColor: colors.cardBorder }]} />

        {/* Days Grid (Monday Start) */}
        <View style={styles.grid}>
          {Array.from({ length: startDayIdx }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.dayCell} />
          ))}

          {days.map((day) => {
            const dStr = format(day, "yyyy-MM-dd");
            const exp = expenses[dStr];
            const isTodayDay = isToday(day);
            const isFuture = day > new Date();

            const hasData = exp && (exp.spent > 0 || (exp.note && exp.note.trim() !== ""));
            const savedVal = exp ? exp.saved : dailyBudget;

            return (
              <TouchableOpacity
                key={dStr}
                onPress={() => handleDayClick(day)}
                activeOpacity={0.7}
                style={styles.dayCell}
              >
                {isTodayDay ? (
                  <View
                    style={[
                      styles.todayPill,
                      {
                        backgroundColor: isDark ? "#27272a" : "#18181b",
                      },
                    ]}
                  >
                    <Text style={styles.todayDateNumber}>{format(day, "d")}</Text>
                    <Text style={styles.todaySavedText}>
                      {!exp || (!hasData && savedVal === dailyBudget && exp.spent === 0)
                        ? "-"
                        : savedVal}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.regularDayCol}>
                    <Text style={[styles.dayNumber, { color: colors.text }]}>{format(day, "d")}</Text>
                    <Text
                      style={[
                        styles.savedNumber,
                        {
                          color:
                            !exp || isFuture || (!hasData && savedVal === dailyBudget && exp.spent === 0)
                              ? colors.textSubtle
                              : savedVal >= 0
                              ? colors.accentGreen
                              : colors.accentRed,
                        },
                      ]}
                    >
                      {!exp || isFuture || (!hasData && savedVal === dailyBudget && exp.spent === 0)
                        ? "-"
                        : savedVal}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Saved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Overspent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textSubtle }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>No Entry</Text>
        </View>
      </View>

      {/* Month Summary 2x2 Grid */}
      <View style={styles.summarySection}>
        <Text style={[styles.summarySectionTitle, { color: colors.text }]}>
          {format(currentDate, "MMMM")} Summary{isCurrentMonth ? " (Till Date)" : ""}
        </Text>

        <View style={styles.summaryGrid}>
          {/* Budget */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View
              style={[
                styles.summaryIconBox,
                { backgroundColor: isDark ? "rgba(5, 46, 22, 0.5)" : "#e8f6ed" },
              ]}
            >
              <Wallet size={19} color="#15803d" />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Budget</Text>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {currency}
                {monthlyBudget.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Spent */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View
              style={[
                styles.summaryIconBox,
                { backgroundColor: isDark ? "rgba(76, 5, 25, 0.5)" : "#fdeeee" },
              ]}
            >
              <TrendingUp size={19} color="#e11d48" />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Spent</Text>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {currency}
                {totalSpent.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Saved */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View
              style={[
                styles.summaryIconBox,
                { backgroundColor: isDark ? "rgba(5, 46, 22, 0.5)" : "#e8f6ed" },
              ]}
            >
              <Sparkles size={19} color="#15803d" />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Saved</Text>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {currency}
                {totalSaved.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Left */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View
              style={[
                styles.summaryIconBox,
                { backgroundColor: isDark ? "rgba(69, 26, 3, 0.5)" : "#fdf2e2" },
              ]}
            >
              <ShieldCheck size={19} color="#d97706" />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Left</Text>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {currency}
                {remainingBudget.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Day Edit Bottom Sheet Modal */}
      <Modal
        visible={selectedDate !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDate(null)}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedDate(null)}
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
              {selectedDate && (() => {
                const { value: evaluatedSpent, isExpression } = evaluateSpendExpression(editSpent);
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
                          <Text style={styles.dayBadgeText}>{format(selectedDate, "EEEE")}</Text>
                        </View>
                        <Text style={[styles.sheetDateTitle, { color: colors.text }]}>
                          {format(selectedDate, "d MMMM yyyy")}
                        </Text>
                      </View>

                      <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.sheetCloseBtn}>
                        <X size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Mini Budget & Savings Preview */}
                    <View
                      style={[
                        styles.previewCard,
                        {
                          backgroundColor: isDark ? "rgba(24, 24, 27, 0.9)" : "#faf8f5",
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          Daily Budget
                        </Text>
                        <Text style={[styles.previewVal, { color: colors.text }]}>
                          {currency}
                          {dailyBudget}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                          {isOver ? "Overspent" : "You Save"}
                        </Text>
                        <Text
                          style={[
                            styles.previewVal,
                            { color: isOver ? colors.accentRed : colors.accentGreen },
                          ]}
                        >
                          {isOver ? `-${currency}${Math.abs(calculatedSaved)}` : `${currency}${calculatedSaved}`}
                        </Text>
                      </View>
                    </View>

                    {/* Amount Input */}
                    <View style={styles.inputSection}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Amount Spent ({currency})</Text>
                      <View
                        style={[
                          styles.sheetInputRow,
                          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                        ]}
                      >
                        <Text style={[styles.sheetCurrencyPrefix, { color: colors.textMuted }]}>
                          {currency}
                        </Text>
                        <TextInput
                          style={[styles.sheetNumericInput, { color: colors.text }]}
                          placeholder="0"
                          placeholderTextColor={colors.textSubtle}
                          keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={editSpent}
                          onChangeText={(val) => {
                            const sanitized = val.replace(/[^0-9.+/*,\s-]/g, "");
                            setEditSpent(sanitized);
                          }}
                        />

                        {/* Live Calculation Result Badge */}
                        {isExpression && (
                          <View style={styles.evalBadge}>
                            <Calculator size={12} color="#10b981" style={{ marginRight: 3 }} />
                            <Text style={styles.evalBadgeText}>
                              = {currency}{evaluatedSpent.toLocaleString()}
                            </Text>
                          </View>
                        )}

                        <CreditCard size={18} color={colors.textMuted} />
                      </View>

                      {/* Presets */}
                      <View style={styles.sheetPresetsRow}>
                        {[50, 100, 200, 500].map((preset) => (
                          <TouchableOpacity
                            key={preset}
                            onPress={() => {
                              const curr = evaluatedSpent;
                              setEditSpent((curr + preset).toString());
                            }}
                            style={[
                              styles.sheetPresetBtn,
                              {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.inputBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.sheetPresetText, { color: colors.text }]}>
                              +{currency}{preset}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => setEditSpent("0")}
                          style={[
                            styles.sheetPresetBtn,
                            {
                              backgroundColor: "rgba(113, 113, 122, 0.15)",
                              borderColor: "rgba(113, 113, 122, 0.3)",
                            },
                          ]}
                        >
                          <Text style={[styles.sheetPresetText, { color: "#a1a1aa" }]}>
                            ₹0 (No spend)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Note Input */}
                    <View style={styles.inputSection}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Note (optional)</Text>
                      <View
                        style={[
                          styles.sheetInputRow,
                          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                        ]}
                      >
                        <Tag size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.sheetNoteInput, { color: colors.text }]}
                          placeholder="What did you buy? (e.g. Groceries)"
                          placeholderTextColor={colors.textSubtle}
                          value={editNote}
                          onChangeText={setEditNote}
                        />
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.sheetActions}>
                      <TouchableOpacity
                        onPress={handleSaveDayRecord}
                        disabled={isSaving}
                        activeOpacity={0.85}
                        style={[styles.sheetSaveBtn, { backgroundColor: colors.primary }]}
                      >
                        {isSaving ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Text style={styles.sheetSaveBtnText}>
                            {isExpression
                              ? `Save Daily Record (${currency}${evaluatedSpent})`
                              : "Save Daily Record"}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {editSpent !== "" && evaluatedSpent > 0 && (
                        <TouchableOpacity
                          onPress={handleClearDayRecord}
                          disabled={isSaving}
                          style={styles.clearRecordBtn}
                        >
                          <Trash2 size={13} color={colors.danger} />
                          <Text style={[styles.clearRecordText, { color: colors.danger }]}>
                            Clear record for this day
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 110,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  screenSubTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  screenMainTitle: {
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
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  accountPickerName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chevronBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    letterSpacing: -0.4,
  },
  calendarWrapper: {
    marginBottom: 18,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayText: {
    width: "14.28%",
    textAlign: "center",
    fontFamily: "Outfit_700Bold",
    fontSize: 12.5,
  },
  horizontalDivider: {
    height: 1,
    marginVertical: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  todayPill: {
    width: 44,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  todayDateNumber: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 14.5,
    color: "#ffffff",
  },
  todaySavedText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10.5,
    color: "#d4d4d8",
    marginTop: 1,
  },
  regularDayCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13.5,
  },
  savedNumber: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 10.5,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginVertical: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  summarySection: {
    marginTop: 14,
  },
  summarySectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15.5,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryCard: {
    width: "48.2%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  summaryLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    marginBottom: 1,
  },
  summaryVal: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16.5,
    letterSpacing: -0.3,
  },
  modalOverlay: {
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
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 10,
  },
  previewVal: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11.5,
    marginBottom: 6,
  },
  sheetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  sheetCurrencyPrefix: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    marginRight: 6,
  },
  sheetNumericInput: {
    flex: 1,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 17,
  },
  evalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  evalBadgeText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 12,
    color: "#10b981",
  },
  sheetNoteInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 12.5,
  },
  sheetPresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  sheetPresetBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetPresetText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
  },
  sheetActions: {
    marginTop: 8,
    gap: 8,
  },
  sheetSaveBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSaveBtnText: {
    fontFamily: "Outfit_700Bold",
    color: "#ffffff",
    fontSize: 13.5,
  },
  clearRecordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 4,
  },
  clearRecordText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11.5,
  },
});
