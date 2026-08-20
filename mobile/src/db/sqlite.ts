import * as SQLite from "expo-sqlite";
import { format } from "date-fns";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("expenser_offline.db");
        await initDatabase(db);
        dbInstance = db;
        return db;
      } catch (err) {
        console.error("Failed to initialize SQLite database:", err);
        throw err;
      } finally {
        initPromise = null;
      }
    })();
  }
  return initPromise;
}

/**
 * Executes a SQLite operation safely. If the connection died or was closed by the OS
 * while the app was backgrounded for hours, it automatically resets and retries.
 */
export async function withSafeDb<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  try {
    const db = await getDatabase();
    return await fn(db);
  } catch (error) {
    console.warn("SQLite query failed, re-establishing database connection and retrying...", error);
    dbInstance = null;
    initPromise = null;
    const db = await getDatabase();
    return await fn(db);
  }
}

async function initDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      limitAmount REAL NOT NULL DEFAULT 500,
      spent REAL NOT NULL DEFAULT 0,
      saved REAL NOT NULL DEFAULT 500,
      note TEXT DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(userId, date);

    CREATE TABLE IF NOT EXISTS settings (
      userId TEXT PRIMARY KEY,
      monthlyBudget REAL NOT NULL DEFAULT 15000,
      dailyBudget REAL NOT NULL DEFAULT 500,
      currency TEXT NOT NULL DEFAULT 'INR',
      theme TEXT NOT NULL DEFAULT 'system',
      currentMonth TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
}

// Local Expense Operations
export async function getLocalExpenseByDate(userId: string, date: string) {
  return await withSafeDb(async (db) => {
    const res = await db.getFirstAsync<{
      id: string;
      userId: string;
      date: string;
      limitAmount: number;
      spent: number;
      saved: number;
      note: string;
      synced: number;
      updatedAt: string;
    }>("SELECT * FROM expenses WHERE userId = ? AND date = ?", [userId, date]);

    if (!res) return null;
    return {
      ...res,
      limit: res.limitAmount ?? 500,
    };
  });
}

export async function getLocalExpensesByMonth(userId: string, monthStr: string) {
  return await withSafeDb(async (db) => {
    const list = await db.getAllAsync<{
      id: string;
      userId: string;
      date: string;
      limitAmount: number;
      spent: number;
      saved: number;
      note: string;
      synced: number;
      updatedAt: string;
    }>("SELECT * FROM expenses WHERE userId = ? AND date LIKE ? ORDER BY date ASC", [
      userId,
      `${monthStr}%`,
    ]);

    return list.map((item) => ({
      ...item,
      limit: item.limitAmount ?? 500,
    }));
  });
}

export async function getAllLocalExpenses(userId: string) {
  return await withSafeDb(async (db) => {
    const list = await db.getAllAsync<{
      id: string;
      userId: string;
      date: string;
      limitAmount: number;
      spent: number;
      saved: number;
      note: string;
      synced: number;
      updatedAt: string;
    }>("SELECT * FROM expenses WHERE userId = ? ORDER BY date ASC", [userId]);

    return list.map((item) => ({
      ...item,
      limit: item.limitAmount ?? 500,
    }));
  });
}

export async function saveLocalExpense(
  userId: string,
  date: string,
  spent: number,
  note: string = "",
  customLimit?: number
) {
  return await withSafeDb(async (db) => {
    const id = `${userId}_${date}`;
    const now = new Date().toISOString();

    let limit = customLimit;
    if (limit === undefined) {
      const set = await getLocalSettings(userId);
      limit = set?.dailyBudget || 500;
    }
    const saved = limit - spent;

    await db.runAsync(
      `INSERT INTO expenses (id, userId, date, limitAmount, spent, saved, note, synced, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET
         limitAmount = excluded.limitAmount,
         spent = excluded.spent,
         saved = excluded.saved,
         note = excluded.note,
         synced = 0,
         updatedAt = excluded.updatedAt`,
      [id, userId, date, limit, spent, saved, note, now]
    );

    // Add to offline sync queue
    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["SAVE_EXPENSE", JSON.stringify({ userId, date, spent, note, limit }), now]
    );

    return { id, userId, date, limit, spent, saved, note, synced: 0, updatedAt: now };
  });
}

export async function bulkUpsertExpensesFromServer(userId: string, serverExpenses: any[]) {
  if (!serverExpenses || serverExpenses.length === 0) return;
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const exp of serverExpenses) {
        const id = `${userId}_${exp.date}`;
        const limit = Number(exp.limit ?? exp.limitAmount ?? 500);
        const spent = Number(exp.spent ?? 0);
        const saved = exp.saved !== undefined ? Number(exp.saved) : limit - spent;
        const note = exp.note || "";

        await db.runAsync(
          `INSERT INTO expenses (id, userId, date, limitAmount, spent, saved, note, synced, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET
             limitAmount = excluded.limitAmount,
             spent = excluded.spent,
             saved = excluded.saved,
             note = excluded.note,
             synced = 1,
             updatedAt = excluded.updatedAt`,
          [id, userId, exp.date, limit, spent, saved, note, exp.updatedAt || now]
        );
      }
    });
  });
}

export async function resetLocalMonthExpenses(userId: string, monthStr: string) {
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    await db.runAsync("DELETE FROM expenses WHERE userId = ? AND date LIKE ?", [
      userId,
      `${monthStr}%`,
    ]);

    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["RESET_MONTH", JSON.stringify({ userId, monthStr }), now]
    );
  });
}

// Local Settings Operations
export async function getLocalSettings(userId: string) {
  return await withSafeDb(async (db) => {
    return await db.getFirstAsync<{
      userId: string;
      monthlyBudget: number;
      dailyBudget: number;
      currency: string;
      theme: string;
      currentMonth: string;
      synced: number;
      updatedAt: string;
    }>("SELECT * FROM settings WHERE userId = ?", [userId]);
  });
}

export async function saveLocalSettings(
  userId: string,
  monthlyBudget: number,
  dailyBudget: number,
  currency: string = "INR",
  theme: string = "system"
) {
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    const currentMonth = format(new Date(), "yyyy-MM");

    await db.runAsync(
      `INSERT INTO settings (userId, monthlyBudget, dailyBudget, currency, theme, currentMonth, synced, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(userId) DO UPDATE SET
         monthlyBudget = excluded.monthlyBudget,
         dailyBudget = excluded.dailyBudget,
         currency = excluded.currency,
         theme = excluded.theme,
         currentMonth = excluded.currentMonth,
         synced = 0,
         updatedAt = excluded.updatedAt`,
      [userId, monthlyBudget, dailyBudget, currency, theme, currentMonth, now]
    );

    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      [
        "SAVE_SETTINGS",
        JSON.stringify({ userId, monthlyBudget, dailyBudget, currency, theme, currentMonth }),
        now,
      ]
    );

    return {
      userId,
      monthlyBudget,
      dailyBudget,
      currency,
      theme,
      currentMonth,
      synced: 0,
      updatedAt: now,
    };
  });
}

export async function upsertSettingsFromServer(userId: string, serverSettings: any) {
  if (!serverSettings) return;
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO settings (userId, monthlyBudget, dailyBudget, currency, theme, currentMonth, synced, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(userId) DO UPDATE SET
         monthlyBudget = excluded.monthlyBudget,
         dailyBudget = excluded.dailyBudget,
         currency = excluded.currency,
         theme = excluded.theme,
         currentMonth = excluded.currentMonth,
         synced = 1,
         updatedAt = excluded.updatedAt`,
      [
        userId,
        Number(serverSettings.monthlyBudget ?? 15000),
        Number(serverSettings.dailyBudget ?? 500),
        serverSettings.currency || "INR",
        serverSettings.theme || "system",
        serverSettings.currentMonth || format(new Date(), "yyyy-MM"),
        serverSettings.updatedAt || now,
      ]
    );
  });
}

// Streak & Month Calculation
export async function calculateStreakFromLocal(userId: string): Promise<number> {
  return await withSafeDb(async (db) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const list = await db.getAllAsync<{
      date: string;
      spent: number;
      saved: number;
      note: string;
    }>("SELECT date, spent, saved, note FROM expenses WHERE userId = ? ORDER BY date DESC", [
      userId,
    ]);

    if (!list || list.length === 0) return 0;

    let streak = 0;
    for (const exp of list) {
      if (exp.date > todayStr) continue;
      const hasData = exp.spent > 0 || (exp.note && exp.note.trim() !== "");
      if (hasData) {
        if (exp.saved >= 0) {
          streak++;
        } else {
          break;
        }
      } else {
        if (exp.date < todayStr) {
          break;
        }
        continue;
      }
    }
    return streak;
  });
}

export async function getUserAvailableMonthsFromLocal(userId: string): Promise<string[]> {
  return await withSafeDb(async (db) => {
    const currentMonth = format(new Date(), "yyyy-MM");

    const list = await db.getAllAsync<{ date: string }>(
      "SELECT DISTINCT SUBSTR(date, 1, 7) as month FROM expenses WHERE userId = ? ORDER BY month DESC",
      [userId]
    );

    const months = list.map((item) => (item as any).month).filter(Boolean);
    if (!months.includes(currentMonth)) {
      months.unshift(currentMonth);
    }
    return months;
  });
}

// Sync Queue helpers
export async function getPendingSyncQueue() {
  return await withSafeDb(async (db) => {
    return await db.getAllAsync<{
      id: number;
      action: string;
      payload: string;
      createdAt: string;
    }>("SELECT * FROM sync_queue ORDER BY id ASC");
  });
}

export async function removeSyncQueueItem(id: number) {
  return await withSafeDb(async (db) => {
    await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
  });
}

export async function markExpenseSynced(id: string) {
  return await withSafeDb(async (db) => {
    await db.runAsync("UPDATE expenses SET synced = 1 WHERE id = ?", [id]);
  });
}

export async function markSettingsSynced(userId: string) {
  return await withSafeDb(async (db) => {
    await db.runAsync("UPDATE settings SET synced = 1 WHERE userId = ?", [userId]);
  });
}
