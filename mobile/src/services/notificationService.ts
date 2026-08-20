import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { format } from "date-fns";
import { getLocalExpenseByDate } from "../db/sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDER_NOTIFICATION_ID = "daily-expense-reminder";
const REMINDER_ENABLED_KEY = "expenser_daily_reminder_enabled";
const REMINDER_TIME_KEY = "expenser_daily_reminder_time";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationTapListener = () => void;
const notificationListeners: Set<NotificationTapListener> = new Set();

export function addExpenseNotificationListener(listener: NotificationTapListener) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

export function triggerExpenseModalOpen() {
  notificationListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.log("Error running notification listener:", e);
    }
  });
}

/**
 * 5 Sweet, engaging notification templates with user's first name
 */
export function getDailyReminderMessages(userName?: string): { title: string; body: string }[] {
  const rawName = userName ? userName.trim().split(" ")[0] : "";
  const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "there";

  return [
    {
      title: `Hey ${name}! ✨ Quick check-in`,
      body: "Did you spend anything today? Tap here to log it and keep your savings streak glowing! 💸",
    },
    {
      title: `Almost bedtime, ${name}! 🌙`,
      body: "Don't forget to track today's expenses before winding down. Tap to record it in 5 seconds! ✨",
    },
    {
      title: `Stay on top of your savings, ${name}! 🎯`,
      body: "Did you miss adding today's expense? A quick entry keeps your monthly budget crystal clear.",
    },
    {
      title: `Hey ${name}, how was your day? ☕`,
      body: "Take a quick moment to log today's spending and celebrate your savings! 🚀",
    },
    {
      title: `Protect your streak, ${name}! 🔥`,
      body: "You're doing amazing with your budget. Tap here to add today's expense before midnight!",
    },
  ];
}

/**
 * Get a rotating/random reminder message
 */
export function getRandomReminderMessage(userName?: string): { title: string; body: string } {
  const messages = getDailyReminderMessages(userName);
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

let isInitialized = false;

/**
 * Initialize notification channels, permissions, and tap response listeners
 */
export async function initNotificationService(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("daily-reminder", {
        name: "Daily Expense Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#10b981",
        sound: "default",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (!isInitialized) {
      isInitialized = true;

      // Listen for notification taps when app is open or in background
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.action === "ADD_EXPENSE") {
          setTimeout(() => {
            triggerExpenseModalOpen();
          }, 300);
        }
      });

      // Check if app was launched from a notification tap
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response?.notification?.request?.content?.data?.action === "ADD_EXPENSE") {
          setTimeout(() => {
            triggerExpenseModalOpen();
          }, 600);
        }
      });
    }

    return finalStatus === "granted";
  } catch (e) {
    console.log("Error initializing notification service:", e);
    return false;
  }
}

/**
 * Get whether daily reminder is enabled in user settings
 */
export async function isDailyReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

/**
 * Set whether daily reminder is enabled in user settings
 */
export async function setDailyReminderEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, enabled ? "true" : "false");
    if (!enabled) {
      await cancelDailyReminder();
    }
  } catch (e) {
    console.log("Error saving reminder preference:", e);
  }
}

/**
 * Get configured reminder time (hour and minute)
 */
export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  try {
    const val = await AsyncStorage.getItem(REMINDER_TIME_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (typeof parsed.hour === "number" && typeof parsed.minute === "number") {
        return parsed;
      }
    }
  } catch (e) {
    console.log("Error loading reminder time:", e);
  }
  // Default to 10:00 PM (22:00)
  return { hour: 22, minute: 0 };
}

/**
 * Save configured reminder time
 */
export async function setReminderTime(hour: number, minute: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      REMINDER_TIME_KEY,
      JSON.stringify({ hour, minute })
    );
  } catch (e) {
    console.log("Error saving reminder time:", e);
  }
}

/**
 * Format hour and minute to readable AM/PM string (e.g. 10:00 PM)
 */
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute < 10 ? `0${minute}` : `${minute}`;
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Cancel existing scheduled daily reminders
 */
export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
  } catch (e) {
    // Notification might not exist yet
  }
}

/**
 * Send an immediate test notification alert to verify notifications work with custom message
 */
export async function sendTestNotificationNow(userName?: string): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const hasPermission = await initNotificationService();
    if (!hasPermission) return false;

    const { title, body } = getRandomReminderMessage(userName);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { screen: "Home", action: "ADD_EXPENSE" },
        sound: true,
      },
      trigger: null, // Triggers immediately
    });
    return true;
  } catch (e) {
    console.log("Error sending test notification:", e);
    return false;
  }
}

/**
 * Checks if user added today's expense and ensures the customized daily reminder is scheduled
 */
export async function syncDailyReminderStatus(
  userId: string | undefined,
  userName?: string
): Promise<void> {
  if (!userId || Platform.OS === "web") return;

  try {
    const isEnabled = await isDailyReminderEnabled();
    if (!isEnabled) {
      await cancelDailyReminder();
      return;
    }

    const { hour, minute } = await getReminderTime();

    const hasPermission = await initNotificationService();
    if (!hasPermission) return;

    await cancelDailyReminder();

    const { title, body } = getRandomReminderMessage(userName);

    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_NOTIFICATION_ID,
      content: {
        title,
        body,
        data: { screen: "Home", action: "ADD_EXPENSE" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: "daily-reminder",
      },
    });
  } catch (e) {
    console.log("Error syncing daily reminder status:", e);
  }
}
