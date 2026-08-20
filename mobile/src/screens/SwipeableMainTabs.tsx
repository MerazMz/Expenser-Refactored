import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from "react-native";
import { HomeScreen } from "./HomeScreen";
import { CalendarScreen } from "./CalendarScreen";
import { InsightsScreen } from "./InsightsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { BottomTabBar } from "../components/BottomTabBar";
import { useAppTheme } from "../theme/ThemeContext";
import { TabNavigationContext, TabName } from "../context/TabNavigationContext";

const TAB_NAMES: TabName[] = ["Home", "Calendar", "Insights", "Settings"];

export const SwipeableMainTabs: React.FC = () => {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Keep active index ref updated
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Maintain the exact active tab position across theme toggles and re-renders
  useEffect(() => {
    const targetOffset = activeIndexRef.current * width;
    scrollX.setValue(targetOffset);
    scrollViewRef.current?.scrollTo({ x: targetOffset, animated: false });
  }, [isDark, width]);

  const goToTab = useCallback(
    (tabName: TabName) => {
      const idx = TAB_NAMES.indexOf(tabName);
      if (idx !== -1) {
        setActiveIndex(idx);
        activeIndexRef.current = idx;
        scrollViewRef.current?.scrollTo({ x: idx * width, animated: true });
      }
    },
    [width]
  );

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    activeIndexRef.current = index;
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    scrollX.setValue(offsetX);

    const newIdx = Math.max(
      0,
      Math.min(TAB_NAMES.length - 1, Math.round(offsetX / width))
    );
    if (newIdx !== activeIndexRef.current) {
      activeIndexRef.current = newIdx;
      setActiveIndex(newIdx);
    }
  };

  const handleMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const finalIdx = Math.max(
      0,
      Math.min(TAB_NAMES.length - 1, Math.round(offsetX / width))
    );
    activeIndexRef.current = finalIdx;
    setActiveIndex(finalIdx);
  };

  return (
    <TabNavigationContext.Provider
      value={{
        activeTab: TAB_NAMES[activeIndex],
        activeIndex,
        goToTab,
      }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={{ width, flex: 1 }}>
            <HomeScreen />
          </View>
          <View style={{ width, flex: 1 }}>
            <CalendarScreen />
          </View>
          <View style={{ width, flex: 1 }}>
            <InsightsScreen />
          </View>
          <View style={{ width, flex: 1 }}>
            <SettingsScreen />
          </View>
        </Animated.ScrollView>

        <BottomTabBar
          activeIndex={activeIndex}
          scrollX={scrollX}
          onTabPress={handleTabPress}
        />
      </View>
    </TabNavigationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
