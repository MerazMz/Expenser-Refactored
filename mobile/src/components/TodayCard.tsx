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
import { Sparkles, Wallet, TrendingDown, TrendingUp } from "lucide-react-native";
import { useAppTheme } from "../theme/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TodayCardProps {
  limit: number;
  spent: number;
  currency?: string;
}

export const TodayCard: React.FC<TodayCardProps> = ({ limit, spent, currency = "₹" }) => {
  const { isDark } = useAppTheme();

  const displaySaved = Math.max(0, limit - spent);
  const percentageSaved =
    limit > 0 ? Math.max(0, Math.min(100, Math.round((displaySaved / limit) * 100))) : 100;
  const isBudgetExceeded = spent > limit;
  const overAmount = spent - limit;

  // SVG circular gauge calculations (spacious & bold)
  const size = 88;
  const strokeWidth = 7;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const targetOffset = isBudgetExceeded
      ? 0
      : circumference - (circumference * percentageSaved) / 100;

    Animated.timing(animatedOffset, {
      toValue: targetOffset,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percentageSaved, isBudgetExceeded, circumference]);

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
            {/* Top-Left Subtle Emerald Glow */}
            <RadialGradient id="liquidTopLeft" cx="10%" cy="10%" rx="80%" ry="80%">
              <Stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
              <Stop offset="40%" stopColor="#10b981" stopOpacity="0.05" />
              <Stop offset="80%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>

            {/* Bottom-Right Subtle Teal Glow */}
            <RadialGradient id="liquidBottom" cx="90%" cy="90%" rx="80%" ry="80%">
              <Stop offset="0%" stopColor="#0d9488" stopOpacity="0.15" />
              <Stop offset="40%" stopColor="#059669" stopOpacity="0.04" />
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
          {/* Savings Today Header Badge */}
          <View style={styles.savingsBadgeRow}>
            <Sparkles size={12} color="#34d399" />
            <Text style={styles.savingsLabel}>SAVINGS TODAY</Text>
          </View>

          {/* Main Amount */}
          <Text style={styles.savingsAmount}>
            {currency}{displaySaved.toLocaleString()}
          </Text>

          {/* Daily Budget Info */}
          <View style={styles.budgetRow}>
            <View style={styles.walletBox}>
              <Wallet size={12} color="#a1a1aa" />
            </View>
            <Text style={styles.budgetText}>
              Daily Budget: <Text style={styles.budgetBold}>{currency}{limit.toLocaleString()}</Text>
            </Text>
          </View>

          {/* Status Pill */}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isBudgetExceeded
                  ? "rgba(225, 29, 72, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                borderColor: isBudgetExceeded
                  ? "rgba(225, 29, 72, 0.3)"
                  : "rgba(16, 185, 129, 0.3)",
              },
            ]}
          >
            {isBudgetExceeded ? (
              <TrendingDown size={12} color="#f43f5e" style={{ marginRight: 5 }} />
            ) : (
              <TrendingUp size={12} color="#34d399" style={{ marginRight: 5 }} />
            )}
            <Text
              style={[
                styles.statusText,
                { color: isBudgetExceeded ? "#fb7185" : "#34d399" },
              ]}
            >
              {isBudgetExceeded
                ? `Over budget by ${currency}${overAmount.toLocaleString()}`
                : `${percentageSaved}% budget saved`}
            </Text>
          </View>
        </View>

        {/* Right Column: Gauges and Spent Indicator */}
        <View style={styles.rightColumn}>
          <View style={styles.gaugeWrapper}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Defs>
                <LinearGradient id="liquidEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#10b981" />
                  <Stop offset="100%" stopColor="#059669" />
                </LinearGradient>
              </Defs>

              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="rgba(39, 39, 42, 0.65)"
                strokeWidth={strokeWidth}
                fill="none"
              />

              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={isBudgetExceeded ? "#f43f5e" : "url(#liquidEmerald)"}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={animatedOffset}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>

            <View style={styles.gaugeTextOverlay}>
              <Text style={styles.gaugePercentText}>
                {percentageSaved}%
              </Text>
              <Text style={styles.gaugeSubText}>SAVED</Text>
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
    color: "#a1a1aa",
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
