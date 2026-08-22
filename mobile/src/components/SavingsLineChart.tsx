import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, useWindowDimensions, Animated, Easing } from "react-native";
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

interface SavingsLineChartProps {
  data: {
    date: string;
    saved: number;
  }[];
  currency?: string;
  accentColor?: string;
}

export const SavingsLineChart: React.FC<SavingsLineChartProps> = ({
  data,
  currency = "₹",
  accentColor = "#10b981",
}) => {
  const { colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const chartWidth = Math.max(280, Math.min(windowWidth - 32, 420));
  const chartHeight = 220;
  const paddingLeft = 38;
  const paddingRight = 16;
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
            backgroundColor: isDark ? "#13141a" : "#ffffff",
            borderColor: isDark ? "#232630" : "#e5e7eb",
          },
        ]}
      >
        <Text
          style={[
            styles.emptyText,
            { color: isDark ? "#71717a" : "#9ca3af" },
          ]}
        >
          No data recorded for this month
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? "#13141a" : "#ffffff",
          borderColor: isDark ? "#232630" : "#e5e7eb",
        },
      ]}
    >
      <Svg width={chartWidth} height={chartHeight}>
        {/* Horizontal Dashed Grid Lines */}
        {gridLines.map((line, idx) => (
          <G key={idx}>
            <Line
              x1={paddingLeft}
              y1={line.y}
              x2={chartWidth - paddingRight}
              y2={line.y}
              stroke={isDark ? "rgba(39, 39, 42, 0.7)" : "rgba(229, 231, 235, 0.9)"}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <SvgText
              x={paddingLeft - 8}
              y={line.y + 4}
              textAnchor="end"
              fill={isDark ? "#71717a" : "#9ca3af"}
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
            fill={isDark ? "#71717a" : "#9ca3af"}
            fontSize="10"
            fontFamily="Outfit_600SemiBold"
          >
            {lbl.label}
          </SvgText>
        ))}

        {/* Area Fill with Theme Color Tint */}
        {areaData ? (
          <Path d={areaData} fill={accentColor} opacity={0.12} />
        ) : null}

        {/* Smooth Animated Curved Line in Solid Theme Color */}
        {pathData ? (
          <AnimatedPath
            d={pathData}
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
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
              r="4.5"
              fill={accentColor}
              stroke={isDark ? "#13141a" : "#ffffff"}
              strokeWidth="2.5"
            />
            {/* Tooltip Pill */}
            <G
              x={Math.max(
                paddingLeft,
                Math.min(chartWidth - paddingRight - 62, maxPoint.x - 31)
              )}
              y={Math.max(6, maxPoint.y - 28)}
            >
              <Rect
                width="62"
                height="22"
                rx="11"
                fill={isDark ? "#1c1e26" : "#ffffff"}
                stroke={accentColor}
                strokeWidth="1.2"
              />
              <SvgText
                x="31"
                y="15.5"
                textAnchor="middle"
                fill={isDark ? "#f4f4f5" : "#111827"}
                fontSize="11"
                fontFamily="Outfit_700Bold"
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
