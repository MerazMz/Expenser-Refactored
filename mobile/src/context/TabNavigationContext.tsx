import React, { createContext, useContext } from "react";

export type TabName = "Home" | "Calendar" | "Insights" | "Settings";

export interface TabNavigationContextType {
  activeTab: TabName;
  activeIndex: number;
  goToTab: (tab: TabName) => void;
}

export const TabNavigationContext = createContext<TabNavigationContextType>({
  activeTab: "Home",
  activeIndex: 0,
  goToTab: () => {},
});

export const useTabNavigation = () => useContext(TabNavigationContext);
