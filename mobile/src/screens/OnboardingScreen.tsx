import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { ArrowRight, Check } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { saveLocalSettings, saveLocalAccount } from "../db/sqlite";
import { processOfflineSyncQueue } from "../services/syncManager";
import * as Haptics from "expo-haptics";

export const OnboardingScreen: React.FC = () => {
  const { user, setIsOnboarded } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [step, setStep] = useState(1);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();

  const handleNext = () => {
    if (step === 1) {
      const num = parseFloat(monthlyBudget);
      if (isNaN(num) || num <= 0) return;

      if (!dailyBudget) {
        const recommended = Math.round(num / daysInMonth);
        setDailyBudget(recommended.toString());
      }
      setStep(2);
    }
  };

  const handleFinish = async () => {
    if (!user || !monthlyBudget || !dailyBudget) return;
    const mNum = parseFloat(monthlyBudget) || 15000;
    const dNum = parseFloat(dailyBudget) || Math.round(mNum / daysInMonth);

    setIsLoading(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await saveLocalSettings(user.uid, mNum, dNum, "INR", isDark ? "dark" : "light");
      await saveLocalAccount({
        userId: user.uid,
        name: "Daily Savings",
        type: "budget",
        initialBalance: mNum,
        monthlyBudget: mNum,
        dailyBudget: dNum,
        currency: "INR",
        color: "#10b981",
        icon: "wallet",
        isDefault: 1,
      });
      processOfflineSyncQueue();
      setIsOnboarded(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.centerCard}>
          {/* Header */}
          <View style={styles.headerBox}>
            <Text style={[styles.brandTitle, { color: colors.text }]}>
              {step === 1 ? "expenser" : "Daily Limit"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {step === 1
                ? "Let's set up your starting account balance."
                : "Set your custom day-wise spending limit."}
            </Text>
          </View>

          {/* Input Card Container */}
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
              {step === 1 ? "CURRENT BALANCE" : "DAILY BUDGET LIMIT"}
            </Text>

            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.currencyBox,
                  { backgroundColor: isDark ? "#27272a" : "#ffffff" },
                ]}
              >
                <Text style={[styles.currencySymbol, { color: colors.text }]}>₹</Text>
              </View>
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                placeholder={step === 1 ? "5000" : "200"}
                placeholderTextColor={colors.textSubtle}
                keyboardType="decimal-pad"
                inputMode="decimal"
                autoFocus
                value={step === 1 ? monthlyBudget : dailyBudget}
                onChangeText={(val) => {
                  const sanitized = val.replace(/[^0-9.]/g, "");
                  if (step === 1) {
                    setMonthlyBudget(sanitized);
                  } else {
                    setDailyBudget(sanitized);
                  }
                }}
              />
            </View>

            {step === 2 && (
              <Text style={[styles.recommendationText, { color: colors.textMuted }]}>
                Recommended:{" "}
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.text }}>
                  ₹{Math.round((parseFloat(monthlyBudget) || 0) / daysInMonth)}/day
                </Text>
              </Text>
            )}
          </View>

          {/* Step Indicator Dots */}
          <View style={styles.dotsRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: step === 1 ? colors.primary : colors.cardBorder },
              ]}
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: step === 2 ? colors.primary : colors.cardBorder },
              ]}
            />
          </View>

          {/* Action Buttons */}
          {step === 1 ? (
            <View style={{ width: "100%", gap: 10 }}>
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.85}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <ArrowRight size={14} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsOnboarded(true)}
                style={styles.goBackBtn}
              >
                <Text style={[styles.goBackText, { color: colors.textMuted }]}>
                  Skip to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: "100%", gap: 10 }}>
              <TouchableOpacity
                onPress={handleFinish}
                disabled={isLoading}
                activeOpacity={0.85}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Get Started</Text>
                    <Check size={15} color="#ffffff" strokeWidth={2.5} style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(1)} style={styles.goBackBtn}>
                <Text style={[styles.goBackText, { color: colors.textMuted }]}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  centerCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  headerBox: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 6,
    textTransform: "lowercase",
  },
  subtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
  inputCard: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 52,
  },
  currencyBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  currencySymbol: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  textInput: {
    flex: 1,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 24,
    height: "100%",
  },
  recommendationText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10.5,
    marginTop: 10,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  primaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  goBackBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  goBackText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
});
