import React, { useEffect } from "react";
import { View, ActivityIndicator, LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Ignore Expo Go SDK 53/54 advisory warning regarding remote push notifications in Expo Go
LogBox.ignoreLogs([
  /expo-notifications.*Android Push notifications/i,
  /expo-notifications.*not fully supported in Expo Go/i,
]);
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeContext";
import { AuthProvider } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initializeAutoSync } from "./src/services/syncManager";
import { getDatabase } from "./src/db/sqlite";
import { initNotificationService } from "./src/services/notificationService";

function MainApp() {
  const { isDark } = useAppTheme();

  useEffect(() => {
    // Initialize SQLite database, Auto-Sync listener, and Notification Service on startup
    getDatabase().then(() => {
      initializeAutoSync();
      initNotificationService();
    });
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#09090b", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#10b981" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
