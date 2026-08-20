import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { format } from "date-fns";
import {
  LogOut,
  Pencil,
  Sun,
  Moon,
  RotateCcw,
  Download,
  Database,
  ChevronRight,
  CheckCircle2,
  X,
  Server,
  Bell,
  Clock,
} from "lucide-react-native";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import {
  getLocalSettings,
  saveLocalSettings,
  getLocalExpensesByMonth,
  resetLocalMonthExpenses,
  getUserAvailableMonthsFromLocal,
} from "../db/sqlite";
import { processOfflineSyncQueue, pullLatestDataFromServer } from "../services/syncManager";
import {
  isDailyReminderEnabled,
  setDailyReminderEnabled,
  getReminderTime,
  setReminderTime,
  formatReminderTime,
  syncDailyReminderStatus,
} from "../services/notificationService";
import { API_BASE_URL } from "../services/api";

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { mode, isDark, colors, setThemeMode } = useAppTheme();
  const keyboardHeight = useKeyboardHeight();

  const [monthlyBudget, setMonthlyBudget] = useState(15000);
  const [dailyBudget, setDailyBudget] = useState(500);
  const [currency, setCurrency] = useState("INR");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [reminderTime, setReminderTimeState] = useState<{ hour: number; minute: number }>({
    hour: 22,
    minute: 0,
  });

  // Time Picker Modal State
  const [isTimePickerModalOpen, setIsTimePickerModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("PM");

  // Edit Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [tempMonthly, setTempMonthly] = useState("");
  const [tempDaily, setTempDaily] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Reset Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportMonth, setSelectedExportMonth] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Logout Modal
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const [data, months, reminderVal, timeVal] = await Promise.all([
        getLocalSettings(user.uid),
        getUserAvailableMonthsFromLocal(user.uid),
        isDailyReminderEnabled(),
        getReminderTime(),
      ]);

      if (data) {
        setMonthlyBudget(data.monthlyBudget);
        setDailyBudget(data.dailyBudget);
        setCurrency(data.currency || "INR");
      }
      setAvailableMonths(months);
      setDailyReminder(reminderVal);
      setReminderTimeState(timeVal);

      const h = timeVal.hour % 12 === 0 ? 12 : timeVal.hour % 12;
      setSelectedHour(h);
      setSelectedMinute(timeVal.minute);
      setSelectedPeriod(timeVal.hour >= 12 ? "PM" : "AM");

      if (months.length > 0) {
        setSelectedExportMonth(months[0]);
      }
    } catch (e) {
      console.log("Error loading settings:", e);
    }
  }, [user]);

  const handleToggleReminder = async (value: boolean) => {
    setDailyReminder(value);
    await setDailyReminderEnabled(value);
    if (user?.uid) {
      await syncDailyReminderStatus(user.uid, user.displayName || user.email);
    }
  };

  const handleOpenTimePicker = () => {
    const h = reminderTime.hour % 12 === 0 ? 12 : reminderTime.hour % 12;
    setSelectedHour(h);
    setSelectedMinute(reminderTime.minute);
    setSelectedPeriod(reminderTime.hour >= 12 ? "PM" : "AM");
    setIsTimePickerModalOpen(true);
  };

  const handleSaveReminderTime = async (hour24: number, min: number) => {
    setReminderTimeState({ hour: hour24, minute: min });
    await setReminderTime(hour24, min);
    if (user?.uid) {
      await syncDailyReminderStatus(user.uid, user.displayName || user.email);
    }
    setIsTimePickerModalOpen(false);
  };

  const handleSaveCustomTime = async () => {
    let hour24 = selectedHour % 12;
    if (selectedPeriod === "PM") {
      hour24 += 12;
    }
    await handleSaveReminderTime(hour24, selectedMinute);
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSyncNow = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await pullLatestDataFromServer(user.uid);
      await processOfflineSyncQueue();
      await loadSettings();
      Alert.alert("Sync Complete", "Synced all data with production database!");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenBudgetModal = () => {
    setTempMonthly(monthlyBudget.toString());
    setTempDaily(dailyBudget.toString());
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!user) return;
    const mVal = parseFloat(tempMonthly) || monthlyBudget;
    const dVal = parseFloat(tempDaily) || dailyBudget;
    setIsSavingBudget(true);
    try {
      await saveLocalSettings(user.uid, mVal, dVal, currency, mode);
      setMonthlyBudget(mVal);
      setDailyBudget(dVal);
      setIsBudgetModalOpen(false);
      processOfflineSyncQueue();
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleToggleTheme = async () => {
    const nextMode = isDark ? "light" : "dark";
    setThemeMode(nextMode);
    if (user) {
      await saveLocalSettings(user.uid, monthlyBudget, dailyBudget, currency, nextMode);
      processOfflineSyncQueue();
    }
  };

  const handleConfirmResetMonth = async () => {
    if (!user) return;
    if (resetConfirmInput.trim() !== "CONFIRM") {
      Alert.alert("Confirmation Required", "Please type CONFIRM to proceed.");
      return;
    }
    setIsResetting(true);
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      await resetLocalMonthExpenses(user.uid, currentMonth);
      setIsResetModalOpen(false);
      setResetConfirmInput("");
      processOfflineSyncQueue();
      Alert.alert("Reset Completed", "Current month entries have been cleared.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportConfirm = async () => {
    if (!user || !selectedExportMonth) return;
    setIsExporting(true);
    try {
      const expenses = await getLocalExpensesByMonth(user.uid, selectedExportMonth);
      const rows = expenses.map((e) => ({
        Date: e.date,
        "Limit (Budget)": e.limit,
        Spent: e.spent,
        Saved: e.saved,
        Note: e.note || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

      const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
      const filename = `Expenser_${selectedExportMonth}.xlsx`;
      const uri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setIsExportModalOpen(false);

      if (Platform.OS === "android") {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            await FileSystem.writeAsStringAsync(newUri, wbout, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert("Download Complete", `Excel file saved to your device folder.`);
            return;
          }
        } catch (safErr) {
          console.log("SAF permission/save fallback:", safErr);
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Save Excel Spreadsheet to Device",
          UTI: "com.microsoft.excel.xlsx",
        });
      } else {
        Alert.alert("Export Successful", `File saved at: ${uri}`);
      }
    } catch (err) {
      console.log("Export error:", err);
      Alert.alert("Export Error", "Failed to export spreadsheet.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
          Manage your preferences
        </Text>
      </View>

      {/* User Profile Card */}
      <View
        style={[
          styles.profileCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.profileInfoRow}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: isDark ? "#27272a" : "#18181b" },
            ]}
          >
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={{
                  uri: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(
                    user?.displayName || user?.email || "User"
                  )}&backgroundColor=15803d,0d9488,2563eb,7c3aed`,
                }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            )}
          </View>
          <View style={styles.profileTextCol}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.displayName || "Expenser User"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
              {user?.email || "user@example.com"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsLogoutModalOpen(true)}
          style={styles.logoutBtn}
          activeOpacity={0.7}
        >
          <LogOut size={17} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Budgeting Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Budgeting</Text>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* Current Balance */}
          <TouchableOpacity
            onPress={handleOpenBudgetModal}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Current Balance</Text>
              <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                Total remaining funds
              </Text>
            </View>
            <View style={styles.valWithIcon}>
              <Text style={[styles.settingValue, { color: colors.text }]}>
                ₹{monthlyBudget.toLocaleString()}
              </Text>
              <View style={[styles.pencilBox, { backgroundColor: colors.inputBg }]}>
                <Pencil size={12} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Daily Budget */}
          <TouchableOpacity
            onPress={handleOpenBudgetModal}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Daily Budget</Text>
              <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                Day-wise spending limit
              </Text>
            </View>
            <View style={styles.valWithIcon}>
              <Text style={[styles.settingValue, { color: colors.text }]}>
                ₹{dailyBudget.toLocaleString()}
              </Text>
              <View style={[styles.pencilBox, { backgroundColor: colors.inputBg }]}>
                <Pencil size={12} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* Dark Mode Switch */}
          <View style={styles.settingRow}>
            <View style={styles.rowIconLabel}>
              {isDark ? (
                <Moon size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              ) : (
                <Sun size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              )}
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleToggleTheme}
              trackColor={{ false: "#e4dfd3", true: "#10b981" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Daily Expense Reminder Switch */}
          <View style={styles.settingRow}>
            <View style={styles.rowIconLabel}>
              <Bell size={16} color="#10b981" style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Daily Reminder</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                  Alert if today's expense is missed
                </Text>
              </View>
            </View>
            <Switch
              value={dailyReminder}
              onValueChange={handleToggleReminder}
              trackColor={{ false: "#e4dfd3", true: "#10b981" }}
              thumbColor="#ffffff"
            />
          </View>

          {dailyReminder && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

              {/* Custom Reminder Time Row */}
              <TouchableOpacity
                onPress={handleOpenTimePicker}
                activeOpacity={0.7}
                style={styles.settingRow}
              >
                <View style={styles.rowIconLabel}>
                  <Clock size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>Reminder Time</Text>
                    <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                      Daily alert scheduled time
                    </Text>
                  </View>
                </View>
                <View style={styles.valWithIcon}>
                  <Text style={[styles.settingValue, { color: colors.text }]}>
                    {formatReminderTime(reminderTime.hour, reminderTime.minute)}
                  </Text>
                  <View style={[styles.pencilBox, { backgroundColor: colors.inputBg }]}>
                    <Pencil size={12} color={colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Currency */}
          <View style={styles.settingRow}>
            <View style={styles.rowIconLabel}>
              <Database size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Currency</Text>
            </View>
            <Text style={[styles.settingSubVal, { color: colors.textMuted }]}>INR (₹)</Text>
          </View>
        </View>
      </View>

      {/* Data & Export Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data & Export</Text>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* Export to Excel */}
          <TouchableOpacity
            onPress={() => setIsExportModalOpen(true)}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View style={styles.rowIconLabel}>
              <Download size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Export to Excel</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                  Monthly summary sheet
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Reset Current Month */}
          <TouchableOpacity
            onPress={() => {
              setResetConfirmInput("");
              setIsResetModalOpen(true);
            }}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View style={styles.rowIconLabel}>
              <RotateCcw size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Reset Current Month</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                  Regenerate all daily entries
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Production Database Sync Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cloud Database</Text>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <TouchableOpacity
            onPress={handleSyncNow}
            disabled={isSyncing}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View style={styles.rowIconLabel}>
              <Server size={16} color="#10b981" style={{ marginRight: 10 }} />
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Sync with Cloud Server
                </Text>
                <Text style={[styles.settingSub, { color: "#10b981" }]}>
                  {isSyncing ? "Syncing with cloud..." : "Tap to force sync now"}
                </Text>
              </View>
            </View>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Badge */}
      <View style={styles.footerBadgeRow}>
        <View
          style={[
            styles.footerBadge,
            {
              backgroundColor: isDark ? "rgba(5, 46, 22, 0.4)" : "#ecfdf5",
            },
          ]}
        >
          <CheckCircle2 size={12} color="#10b981" />
          <Text style={styles.footerBadgeText}>v1.0.0 • Production Ready</Text>
        </View>
      </View>

      {/* Edit Budget Modal */}
      <Modal
        visible={isBudgetModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBudgetModalOpen(false)}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsBudgetModalOpen(false)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Configure Budgets</Text>
                <TouchableOpacity onPress={() => setIsBudgetModalOpen(false)}>
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                Set custom limits for your account balance and daily spending.
              </Text>

              <View style={styles.modalFieldGroup}>
                <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>
                  CURRENT BALANCE (₹)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  value={tempMonthly}
                  onChangeText={(val) => setTempMonthly(val.replace(/[^0-9.]/g, ""))}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>
                  DAILY BUDGET (₹)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  value={tempDaily}
                  onChangeText={(val) => setTempDaily(val.replace(/[^0-9.]/g, ""))}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setIsBudgetModalOpen(false)}
                  style={[styles.modalBtnCancel, { borderColor: colors.cardBorder }]}
                >
                  <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveBudget}
                  disabled={isSavingBudget}
                  style={[styles.modalBtnSave, { backgroundColor: colors.primary }]}
                >
                  {isSavingBudget ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnSaveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Month Modal */}
      <Modal
        visible={isExportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Export Transactions</Text>
              <TouchableOpacity onPress={() => setIsExportModalOpen(false)}>
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Select the month you wish to export to an Excel spreadsheet.
            </Text>

            <View style={styles.monthsList}>
              {availableMonths.map((mStr) => {
                const [y, m] = mStr.split("-").map(Number);
                const d = new Date(y, m - 1, 1);
                const isSelected = selectedExportMonth === mStr;

                return (
                  <TouchableOpacity
                    key={mStr}
                    onPress={() => setSelectedExportMonth(mStr)}
                    style={[
                      styles.monthOption,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.inputBg,
                        borderColor: isSelected ? colors.primary : colors.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        { color: isSelected ? "#ffffff" : colors.text },
                      ]}
                    >
                      {format(d, "MMMM yyyy")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsExportModalOpen(false)}
                style={[styles.modalBtnCancel, { borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExportConfirm}
                disabled={isExporting}
                style={[styles.modalBtnSave, { backgroundColor: colors.primary }]}
              >
                {isExporting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>Export Sheet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={isResetModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsResetModalOpen(false)}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setIsResetModalOpen(false);
              setResetConfirmInput("");
            }}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={[styles.modalTitle, { color: colors.danger }]}>Reset Month Entries?</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                Type <Text style={{ fontWeight: "900", color: colors.text }}>CONFIRM</Text> to verify:
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                    textAlign: "center",
                    fontWeight: "900",
                    letterSpacing: 2,
                  },
                ]}
                placeholder="CONFIRM"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="characters"
                value={resetConfirmInput}
                onChangeText={setResetConfirmInput}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    setIsResetModalOpen(false);
                    setResetConfirmInput("");
                  }}
                  style={[styles.modalBtnCancel, { borderColor: colors.cardBorder }]}
                >
                  <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmResetMonth}
                  disabled={isResetting || resetConfirmInput.trim() !== "CONFIRM"}
                  style={[
                    styles.modalBtnSave,
                    {
                      backgroundColor:
                        resetConfirmInput.trim() === "CONFIRM" ? colors.danger : colors.textSubtle,
                    },
                  ]}
                >
                  {isResetting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnSaveText}>Reset</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={isLogoutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Log Out</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Are you sure you want to log out of your account?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsLogoutModalOpen(false)}
                style={[styles.modalBtnCancel, { borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  setIsLogoutModalOpen(false);
                  await logout();
                }}
                style={[styles.modalBtnSave, { backgroundColor: colors.danger }]}
              >
                <Text style={styles.modalBtnSaveText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Reminder Time Picker Modal */}
      <Modal
        visible={isTimePickerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTimePickerModalOpen(false)}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsTimePickerModalOpen(false)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>Set Reminder Time</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                Choose when you'd like to receive your daily expense reminder.
              </Text>

              {/* Quick Presets */}
              <Text style={[styles.presetSectionTitle, { color: colors.textMuted }]}>
                QUICK PRESETS
              </Text>
              <View style={styles.timePresetsGrid}>
                {[
                  { label: "8:00 PM", h: 20, m: 0 },
                  { label: "8:30 PM", h: 20, m: 30 },
                  { label: "9:00 PM", h: 21, m: 0 },
                  { label: "9:30 PM", h: 21, m: 30 },
                  { label: "10:00 PM", h: 22, m: 0 },
                  { label: "10:30 PM", h: 22, m: 30 },
                  { label: "11:00 PM", h: 23, m: 0 },
                ].map((preset) => {
                  const isSelected =
                    reminderTime.hour === preset.h && reminderTime.minute === preset.m;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => handleSaveReminderTime(preset.h, preset.m)}
                      style={[
                        styles.timePresetChip,
                        {
                          backgroundColor: isSelected ? "#10b981" : colors.inputBg,
                          borderColor: isSelected ? "#10b981" : colors.inputBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.timePresetText,
                          { color: isSelected ? "#ffffff" : colors.text },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Time Selector */}
              <Text style={[styles.presetSectionTitle, { color: colors.textMuted, marginTop: 14 }]}>
                CUSTOM TIME
              </Text>
              <View style={styles.customTimeRow}>
                {/* Hour */}
                <View style={styles.timeInputCol}>
                  <Text style={[styles.timeInputLabel, { color: colors.textMuted }]}>Hour</Text>
                  <View style={styles.timeCounterRow}>
                    <TouchableOpacity
                      onPress={() => setSelectedHour((prev) => (prev <= 1 ? 12 : prev - 1))}
                      style={[styles.timeCounterBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Text style={[styles.timeCounterBtnText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeCounterVal, { color: colors.text }]}>
                      {selectedHour < 10 ? `0${selectedHour}` : selectedHour}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSelectedHour((prev) => (prev >= 12 ? 1 : prev + 1))}
                      style={[styles.timeCounterBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Text style={[styles.timeCounterBtnText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Separator */}
                <Text style={[styles.timeColon, { color: colors.text }]}>:</Text>

                {/* Minute */}
                <View style={styles.timeInputCol}>
                  <Text style={[styles.timeInputLabel, { color: colors.textMuted }]}>Minute</Text>
                  <View style={styles.timeCounterRow}>
                    <TouchableOpacity
                      onPress={() => setSelectedMinute((prev) => (prev <= 0 ? 55 : prev - 5))}
                      style={[styles.timeCounterBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Text style={[styles.timeCounterBtnText, { color: colors.text }]}>-</Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeCounterVal, { color: colors.text }]}>
                      {selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSelectedMinute((prev) => (prev >= 55 ? 0 : prev + 5))}
                      style={[styles.timeCounterBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Text style={[styles.timeCounterBtnText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.timeInputCol}>
                  <Text style={[styles.timeInputLabel, { color: colors.textMuted }]}>Period</Text>
                  <View style={styles.periodToggleRow}>
                    <TouchableOpacity
                      onPress={() => setSelectedPeriod("AM")}
                      style={[
                        styles.periodBtn,
                        {
                          backgroundColor: selectedPeriod === "AM" ? "#10b981" : colors.inputBg,
                          borderColor: selectedPeriod === "AM" ? "#10b981" : colors.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodBtnText,
                          { color: selectedPeriod === "AM" ? "#ffffff" : colors.text },
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedPeriod("PM")}
                      style={[
                        styles.periodBtn,
                        {
                          backgroundColor: selectedPeriod === "PM" ? "#10b981" : colors.inputBg,
                          borderColor: selectedPeriod === "PM" ? "#10b981" : colors.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodBtnText,
                          { color: selectedPeriod === "PM" ? "#ffffff" : colors.text },
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setIsTimePickerModalOpen(false)}
                  style={[styles.modalBtnCancel, { borderColor: colors.cardBorder }]}
                >
                  <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveCustomTime}
                  style={[styles.modalBtnSave, { backgroundColor: "#10b981" }]}
                >
                  <Text style={styles.modalBtnSaveText}>Save Time</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 14,
  },
  screenTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
    marginTop: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 13,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarLetter: {
    color: "#ffffff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
    textTransform: "uppercase",
  },
  profileTextCol: {},
  profileName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  profileEmail: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10.5,
    marginTop: 1,
  },
  logoutBtn: {
    padding: 8,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowIconLabel: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12.5,
  },
  settingSub: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10,
    marginTop: 2,
  },
  settingValue: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 13,
  },
  settingSubVal: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  valWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  pencilBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  divider: {
    height: 1,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10.5,
    color: "#10b981",
  },
  footerBadgeRow: {
    alignItems: "center",
    marginTop: 6,
  },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    gap: 5,
  },
  footerBadgeText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    color: "#10b981",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  modalSub: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 14,
  },
  modalFieldGroup: {
    marginBottom: 12,
  },
  modalFieldLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  modalInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  monthsList: {
    gap: 8,
    marginBottom: 14,
  },
  monthOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthOptionText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12.5,
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancelText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
  },
  modalBtnSave: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSaveText: {
    fontFamily: "Outfit_700Bold",
    color: "#ffffff",
    fontSize: 12.5,
  },
  testBtnPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  testBtnText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    color: "#3b82f6",
  },
  presetSectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  timePresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timePresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  timePresetText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
  },
  customTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  timeInputCol: {
    alignItems: "center",
  },
  timeInputLabel: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 10,
    marginBottom: 4,
  },
  timeCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeCounterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timeCounterBtnText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15,
  },
  timeCounterVal: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 17,
    minWidth: 24,
    textAlign: "center",
  },
  timeColon: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    marginTop: 12,
  },
  periodToggleRow: {
    flexDirection: "row",
    gap: 4,
  },
  periodBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  periodBtnText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
  },
});
