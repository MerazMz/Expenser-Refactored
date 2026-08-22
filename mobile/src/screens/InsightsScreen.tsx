import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useAccount } from "../context/AccountContext";
import {
  getLocalExpensesByMonth,
  getLocalSettings,
  getUserAvailableMonthsFromLocal,
} from "../db/sqlite";
import { pullLatestDataFromServer, subscribeSyncUpdates } from "../services/syncManager";
import { useFocusEffect } from "@react-navigation/native";
import { SavingsLineChart } from "../components/SavingsLineChart";

export const InsightsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { activeAccount } = useAccount();

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [currency, setCurrency] = useState("₹");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const selectedMonthStr = format(selectedDate, "yyyy-MM");
  const currentMonthStr = format(now, "yyyy-MM");

  const loadData = useCallback(async () => {
    if (!user) return;
    const accountId = activeAccount?.id;
    try {
      const [list, set, months] = await Promise.all([
        getLocalExpensesByMonth(user.uid, selectedMonthStr, accountId),
        getLocalSettings(user.uid),
        getUserAvailableMonthsFromLocal(user.uid, accountId),
      ]);
      setExpenses(list);
      setSettings(set);
      setAvailableMonths(months);
      const effectiveCurrency = activeAccount?.currency || set?.currency || "INR";
      setCurrency(effectiveCurrency === "USD" ? "$" : effectiveCurrency === "EUR" ? "€" : "₹");
    } catch (e) {
      console.log("Error loading insights:", e);
    }
  }, [user, selectedMonthStr, activeAccount]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSyncUpdates(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Calculate metrics matching web logic exactly
  const metrics = useMemo(() => {
    const isCurrentMonth = selectedMonthStr === currentMonthStr;
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dailyLimit = settings?.dailyBudget || 500;

    if (!settings && expenses.length === 0) {
      return {
        avgSpend: 0,
        projectedEnd: 0,
        totalSpent: 0,
        bestDay: { date: "-", amount: 0 },
        worstDay: { date: "-", amount: 0 },
        chartData: [],
      };
    }

    const dayMap = new Map(expenses.map((e: any) => [e.date, e]));

    let maxDayToInclude = allDaysInMonth.length;
    if (isCurrentMonth) {
      maxDayToInclude = now.getDate();
    } else {
      let lastEntryDay = 0;
      expenses.forEach((e) => {
        const dNum = parseInt(e.date.split("-")[2], 10);
        if (dNum > lastEntryDay) lastEntryDay = dNum;
      });
      maxDayToInclude = lastEntryDay > 0 ? lastEntryDay : allDaysInMonth.length;
    }

    const activeDays = allDaysInMonth.slice(0, maxDayToInclude);

    let totalSpentSoFar = 0;
    const recordedDays: { date: string; spent: number; saved: number }[] = [];

    const chartData = activeDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const exp = dayMap.get(dateStr);
      const spent = exp?.spent || 0;
      const saved = exp ? exp.saved : dailyLimit;
      const hasEntry = exp && (exp.spent > 0 || (exp.note && exp.note.trim() !== ""));

      if (hasEntry || exp) {
        totalSpentSoFar += spent;
        recordedDays.push({ date: dateStr, spent, saved });
      }

      return {
        date: dateStr,
        saved,
      };
    });

    const currentDayNum = activeDays.length || 1;
    const daysInMonthTotal = allDaysInMonth.length;
    const avgSpend = currentDayNum > 0 ? Math.round(totalSpentSoFar / currentDayNum) : 0;
    const projectedEnd = Math.round(avgSpend * daysInMonthTotal);

    let bestDayObj = { date: "-", amount: 0 };
    let worstDayObj = { date: "-", amount: 0 };

    if (recordedDays.length > 0) {
      const maxSaved = Math.max(...recordedDays.map((d) => d.saved));
      const bestMatch = recordedDays.find((d) => d.saved === maxSaved);
      if (bestMatch) {
        bestDayObj = {
          date: format(new Date(`${bestMatch.date}T00:00:00`), "d MMM"),
          amount: maxSaved,
        };
      }

      const minSaved = Math.min(...recordedDays.map((d) => d.saved));
      const worstMatch = recordedDays.find((d) => d.saved === minSaved);
      if (worstMatch) {
        worstDayObj = {
          date: format(new Date(`${worstMatch.date}T00:00:00`), "d MMM"),
          amount: minSaved,
        };
      }
    }

    return {
      avgSpend,
      projectedEnd,
      totalSpent: totalSpentSoFar,
      bestDay: bestDayObj,
      worstDay: worstDayObj,
      chartData,
    };
  }, [expenses, settings, selectedDate, selectedMonthStr, currentMonthStr, now]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header & Month Navigator */}
      <View style={styles.topSection}>
        <View>
          <Text
            style={[
              styles.screenTitle,
              { color: isDark ? "#f4f4f5" : "#18181b" },
            ]}
          >
            Insights
          </Text>
          <Text
            style={[
              styles.screenSubtitle,
              { color: isDark ? "#a1a1aa" : "#71717a" },
            ]}
          >
            Spending analytics & patterns
          </Text>
        </View>

        <View style={styles.monthNavRow}>
          {(() => {
            const earliestMonthStr =
              availableMonths.length > 0
                ? availableMonths[availableMonths.length - 1]
                : format(now, "yyyy-MM");
            const canGoPrev = selectedMonthStr > earliestMonthStr;
            const canGoNext = selectedMonthStr < currentMonthStr;

            return (
              <>
                <TouchableOpacity
                  onPress={() => {
                    if (canGoPrev) {
                      setSelectedDate((prev) => subMonths(prev, 1));
                    }
                  }}
                  disabled={!canGoPrev}
                  style={[
                    styles.navBtn,
                    {
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
                      opacity: canGoPrev ? 1 : 0.3,
                    },
                  ]}
                >
                  <ChevronLeft size={16} color={isDark ? "#f4f4f5" : "#18181b"} />
                </TouchableOpacity>

                <Text
                  style={[
                    styles.monthLabel,
                    { color: isDark ? "#f4f4f5" : "#18181b" },
                  ]}
                >
                  {format(selectedDate, "MMM yyyy")}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    if (canGoNext) {
                      setSelectedDate((prev) => addMonths(prev, 1));
                    }
                  }}
                  disabled={!canGoNext}
                  style={[
                    styles.navBtn,
                    {
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
                      opacity: canGoNext ? 1 : 0.3,
                    },
                  ]}
                >
                  <ChevronRight size={16} color={isDark ? "#f4f4f5" : "#18181b"} />
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      </View>

      {/* 2x2 Metric Cards Grid */}
      <View style={styles.metricsGrid}>
        {/* Row 1: Avg Spend & Projected End */}
        <View style={styles.metricsRow}>
          {/* Avg Spend / Day */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Avg. Spend / Day
              </Text>
              <View
                style={[
                  styles.metricIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(5, 46, 22, 0.5)"
                      : "#e8f6ed",
                  },
                ]}
              >
                <TrendingUp
                  size={15}
                  color={isDark ? "#34d399" : "#15803d"}
                />
              </View>
            </View>
            <Text
              style={[
                styles.metricVal,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currency}
              {metrics.avgSpend.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.metricHint,
                { color: isDark ? "#71717a" : "#a1a1aa" },
              ]}
              numberOfLines={1}
            >
              Per recorded day
            </Text>
          </View>

          {/* Projected End */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                {selectedMonthStr === currentMonthStr ? "Projected End" : "Total Spent"}
              </Text>
              <View
                style={[
                  styles.metricIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(88, 28, 135, 0.4)"
                      : "#faf5ff",
                  },
                ]}
              >
                <Target
                  size={15}
                  color={isDark ? "#c084fc" : "#9333ea"}
                />
              </View>
            </View>
            <Text
              style={[
                styles.metricVal,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currency}
              {(selectedMonthStr === currentMonthStr
                ? metrics.projectedEnd
                : metrics.totalSpent
              ).toLocaleString()}
            </Text>
            <Text
              style={[
                styles.metricHint,
                { color: isDark ? "#71717a" : "#a1a1aa" },
              ]}
              numberOfLines={1}
            >
              {selectedMonthStr === currentMonthStr ? "Estimated total" : "Monthly total"}
            </Text>
          </View>
        </View>

        {/* Row 2: Best Day & Worst Day */}
        <View style={styles.metricsRow}>
          {/* Best Day */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Best Day (Saved)
              </Text>
              <View
                style={[
                  styles.metricIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(5, 46, 22, 0.5)"
                      : "#e8f6ed",
                  },
                ]}
              >
                <Sparkles
                  size={15}
                  color={isDark ? "#34d399" : "#15803d"}
                />
              </View>
            </View>
            <Text
              style={[
                styles.metricVal,
                { color: isDark ? "#34d399" : "#15803d" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {metrics.bestDay.date === "-" ? "-" : `+${currency}${metrics.bestDay.amount}`}
            </Text>
            <Text
              style={[
                styles.metricHint,
                { color: isDark ? "#71717a" : "#a1a1aa" },
              ]}
              numberOfLines={1}
            >
              {metrics.bestDay.date}
            </Text>
          </View>

          {/* Worst Day */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Worst Day
              </Text>
              <View
                style={[
                  styles.metricIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(76, 5, 25, 0.5)"
                      : "#fdeeee",
                  },
                ]}
              >
                <TrendingDown
                  size={15}
                  color={isDark ? "#fb7185" : "#e11d48"}
                />
              </View>
            </View>
            <Text
              style={[
                styles.metricVal,
                { color: isDark ? "#fb7185" : "#e11d48" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {metrics.worstDay.date === "-"
                ? "-"
                : metrics.worstDay.amount < 0
                ? `-${currency}${Math.abs(metrics.worstDay.amount)}`
                : `+${currency}${metrics.worstDay.amount}`}
            </Text>
            <Text
              style={[
                styles.metricHint,
                { color: isDark ? "#71717a" : "#a1a1aa" },
              ]}
              numberOfLines={1}
            >
              {metrics.worstDay.date}
            </Text>
          </View>
        </View>
      </View>

      {/* Daily Savings Trend Line Chart */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text
            style={[
              styles.chartTitle,
              { color: isDark ? "#f4f4f5" : "#18181b" },
            ]}
          >
            Daily Savings Trend
          </Text>
          <Text
            style={[
              styles.chartSub,
              { color: isDark ? "#a1a1aa" : "#71717a" },
            ]}
          >
            {metrics.chartData.length} {metrics.chartData.length === 1 ? "day" : "days"} recorded
          </Text>
        </View>

        <SavingsLineChart
          data={metrics.chartData}
          currency={currency}
          accentColor={activeAccount?.color || (activeAccount?.type === "flex" ? "#3b82f6" : "#10b981")}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 110,
  },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    marginHorizontal: 2,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metricLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
  },
  metricIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricVal: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  metricHint: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10.5,
  },
  chartSection: {
    marginBottom: 16,
    gap: 10,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  chartTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
  },
  chartSub: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
  },
});
