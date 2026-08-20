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
              size={20}
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
              >
                Current Balance
              </Text>
              {onEditBalance && (
                <Pencil
                  size={10.5}
                  color={isDark ? "#34d399" : "#15803d"}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
            <Text
              style={[
                styles.cardValue,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
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
              size={20}
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
            >
              Spent
            </Text>
            <Text
              style={[
                styles.cardValue,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
            >
              {currency}{totalSpent.toLocaleString()}
            </Text>
          </View>
        </View>

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
              size={20}
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
            >
              Saved
            </Text>
            <Text
              style={[
                styles.cardValue,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
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
              size={20}
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
            >
              Remaining
            </Text>
            <Text
              style={[
                styles.cardValue,
                { color: isDark ? "#f4f4f5" : "#18181b" },
              ]}
            >
              {currency}{remaining.toLocaleString()}
            </Text>
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  card: {
    width: "48.2%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
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
    fontSize: 16,
    letterSpacing: -0.3,
  },
});
