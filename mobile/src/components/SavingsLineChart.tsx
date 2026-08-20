import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Text as SvgText,
  Circle,
  G,
  Rect,
} from "react-native-svg";
import { format } from "date-fns";
import { useAppTheme } from "../theme/ThemeContext";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const screenWidth = Dimensions.get("window").width;

interface SavingsLineChartProps {
  data: {
    date: string;
    saved: number;
  }[];
  currency?: string;
}

export const SavingsLineChart: React.FC<SavingsLineChartProps> = ({
  data,
  currency = "₹",
}) => {
  const { colors, isDark } = useAppTheme();

  const chartWidth = Math.min(screenWidth - 36, 420);
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 32;
  const paddingBottom = 34;

  const pathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pathAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data]);

  const strokeOffset = pathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1400, 0],
  });

  const { pathData, areaData, maxPoint, gridLines, xAxisLabels } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathData: "", areaData: "", maxPoint: null, gridLines: [], xAxisLabels: [] };
    }

    const values = data.map((d) => d.saved);
    const minVal = Math.min(...values, -200);
    const maxVal = Math.max(...values, 200);
    const range = maxVal - minVal || 1;

    const innerWidth = chartWidth - paddingLeft - paddingRight;
    const innerHeight = chartHeight - paddingTop - paddingBottom;

    const getX = (index: number) => {
      if (data.length <= 1) return paddingLeft + innerWidth / 2;
      return paddingLeft + (index / (data.length - 1)) * innerWidth;
    };

    const getY = (val: number) => {
      return paddingTop + innerHeight - ((val - minVal) / range) * innerHeight;
    };

    const coords = data.map((d, i) => ({
      x: getX(i),
      y: getY(d.saved),
      saved: d.saved,
      date: d.date,
    }));

    const pathData = coords
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const zeroY = Math.max(paddingTop, Math.min(paddingTop + innerHeight, getY(0)));
    const areaData =
      coords.length > 1 ? `${pathData} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z` : "";

    let maxPt = coords[0];
    for (const pt of coords) {
      if (pt.saved > maxPt.saved) maxPt = pt;
    }

    const gridLines = [
      Math.round(maxVal),
      0,
      Math.round(minVal),
    ].map((val) => ({
      y: getY(val),
      label: `${val > 0 ? "+" : ""}${val}`,
    }));

    const labelsCount = Math.min(data.length, 4);
    const xAxisLabels: { x: number; label: string }[] = [];

    if (data.length === 1) {
      xAxisLabels.push({
        x: getX(0),
        label: format(new Date(`${data[0].date}T00:00:00`), "d MMM"),
      });
    } else {
      const step = (data.length - 1) / (labelsCount - 1);
      for (let i = 0; i < labelsCount; i++) {
        const idx = Math.round(i * step);
        const item = data[idx];
        if (item) {
          xAxisLabels.push({
            x: getX(idx),
            label: format(new Date(`${item.date}T00:00:00`), "d MMM"),
          });
        }
      }
    }

    return { pathData, areaData, maxPoint: maxPt, gridLines, xAxisLabels };
  }, [data, chartWidth, chartHeight]);

  if (!data || data.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: isDark ? "#18181b" : "#ffffff",
            borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
          },
        ]}
      >
        <Text
          style={[
            styles.emptyText,
            { color: isDark ? "#a1a1aa" : "#71717a" },
          ]}
        >
          No data available for this month
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? "#18181b" : "#ffffff",
          borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
        },
      ]}
    >
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="chartAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
            <Stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Horizontal Dashed Grid Lines */}
        {gridLines.map((line, idx) => (
          <G key={idx}>
            <Line
              x1={paddingLeft}
              y1={line.y}
              x2={chartWidth - paddingRight}
              y2={line.y}
              stroke={isDark ? "rgba(39, 39, 42, 0.75)" : "rgba(228, 223, 211, 0.9)"}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <SvgText
              x={paddingLeft - 8}
              y={line.y + 4}
              textAnchor="end"
              fill={isDark ? "#71717a" : "#a1a1aa"}
              fontSize="10"
              fontFamily="Outfit_600SemiBold"
            >
              {line.label}
            </SvgText>
          </G>
        ))}

        {/* X Axis Date Labels */}
        {xAxisLabels.map((lbl, idx) => (
          <SvgText
            key={idx}
            x={lbl.x}
            y={chartHeight - 10}
            textAnchor="middle"
            fill={isDark ? "#a1a1aa" : "#71717a"}
            fontSize="10"
            fontFamily="Outfit_600SemiBold"
          >
            {lbl.label}
          </SvgText>
        ))}

        {/* Area Gradient Fill */}
        {areaData ? (
          <Path d={areaData} fill="url(#chartAreaGradient)" opacity={0.85} />
        ) : null}

        {/* Smooth Animated Curved Line */}
        {pathData ? (
          <AnimatedPath
            d={pathData}
            fill="none"
            stroke="#10b981"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1400}
            strokeDashoffset={strokeOffset}
          />
        ) : null}

        {/* Tooltip & Dot on Max Point */}
        {maxPoint ? (
          <G>
            <Circle
              cx={maxPoint.x}
              cy={maxPoint.y}
              r="5"
              fill="#10b981"
              stroke={isDark ? "#ffffff" : "#18181b"}
              strokeWidth="2.5"
            />
            {/* Tooltip Pill */}
            <G
              x={Math.max(
                paddingLeft,
                Math.min(chartWidth - paddingRight - 54, maxPoint.x - 27)
              )}
              y={Math.max(6, maxPoint.y - 28)}
            >
              <Rect
                width="54"
                height="22"
                rx="11"
                fill="#1b4332"
                stroke="rgba(34, 197, 94, 0.5)"
                strokeWidth="1.2"
              />
              <SvgText
                x="27"
                y="15"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10.5"
                fontFamily="Outfit_800ExtraBold"
              >
                {currency}{maxPoint.saved}
              </SvgText>
            </G>
          </G>
        ) : null}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyContainer: {
    width: "100%",
    height: 180,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
  },
});
