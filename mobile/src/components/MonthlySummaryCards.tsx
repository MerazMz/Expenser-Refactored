import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Wallet, TrendingUp, Sparkles, ShieldCheck, ChevronRight, Pencil } from "lucide-react-native";
import { useAppTheme } from "../theme/ThemeContext";

interface MonthlySummaryCardsProps {
  monthlyBudget: number;
  totalSpent: number;
  totalSaved: number;
  currency?: string;
  onViewAll?: () => void;
  onEditBalance?: () => void;
}

export const MonthlySummaryCards: React.FC<MonthlySummaryCardsProps> = ({
  monthlyBudget = 15000,
  totalSpent = 0,
  totalSaved = 0,
  currency = "₹",
  onViewAll,
  onEditBalance,
}) => {
  const { isDark } = useAppTheme();
  const remaining = Math.max(0, monthlyBudget - totalSpent);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? "#f4f4f5" : "#18181b" },
          ]}
        >
          Account Summary
        </Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn} activeOpacity={0.7}>
            <Text
              style={[
                styles.viewAllText,
                { color: isDark ? "#a1a1aa" : "#71717a" },
              ]}
            >
              View All
            </Text>
            <ChevronRight
              size={13}
              color={isDark ? "#a1a1aa" : "#71717a"}
              strokeWidth={2.25}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* 2x2 Grid */}
      <View style={styles.grid}>
        {/* Row 1: Balance & Spent */}
        <View style={styles.row}>
          {/* Current Balance (with tap-to-edit pencil icon) */}
          <TouchableOpacity
            onPress={onEditBalance}
            disabled={!onEditBalance}
            activeOpacity={0.75}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(6, 78, 59, 0.4)"
                    : "#e8f6ed",
                },
              ]}
            >
              <Wallet
                size={18}
                color={isDark ? "#34d399" : "#15803d"}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.cardTextCol}>
              <View style={styles.cardLabelRow}>
                <Text
                  style={[
                    styles.cardLabel,
                    { color: isDark ? "#a1a1aa" : "#71717a" },
                  ]}
                  numberOfLines={1}
                >
                  Balance
                </Text>
                {onEditBalance && (
                  <Pencil
                    size={10}
                    color={isDark ? "#34d399" : "#15803d"}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.cardValue,
                  { color: isDark ? "#f4f4f5" : "#18181b" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {currency}{monthlyBudget.toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Spent */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(76, 5, 25, 0.45)"
                    : "#fdeeee",
                },
              ]}
            >
              <TrendingUp
                size={18}
                color={isDark ? "#fb7185" : "#e11d48"}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.cardTextCol}>
              <Text
                style={[
                  styles.cardLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Spent
              </Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: isDark ? "#f4f4f5" : "#18181b" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {currency}{totalSpent.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Row 2: Saved & Remaining */}
        <View style={styles.row}>
          {/* Saved */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(6, 78, 59, 0.4)"
                    : "#e8f6ed",
                },
              ]}
            >
              <Sparkles
                size={18}
                color={isDark ? "#34d399" : "#15803d"}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.cardTextCol}>
              <Text
                style={[
                  styles.cardLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Saved
              </Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: isDark ? "#34d399" : "#15803d" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {currency}{totalSaved.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Remaining */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
              },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(69, 26, 3, 0.45)"
                    : "#fdf2e2",
                },
              ]}
            >
              <ShieldCheck
                size={18}
                color={isDark ? "#fbbf24" : "#d97706"}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.cardTextCol}>
              <Text
                style={[
                  styles.cardLabel,
                  { color: isDark ? "#a1a1aa" : "#71717a" },
                ]}
                numberOfLines={1}
              >
                Remaining
              </Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: isDark ? "#f4f4f5" : "#18181b" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {currency}{remaining.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14.5,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  cardTextCol: {
    flex: 1,
  },
  cardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  cardLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
  },
  cardValue: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
});
