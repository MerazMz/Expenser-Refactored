import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { Sparkles, Wallet, TrendingDown, TrendingUp, Compass } from "lucide-react-native";
import { useAppTheme } from "../theme/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TodayCardProps {
  limit: number;
  spent: number;
  currency?: string;
  accountType?: "budget" | "flex";
  availableBalance?: number;
  initialBalance?: number;
  monthSpent?: number;
  accountName?: string;
  accentColor?: string;
}

export const TodayCard: React.FC<TodayCardProps> = ({
  limit,
  spent,
  currency = "₹",
  accountType = "budget",
  availableBalance = 0,
  initialBalance = 0,
  monthSpent = 0,
  accountName,
  accentColor = "#10b981",
}) => {
  const { isDark } = useAppTheme();

  const isFlex = accountType === "flex";

  // Calculations for Fixed Budget mode
  const displaySaved = Math.max(0, limit - spent);
  const percentageSaved =
    limit > 0 ? Math.max(0, Math.min(100, Math.round((displaySaved / limit) * 100))) : 100;
  const isBudgetExceeded = spent > limit;
  const overAmount = spent - limit;

  // Calculations for Flex / Track As You Go mode
  const flexBalance = Math.max(0, availableBalance);
  const flexSpentPercent =
    initialBalance > 0
      ? Math.min(100, Math.round((monthSpent / initialBalance) * 100))
      : 0;

  // SVG circular gauge calculations
  const size = 88;
  const strokeWidth = 7;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const targetPercent = isFlex ? 100 - flexSpentPercent : percentageSaved;
    const targetOffset = !isFlex && isBudgetExceeded
      ? 0
      : circumference - (circumference * Math.max(0, targetPercent)) / 100;

    Animated.timing(animatedOffset, {
      toValue: targetOffset,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percentageSaved, flexSpentPercent, isBudgetExceeded, isFlex, circumference]);

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? "#090b0a" : "#121214",
          borderColor: isDark ? "rgba(39, 39, 42, 0.6)" : "rgba(39, 39, 42, 0.4)",
        },
      ]}
    >
      {/* Soft, Subtle Ambient Liquid Glass Glow */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            {/* Top-Left Subtle Glow matching accent color */}
            <RadialGradient id="liquidTopLeft" cx="10%" cy="10%" rx="80%" ry="80%">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
              <Stop offset="40%" stopColor={accentColor} stopOpacity="0.05" />
              <Stop offset="80%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>

            {/* Bottom-Right Subtle Glow */}
            <RadialGradient id="liquidBottom" cx="90%" cy="90%" rx="80%" ry="80%">
              <Stop offset="0%" stopColor={isFlex ? "#3b82f6" : "#0d9488"} stopOpacity="0.15" />
              <Stop offset="40%" stopColor={accentColor} stopOpacity="0.04" />
              <Stop offset="80%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Rect x="0" y="0" width="100%" height="100%" fill="url(#liquidTopLeft)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#liquidBottom)" />
        </Svg>
      </View>

      {/* Card Content Grid */}
      <View style={styles.contentRow}>
        {/* Left Column: Financial Data */}
        <View style={styles.leftColumn}>
          {/* Header Badge */}
          <View style={styles.savingsBadgeRow}>
            {isFlex ? (
              <Compass size={12} color={accentColor} />
            ) : (
              <Sparkles size={12} color="#34d399" />
            )}
            <Text
              style={[
                styles.savingsLabel,
                { color: isFlex ? accentColor : "#a1a1aa" },
              ]}
            >
              {isFlex ? "AVAILABLE BALANCE" : "SAVINGS TODAY"}
            </Text>
          </View>

          {/* Main Amount */}
          <Text style={styles.savingsAmount}>
            {currency}
            {isFlex
              ? flexBalance.toLocaleString()
              : displaySaved.toLocaleString()}
          </Text>

          {/* Secondary Info */}
          {isFlex ? (
            <View style={styles.budgetRow}>
              <View style={styles.walletBox}>
                <Wallet size={12} color="#a1a1aa" />
              </View>
              <Text style={styles.budgetText}>
                Initial: <Text style={styles.budgetBold}>{currency}{initialBalance.toLocaleString()}</Text>
              </Text>
            </View>
          ) : (
            <View style={styles.budgetRow}>
              <View style={styles.walletBox}>
                <Wallet size={12} color="#a1a1aa" />
              </View>
              <Text style={styles.budgetText}>
                Daily Budget: <Text style={styles.budgetBold}>{currency}{limit.toLocaleString()}</Text>
              </Text>
            </View>
          )}

          {/* Status Pill */}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isFlex
                  ? "rgba(59, 130, 246, 0.15)"
                  : isBudgetExceeded
                  ? "rgba(225, 29, 72, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                borderColor: isFlex
                  ? "rgba(59, 130, 246, 0.3)"
                  : isBudgetExceeded
                  ? "rgba(225, 29, 72, 0.3)"
                  : "rgba(16, 185, 129, 0.3)",
              },
            ]}
          >
            {isFlex ? (
              <TrendingUp size={12} color="#60a5fa" style={{ marginRight: 5 }} />
            ) : isBudgetExceeded ? (
              <TrendingDown size={12} color="#f43f5e" style={{ marginRight: 5 }} />
            ) : (
              <TrendingUp size={12} color="#34d399" style={{ marginRight: 5 }} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: isFlex
                    ? "#93c5fd"
                    : isBudgetExceeded
                    ? "#fb7185"
                    : "#34d399",
                },
              ]}
            >
              {isFlex
                ? "Track As You Go • No daily limits"
                : isBudgetExceeded
                ? `Over budget by ${currency}${overAmount.toLocaleString()}`
                : `${percentageSaved}% budget saved`}
            </Text>
          </View>
        </View>

        {/* Right Column: Gauges and Spent Indicator */}
        <View style={styles.rightColumn}>
          <View style={styles.gaugeWrapper}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={isDark ? "rgba(39, 39, 42, 0.65)" : "rgba(255, 255, 255, 0.15)"}
                strokeWidth={strokeWidth}
                fill="none"
              />

              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={!isFlex && isBudgetExceeded ? "#f43f5e" : accentColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={animatedOffset}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>

            <View style={styles.gaugeTextOverlay}>
              <Text style={styles.gaugePercentText}>
                {isFlex ? `${Math.max(0, 100 - flexSpentPercent)}%` : `${percentageSaved}%`}
              </Text>
              <Text style={styles.gaugeSubText}>
                {isFlex ? "LEFT" : "SAVED"}
              </Text>
            </View>
          </View>

          <View style={styles.spentBox}>
            <Text style={styles.spentLabel}>SPENT TODAY</Text>
            <Text style={styles.spentValue}>
              {currency}{spent.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 14,
  },
  savingsBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  savingsLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 9.5,
    letterSpacing: 1.2,
    marginLeft: 5,
    textTransform: "uppercase",
  },
  savingsAmount: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 34,
    color: "#ffffff",
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  walletBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "rgba(39, 39, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },
  budgetText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11.5,
    color: "#a1a1aa",
  },
  budgetBold: {
    fontFamily: "Outfit_700Bold",
    color: "#ffffff",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  statusText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    letterSpacing: 0.1,
  },
  rightColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 10,
  },
  gaugeWrapper: {
    width: 88,
    height: 88,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  gaugeTextOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugePercentText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15,
    color: "#ffffff",
    lineHeight: 18,
  },
  gaugeSubText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 7.5,
    color: "#71717a",
    letterSpacing: 1,
    marginTop: 1,
  },
  spentBox: {
    alignItems: "center",
    marginTop: 4,
  },
  spentLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 8.5,
    color: "#71717a",
    letterSpacing: 0.6,
  },
  spentValue: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
    color: "#ffffff",
    marginTop: 1.5,
  },
});
