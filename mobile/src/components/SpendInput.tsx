import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Sparkles, Tag, X, Check, Calculator } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../theme/ThemeContext";

interface SpendInputProps {
  initialSpent: number;
  initialNote: string;
  currency?: string;
  onSave: (spent: number, note: string) => Promise<void>;
}

export function evaluateSpendExpression(input: string): { value: number; isExpression: boolean } {
  if (!input || !input.trim()) return { value: 0, isExpression: false };

  const raw = input.trim();
  const hasOperators = /[+\-*/]/.test(raw);
  const hasSeparators = /[,\s]/.test(raw);

  if (!hasOperators && !hasSeparators) {
    const num = parseFloat(raw);
    return { value: isNaN(num) ? 0 : num, isExpression: false };
  }

  try {
    // Replace commas with +
    let expr = raw
      .replace(/,/g, " + ")
      .replace(/\s+/g, " ")
      .trim();

    // Replace numbers separated by spaces (e.g. "50 20") with +
    expr = expr.replace(/(\d+(\.\d+)?)\s+(\d+(\.\d+)?)/g, "$1 + $3");

    // Replace any remaining invalid characters except arithmetic
    const sanitized = expr.replace(/[^0-9+\-*/.]/g, "");
    if (/^[0-9+\-*/.\s]+$/.test(sanitized)) {
      const cleanExpr = sanitized.replace(/[+\-*/.]+$/, "");
      if (cleanExpr) {
        const result = Function(`"use strict"; return (${cleanExpr})`)();
        if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
          return { value: Math.max(0, Math.round(result * 100) / 100), isExpression: true };
        }
      }
    }
  } catch (e) {
    // ignore partial syntax errors while typing
  }

  const fallback = parseFloat(raw.replace(/,/g, ""));
  return { value: isNaN(fallback) ? 0 : fallback, isExpression: false };
}

export const SpendInput: React.FC<SpendInputProps> = ({
  initialSpent = 0,
  initialNote = "",
  currency = "₹",
  onSave,
}) => {
  const { colors, isDark } = useAppTheme();

  const [spent, setSpent] = useState("");
  const [note, setNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { value: evaluatedSpent, isExpression } = evaluateSpendExpression(spent);

  useEffect(() => {
    if (!isEditing) {
      setSpent("");
      setNote("");
    }
  }, [initialSpent, initialNote, isEditing]);

  const handleAddPreset = (amount: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const currentVal = evaluatedSpent;
    setSpent((currentVal + amount).toString());
    setIsSaved(false);
  };

  const handleSave = async () => {
    const numSpent = evaluatedSpent;
    if (isNaN(numSpent) || numSpent < 0) return;

    setIsLoading(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const newTotalSpent = isEditing ? numSpent : initialSpent + numSpent;
      const newNote = isEditing
        ? note.trim()
        : initialNote
        ? note.trim()
          ? `${initialNote}, ${note.trim()}`
          : initialNote
        : note.trim();

      await onSave(newTotalSpent, newNote);

      setIsSaved(true);
      setSpent("");
      setNote("");
      setIsEditing(false);

      setTimeout(() => {
        setIsSaved(false);
      }, 1200);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#18181b" : "#ffffff",
          borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "rgba(228, 223, 211, 0.9)",
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Sparkles size={15} color="#34d399" />
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? "#f4f4f5" : "#18181b" },
            ]}
          >
            {isEditing ? "Edit Today's Entry" : "Add Today's Spending"}
          </Text>
        </View>
        {isEditing && (
          <TouchableOpacity
            onPress={() => {
              setIsEditing(false);
              setSpent("");
              setNote("");
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Amount Input Box with Live Calculator */}
      <View
        style={[
          styles.amountInputRow,
          {
            backgroundColor: isDark ? "rgba(10, 10, 12, 0.85)" : "#f7f5f0",
            borderColor: isDark ? "rgba(39, 39, 42, 0.8)" : "#e8e4db",
          },
        ]}
      >
        <View
          style={[
            styles.currencyPill,
            { backgroundColor: isDark ? "#27272a" : "#ffffff" },
          ]}
        >
          <Text
            style={[
              styles.currencyText,
              { color: isDark ? "#e4e4e7" : "#27272a" },
            ]}
          >
            {currency}
          </Text>
        </View>

        <TextInput
          style={[
            styles.numericInput,
            { color: isDark ? "#f4f4f5" : "#18181b" },
          ]}
          placeholder="0"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
          autoCapitalize="none"
          autoCorrect={false}
          value={spent}
          onChangeText={(val) => {
            const sanitized = val.replace(/[^0-9.+/*,\s-]/g, "");
            setSpent(sanitized);
            setIsSaved(false);
          }}
        />

        {/* Live Evaluated Total Badge */}
        {isExpression && (
          <View style={styles.evalBadge}>
            <Calculator size={12} color="#10b981" style={{ marginRight: 3 }} />
            <Text style={styles.evalBadgeText}>
              = {currency}{evaluatedSpent.toLocaleString()}
            </Text>
          </View>
        )}

        {spent !== "" && (
          <TouchableOpacity onPress={() => setSpent("")} style={styles.clearBtn}>
            <X size={16} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick-Add Preset Chips */}
      <View style={styles.presetsRow}>
        {[50, 100, 200, 500].map((amount) => (
          <TouchableOpacity
            key={amount}
            onPress={() => handleAddPreset(amount)}
            activeOpacity={0.7}
            style={[
              styles.presetChip,
              {
                backgroundColor: isDark ? "rgba(24, 24, 27, 0.9)" : "#f7f5f0",
                borderColor: isDark ? "rgba(39, 39, 42, 0.7)" : "#e8e4db",
              },
            ]}
          >
            <Text
              style={[
                styles.presetText,
                { color: isDark ? "#e4e4e7" : "#3f3f46" },
              ]}
            >
              +{currency}{amount}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setSpent("0");
            setIsSaved(false);
          }}
          activeOpacity={0.7}
          style={styles.presetChipZero}
        >
          <Text style={styles.presetZeroText}>₹0 (No spend)</Text>
        </TouchableOpacity>
      </View>

      {/* Note Input Row */}
      <View
        style={[
          styles.noteInputRow,
          {
            backgroundColor: isDark ? "rgba(10, 10, 12, 0.85)" : "#f7f5f0",
            borderColor: isDark ? "rgba(39, 39, 42, 0.7)" : "#e8e4db",
          },
        ]}
      >
        <Tag size={15} color={isDark ? "#71717a" : "#a1a1aa"} style={{ marginRight: 8 }} />
        <TextInput
          style={[
            styles.noteTextInput,
            { color: isDark ? "#f4f4f5" : "#18181b" },
          ]}
          placeholder="What did you buy? (e.g. Coffee, Groceries)"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          value={note}
          onChangeText={setNote}
        />
      </View>

      {/* Action Button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={isLoading || (spent === "" && !isEditing)}
        activeOpacity={0.85}
        style={[
          styles.actionButton,
          {
            backgroundColor: isSaved
              ? "#059669"
              : spent !== "" || isEditing
              ? colors.primary
              : isDark
              ? "#27272a"
              : "#e4dfd3",
            opacity: isLoading ? 0.7 : 1,
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : isSaved ? (
          <View style={styles.btnContentRow}>
            <Check size={16} color="#ffffff" strokeWidth={3} style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>Saved Successfully!</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>
            {isEditing
              ? `Save Changes (${currency}${evaluatedSpent})`
              : isExpression
              ? `Add Today's Expense (${currency}${evaluatedSpent})`
              : "Add Today's Expense"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Summary of Entries Logged Today */}
      {initialSpent > 0 && !isEditing && (
        <View
          style={[
            styles.loggedSummaryCard,
            {
              backgroundColor: isDark ? "rgba(10, 10, 12, 0.7)" : "rgba(247, 245, 240, 0.8)",
              borderColor: isDark ? "rgba(39, 39, 42, 0.5)" : "#e8e4db",
            },
          ]}
        >
          <View style={styles.loggedLeftRow}>
            <View style={styles.checkCircleBox}>
              <Check size={15} color="#34d399" strokeWidth={2.5} />
            </View>
            <View style={styles.loggedTextCol}>
              <Text
                style={[
                  styles.loggedTitle,
                  { color: isDark ? "#ffffff" : "#18181b" },
                ]}
              >
                Logged Today: {currency}{initialSpent.toLocaleString()}
              </Text>
              <Text style={styles.loggedNote} numberOfLines={1}>
                {initialNote || "No note recorded"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              setSpent(initialSpent.toString());
              setNote(initialNote);
              setIsEditing(true);
            }}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    marginLeft: 6,
  },
  cancelText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: "#a1a1aa",
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 10,
  },
  currencyPill: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  currencyText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  numericInput: {
    flex: 1,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    height: "100%",
  },
  evalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  evalBadgeText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 12,
    color: "#10b981",
  },
  clearBtn: {
    padding: 6,
  },
  presetsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 7,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11.5,
  },
  presetChipZero: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(113, 113, 122, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(113, 113, 122, 0.3)",
  },
  presetZeroText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    color: "#a1a1aa",
  },
  noteInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  noteTextInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 12.5,
  },
  actionButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnText: {
    fontFamily: "Outfit_700Bold",
    color: "#ffffff",
    fontSize: 14,
  },
  loggedSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  loggedLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  checkCircleBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  loggedTextCol: {
    flex: 1,
  },
  loggedTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13.5,
  },
  loggedNote: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11,
    color: "#a1a1aa",
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 9,
    backgroundColor: "rgba(27, 67, 50, 0.45)",
  },
  editBtnText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11.5,
    color: "#34d399",
  },
});
