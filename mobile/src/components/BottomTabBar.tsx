import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import {
  LayoutGrid,
  Calendar as CalendarIcon,
  BarChart2,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { useAppTheme } from "../theme/ThemeContext";
import * as Haptics from "expo-haptics";

const TABS: { name: string; label: string; icon: any }[] = [
  { name: "Home", label: "Home", icon: LayoutGrid },
  { name: "Calendar", label: "Calendar", icon: CalendarIcon },
  { name: "Insights", label: "Insights", icon: BarChart2 },
  { name: "Settings", label: "Settings", icon: SettingsIcon },
];

interface BottomTabBarProps {
  activeIndex?: number;
  scrollX?: Animated.Value;
  onTabPress?: (index: number) => void;
  state?: any;
  descriptors?: any;
  navigation?: any;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeIndex = 0,
  scrollX,
  onTabPress,
  state,
  navigation,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const { isDark } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const currentIndex = state ? state.index : activeIndex;
  const slideAnim = useRef(new Animated.Value(currentIndex)).current;

  // Spring animation when activeIndex changes
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentIndex,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  const padding = 5;
  const tabWidth = containerWidth > 0 ? (containerWidth - padding * 2) / TABS.length : 0;

  const handlePress = (index: number, routeKey?: string, routeName?: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onTabPress) {
      onTabPress(index);
    }
    if (navigation && routeKey && routeName) {
      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    }
  };

  const translateX =
    tabWidth > 0
      ? scrollX
        ? scrollX.interpolate({
            inputRange: [0, screenWidth, 2 * screenWidth, 3 * screenWidth],
            outputRange: [
              padding,
              tabWidth + padding,
              2 * tabWidth + padding,
              3 * tabWidth + padding,
            ],
            extrapolate: "clamp",
          })
        : slideAnim.interpolate({
            inputRange: [0, 1, 2, 3],
            outputRange: [
              padding,
              tabWidth + padding,
              2 * tabWidth + padding,
              3 * tabWidth + padding,
            ],
          })
      : 0;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[
          styles.pillContainer,
          {
            backgroundColor: isDark ? "rgba(18, 18, 20, 0.96)" : "rgba(255, 255, 255, 0.96)",
            borderColor: isDark ? "rgba(39, 39, 42, 0.75)" : "rgba(228, 223, 211, 0.9)",
            shadowOpacity: isDark ? 0.35 : 0.12,
          },
        ]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Smooth Gliding Active Pill Indicator */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingPill,
              {
                width: tabWidth,
                transform: [{ translateX }],
                backgroundColor: isDark ? "rgba(39, 39, 42, 0.85)" : "#e4dfd3",
              },
            ]}
          />
        )}

        {TABS.map((tab, index) => {
          const isFocused = currentIndex === index;
          const IconComponent = tab.icon;
          const routeKey = state?.routes?.[index]?.key;
          const routeName = state?.routes?.[index]?.name || tab.name;

          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={() => handlePress(index, routeKey, routeName)}
              activeOpacity={0.8}
              style={styles.tabButton}
            >
              <IconComponent
                size={18}
                color={
                  isFocused
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : isDark
                    ? "#71717a"
                    : "#a1a1aa"
                }
                strokeWidth={isFocused ? 2.3 : 1.75}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : isDark
                      ? "#71717a"
                      : "#a1a1aa",
                    fontFamily: isFocused ? "Outfit_700Bold" : "Outfit_500Medium",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 18,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "88%",
    maxWidth: 360,
    borderRadius: 26,
    borderWidth: 1,
    padding: 5,
    position: "relative",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  slidingPill: {
    position: "absolute",
    top: 5,
    bottom: 5,
    borderRadius: 18,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 18,
    zIndex: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.2,
  },
});
