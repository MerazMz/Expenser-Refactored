import * as SQLite from "expo-sqlite";
import { format, subDays } from "date-fns";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: "budget" | "flex"; // 'budget' (Fixed Daily Budget) or 'flex' (Track As You Go)
  initialBalance: number;
  monthlyBudget: number;
  dailyBudget: number;
  currency: string;
  color: string;
  icon: string;
  isDefault: number;
  synced: number;
  createdAt?: string;
  updatedAt: string;
}

export interface LocalExpense {
  id: string;
  userId: string;
  accountId?: string;
  date: string;
  limit: number;
  limitAmount?: number;
  spent: number;
  saved: number;
  note: string;
  synced: number;
  updatedAt: string;
}

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
 * Executes a SQLite operation safely.
 */
export async function withSafeDb<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  try {
    const db = await getDatabase();
    return await fn(db);
  } catch (error) {
    console.error("SQLite query error:", error);
    throw error;
  }
}

async function initDatabase(db: SQLite.SQLiteDatabase) {
  // Create tables using clean single statements with no trailing delimiters
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS accounts (" +
      "id TEXT PRIMARY KEY, " +
      "userId TEXT NOT NULL, " +
      "name TEXT NOT NULL, " +
      "type TEXT NOT NULL DEFAULT 'budget', " +
      "initialBalance REAL NOT NULL DEFAULT 0, " +
      "monthlyBudget REAL NOT NULL DEFAULT 0, " +
      "dailyBudget REAL NOT NULL DEFAULT 0, " +
      "currency TEXT NOT NULL DEFAULT 'INR', " +
      "color TEXT DEFAULT '#10b981', " +
      "icon TEXT DEFAULT 'wallet', " +
      "isDefault INTEGER NOT NULL DEFAULT 0, " +
      "synced INTEGER NOT NULL DEFAULT 0, " +
      "createdAt TEXT NOT NULL DEFAULT '', " +
      "updatedAt TEXT NOT NULL)"
  );

  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(userId)"
  );

  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS expenses (" +
      "id TEXT PRIMARY KEY, " +
      "userId TEXT NOT NULL, " +
      "accountId TEXT, " +
      "date TEXT NOT NULL, " +
      "limitAmount REAL NOT NULL DEFAULT 500, " +
      "spent REAL NOT NULL DEFAULT 0, " +
      "saved REAL NOT NULL DEFAULT 500, " +
      "note TEXT DEFAULT '', " +
      "synced INTEGER NOT NULL DEFAULT 0, " +
      "updatedAt TEXT NOT NULL)"
  );

  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS settings (" +
      "userId TEXT PRIMARY KEY, " +
      "activeAccountId TEXT, " +
      "monthlyBudget REAL NOT NULL DEFAULT 15000, " +
      "dailyBudget REAL NOT NULL DEFAULT 500, " +
      "currency TEXT NOT NULL DEFAULT 'INR', " +
      "theme TEXT NOT NULL DEFAULT 'system', " +
      "currentMonth TEXT NOT NULL DEFAULT '', " +
      "synced INTEGER NOT NULL DEFAULT 0, " +
      "updatedAt TEXT NOT NULL)"
  );

  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS sync_queue (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "action TEXT NOT NULL, " +
      "payload TEXT NOT NULL, " +
      "createdAt TEXT NOT NULL)"
  );

  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS sync_metadata (" +
      "key TEXT PRIMARY KEY, " +
      "value TEXT NOT NULL, " +
      "updatedAt TEXT NOT NULL)"
  );

  // Migration: Ensure legacy unique indexes on (userId, date) are dropped
  try {
    await db.execAsync("DROP INDEX IF EXISTS idx_expenses_user_date");
    await db.execAsync("DROP INDEX IF EXISTS idx_expenses_date");
  } catch (e) {
    // ignore
  }

  // Migration: Ensure createdAt column exists on accounts
  try {
    const accInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(accounts)");
    if (accInfo && Array.isArray(accInfo)) {
      const hasCreatedAt = accInfo.some((col) => col.name === "createdAt");
      if (!hasCreatedAt) {
        await db.execAsync("ALTER TABLE accounts ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''");
      }
    }
  } catch (e) {
    console.warn("Migration warning for createdAt column on accounts:", e);
  }

  // Migration: Ensure accountId column exists on expenses
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(expenses)");
    if (tableInfo && Array.isArray(tableInfo)) {
      const hasAccountId = tableInfo.some((col) => col.name === "accountId");
      if (!hasAccountId) {
        await db.execAsync("ALTER TABLE expenses ADD COLUMN accountId TEXT");
      }
    }
  } catch (e) {
    console.warn("Migration warning for accountId column on expenses:", e);
  }

  // Migration: Ensure activeAccountId column exists on settings
  try {
    const setInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(settings)");
    if (setInfo && Array.isArray(setInfo)) {
      const hasActiveAccount = setInfo.some((col) => col.name === "activeAccountId");
      if (!hasActiveAccount) {
        await db.execAsync("ALTER TABLE settings ADD COLUMN activeAccountId TEXT");
      }
    }
  } catch (e) {
    console.warn("Migration warning for activeAccountId column on settings:", e);
  }

  // Migration: Backfill orphaned expenses and clean up duplicates
  try {
    await db.execAsync(
      "UPDATE expenses SET accountId = (" +
        "SELECT id FROM accounts WHERE userId = expenses.userId ORDER BY isDefault DESC, createdAt ASC LIMIT 1" +
      ") WHERE (accountId IS NULL OR accountId = '') AND EXISTS (SELECT 1 FROM accounts WHERE userId = expenses.userId)"
    );

    await db.execAsync(
      "DELETE FROM expenses WHERE rowid NOT IN (" +
        "SELECT max(rowid) FROM expenses GROUP BY userId, COALESCE(accountId, ''), date" +
      ")"
    );
  } catch (e) {
    console.warn("Migration warning for duplicate expense cleanup:", e);
  }
}

// ----------------------------------------------------
// Local Account Operations
// ----------------------------------------------------

export async function getLocalAccounts(userId: string): Promise<Account[]> {
  return await withSafeDb(async (db) => {
    let list = await db.getAllAsync<Account>(
      "SELECT * FROM accounts WHERE userId = ? ORDER BY isDefault DESC, createdAt ASC, updatedAt ASC",
      [userId]
    );

    // If user has no accounts yet, auto-provision default account from settings
    if (!list || list.length === 0) {
      const set = await getLocalSettings(userId);
      const defaultId = `${userId}_default`;
      const now = new Date().toISOString();
      const defaultAccount: Account = {
        id: defaultId,
        userId,
        name: "Daily Savings",
        type: "budget",
        initialBalance: set?.monthlyBudget || 15000,
        monthlyBudget: set?.monthlyBudget || 15000,
        dailyBudget: set?.dailyBudget || 500,
        currency: set?.currency || "INR",
        color: "#10b981",
        icon: "wallet",
        isDefault: 1,
        synced: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.runAsync(
        `INSERT INTO accounts (id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault, synced, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [
          defaultAccount.id,
          defaultAccount.userId,
          defaultAccount.name,
          defaultAccount.type,
          defaultAccount.initialBalance,
          defaultAccount.monthlyBudget,
          defaultAccount.dailyBudget,
          defaultAccount.currency,
          defaultAccount.color,
          defaultAccount.icon,
          defaultAccount.isDefault,
          now,
          now,
        ]
      );

      // Backfill any existing expenses without accountId
      await db.runAsync("UPDATE expenses SET accountId = ? WHERE userId = ? AND (accountId IS NULL OR accountId = '')", [
        defaultId,
        userId,
      ]);

      // Set activeAccountId on settings
      await db.runAsync("UPDATE settings SET activeAccountId = ? WHERE userId = ?", [defaultId, userId]);

      list = [defaultAccount];
    }

    return list;
  });
}

export async function saveLocalAccount(
  accountData: Partial<Account> & { userId: string; name: string }
): Promise<Account> {
  return await withSafeDb(async (db) => {
    const id = accountData.id || `${accountData.userId}_${Date.now()}`;
    const now = new Date().toISOString();
    const type = accountData.type || "budget";
    const initialBalance = Number(accountData.initialBalance ?? (type === "flex" ? 5000 : 15000));
    const monthlyBudget = Number(accountData.monthlyBudget ?? (type === "budget" ? initialBalance : 0));
    const dailyBudget = Number(accountData.dailyBudget ?? (type === "budget" ? 500 : 0));
    const currency = accountData.currency || "INR";
    const color = accountData.color || (type === "flex" ? "#3b82f6" : "#10b981");
    const icon = accountData.icon || (type === "flex" ? "utensils" : "wallet");
    const isDefault = accountData.isDefault ? 1 : 0;

    const createdAt = accountData.createdAt || now;

    await db.runAsync(
      `INSERT INTO accounts (id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault, synced, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         type = excluded.type,
         initialBalance = excluded.initialBalance,
         monthlyBudget = excluded.monthlyBudget,
         dailyBudget = excluded.dailyBudget,
         currency = excluded.currency,
         color = excluded.color,
         icon = excluded.icon,
         isDefault = excluded.isDefault,
         synced = 0,
         updatedAt = excluded.updatedAt`,
      [
        id,
        accountData.userId,
        accountData.name,
        type,
        initialBalance,
        monthlyBudget,
        dailyBudget,
        currency,
        color,
        icon,
        isDefault,
        createdAt,
        now,
      ]
    );

    const savedAccount: Account = {
      id,
      userId: accountData.userId,
      name: accountData.name,
      type,
      initialBalance,
      monthlyBudget,
      dailyBudget,
      currency,
      color,
      icon,
      isDefault,
      synced: 0,
      createdAt,
      updatedAt: now,
    };

    // Add to sync queue
    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["CREATE_ACCOUNT", JSON.stringify(savedAccount), now]
    );

    return savedAccount;
  });
}

export async function deleteLocalAccount(userId: string, accountId: string): Promise<void> {
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    await db.runAsync("DELETE FROM accounts WHERE id = ? AND userId = ?", [accountId, userId]);
    await db.runAsync("DELETE FROM expenses WHERE accountId = ? AND userId = ?", [accountId, userId]);

    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["DELETE_ACCOUNT", JSON.stringify({ id: accountId, userId }), now]
    );
  });
}

export async function getActiveAccountId(userId: string): Promise<string> {
  return await withSafeDb(async (db) => {
    const set = await db.getFirstAsync<{ activeAccountId: string }>(
      "SELECT activeAccountId FROM settings WHERE userId = ?",
      [userId]
    );

    if (set?.activeAccountId) {
      return set.activeAccountId;
    }

    const accounts = await getLocalAccounts(userId);
    return accounts[0]?.id || `${userId}_default`;
  });
}

export async function setActiveAccountId(userId: string, accountId: string): Promise<void> {
  return await withSafeDb(async (db) => {
    await db.runAsync(
      `INSERT INTO settings (userId, activeAccountId, monthlyBudget, dailyBudget, currency, theme, currentMonth, synced, updatedAt)
       VALUES (?, ?, 15000, 500, 'INR', 'system', '', 0, ?)
       ON CONFLICT(userId) DO UPDATE SET activeAccountId = excluded.activeAccountId, updatedAt = excluded.updatedAt`,
      [userId, accountId, new Date().toISOString()]
    );
  });
}

export async function bulkUpsertAccountsFromServer(userId: string, serverAccounts: any[]) {
  if (!serverAccounts || serverAccounts.length === 0) return;
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      const serverIds: string[] = [];
      for (const acc of serverAccounts) {
        serverIds.push(acc.id);
        await db.runAsync(
          `INSERT INTO accounts (id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault, synced, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             type = excluded.type,
             initialBalance = excluded.initialBalance,
             monthlyBudget = excluded.monthlyBudget,
             dailyBudget = excluded.dailyBudget,
             currency = excluded.currency,
             color = excluded.color,
             icon = excluded.icon,
             isDefault = excluded.isDefault,
             synced = 1,
             updatedAt = excluded.updatedAt`,
          [
            acc.id,
            userId,
            acc.name || "My Account",
            acc.type || "budget",
            Number(acc.initialBalance ?? 0),
            Number(acc.monthlyBudget ?? 0),
            Number(acc.dailyBudget ?? 0),
            acc.currency || "INR",
            acc.color || "#10b981",
            acc.icon || "wallet",
            acc.isDefault ? 1 : 0,
            acc.createdAt || now,
            acc.updatedAt || now,
          ]
        );
      }

      // Reconcile: remove local synced accounts that were deleted on the server
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => "?").join(",");
        await db.runAsync(
          `DELETE FROM accounts WHERE userId = ? AND synced = 1 AND id NOT IN (${placeholders})`,
          [userId, ...serverIds]
        );
      }
    });
  });
}

// ----------------------------------------------------
// Local Expense Operations (Scoped by Account)
// ----------------------------------------------------

export async function getLocalExpenseByDate(
  userId: string,
  date: string,
  accountId?: string
): Promise<LocalExpense | null> {
  return await withSafeDb(async (db) => {
    let res: any;
    if (accountId) {
      res = await db.getFirstAsync(
        "SELECT * FROM expenses WHERE userId = ? AND date = ? AND accountId = ? ORDER BY updatedAt DESC",
        [userId, date, accountId]
      );
    } else {
      res = await db.getFirstAsync(
        "SELECT * FROM expenses WHERE userId = ? AND date = ? ORDER BY updatedAt DESC",
        [userId, date]
      );
    }

    if (!res) return null;
    return {
      ...res,
      limit: res.limitAmount ?? 500,
    };
  });
}

export async function getLocalExpensesByMonth(
  userId: string,
  monthStr: string,
  accountId?: string
): Promise<LocalExpense[]> {
  return await withSafeDb(async (db) => {
    let list: any[];
    if (accountId) {
      list = await db.getAllAsync(
        "SELECT * FROM expenses WHERE userId = ? AND date LIKE ? AND accountId = ? ORDER BY date ASC, updatedAt DESC",
        [userId, `${monthStr}%`, accountId]
      );
    } else {
      list = await db.getAllAsync(
        "SELECT * FROM expenses WHERE userId = ? AND date LIKE ? ORDER BY date ASC, updatedAt DESC",
        [userId, `${monthStr}%`]
      );
    }

    // Deduplicate by date
    const map = new Map<string, any>();
    for (const item of list) {
      if (!map.has(item.date)) {
        map.set(item.date, item);
      }
    }

    return Array.from(map.values()).map((item) => ({
      ...item,
      limit: item.limitAmount ?? 500,
    }));
  });
}

export async function getAllLocalExpenses(userId: string, accountId?: string): Promise<LocalExpense[]> {
  return await withSafeDb(async (db) => {
    let list: any[];
    if (accountId) {
      list = await db.getAllAsync(
        "SELECT * FROM expenses WHERE userId = ? AND accountId = ? ORDER BY date ASC, updatedAt DESC",
        [userId, accountId]
      );
    } else {
      list = await db.getAllAsync(
        "SELECT * FROM expenses WHERE userId = ? ORDER BY date ASC, updatedAt DESC",
        [userId]
      );
    }

    const map = new Map<string, any>();
    for (const item of list) {
      if (!map.has(item.date)) {
        map.set(item.date, item);
      }
    }

    return Array.from(map.values()).map((item) => ({
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
  customLimit?: number,
  accountId?: string
): Promise<LocalExpense> {
  return await withSafeDb(async (db) => {
    const actId = accountId || (await getActiveAccountId(userId));
    const id = `${userId}_${actId}_${date}`;
    const now = new Date().toISOString();

    let limit = customLimit;
    if (limit === undefined) {
      const accounts = await getLocalAccounts(userId);
      const currentAcc = accounts.find((a) => a.id === actId);
      limit = currentAcc?.type === "flex" ? 0 : currentAcc?.dailyBudget || 500;
    }
    const saved = limit > 0 ? limit - spent : 0;

    // Delete any previous row for this EXACT (userId, accountId, date) and any orphaned rows
    await db.runAsync(
      "DELETE FROM expenses WHERE userId = ? AND accountId = ? AND date = ?",
      [userId, actId, date]
    );
    await db.runAsync(
      "DELETE FROM expenses WHERE userId = ? AND date = ? AND (accountId IS NULL OR accountId = '' OR id = ?)",
      [userId, date, `${userId}_${date}`]
    );

    await db.runAsync(
      `INSERT OR REPLACE INTO expenses (id, userId, accountId, date, limitAmount, spent, saved, note, synced, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, actId, date, limit, spent, saved, note, now]
    );

    // Add to offline sync queue
    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["SAVE_EXPENSE", JSON.stringify({ userId, accountId: actId, date, spent, note, limit }), now]
    );

    return { id, userId, accountId: actId, date, limit, spent, saved, note, synced: 0, updatedAt: now };
  });
}

export async function bulkUpsertExpensesFromServer(userId: string, serverExpenses: any[]) {
  if (!serverExpenses || serverExpenses.length === 0) return;
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const exp of serverExpenses) {
        const actId = exp.accountId || `${userId}_default`;
        const id = exp.id || `${userId}_${actId}_${exp.date}`;
        const limit = Number(exp.limit ?? exp.limitAmount ?? 500);
        const spent = Number(exp.spent ?? 0);
        const saved = exp.saved !== undefined ? Number(exp.saved) : limit > 0 ? limit - spent : 0;
        const note = exp.note || "";

        await db.runAsync(
          `INSERT OR REPLACE INTO expenses (id, userId, accountId, date, limitAmount, spent, saved, note, synced, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, userId, actId, exp.date, limit, spent, saved, note, exp.updatedAt || now]
        );
      }
    });
  });
}

// ----------------------------------------------------
// Incremental Sync Metadata & Change Application
// ----------------------------------------------------

export async function getLocalSyncCursor(userId: string): Promise<number> {
  return await withSafeDb(async (db) => {
    const res = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = ?",
      [`${userId}_sync_cursor`]
    );
    return res ? parseInt(res.value, 10) || 0 : 0;
  });
}

export async function setLocalSyncCursor(userId: string, cursor: number): Promise<void> {
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_metadata (key, value, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      [`${userId}_sync_cursor`, cursor.toString(), now]
    );
  });
}

export async function applyIncrementalSyncChanges(userId: string, changes: any[]): Promise<boolean> {
  if (!changes || changes.length === 0) return false;
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const change of changes) {
        const { entityType, entityId, operation, data } = change;

        if (entityType === "expense") {
          if (operation === "delete") {
            await db.runAsync("DELETE FROM expenses WHERE id = ? OR (userId = ? AND id LIKE ?)", [
              entityId,
              userId,
              `%${entityId}%`,
            ]);
          } else if (operation === "delete_month") {
            const { accountId, monthStr } = data || {};
            if (accountId) {
              await db.runAsync("DELETE FROM expenses WHERE userId = ? AND accountId = ? AND date LIKE ?", [
                userId,
                accountId,
                `${monthStr}%`,
              ]);
            } else if (monthStr) {
              await db.runAsync("DELETE FROM expenses WHERE userId = ? AND date LIKE ?", [
                userId,
                `${monthStr}%`,
              ]);
            }
          } else if (operation === "upsert" || operation === "create" || operation === "update") {
            const exp = data;
            const actId = exp.accountId || `${userId}_default`;
            const id = exp.id || `${userId}_${actId}_${exp.date}`;
            const limit = Number(exp.limit ?? exp.limitAmount ?? 500);
            const spent = Number(exp.spent ?? 0);
            const saved = exp.saved !== undefined ? Number(exp.saved) : limit > 0 ? limit - spent : 0;
            const note = exp.note || "";

            await db.runAsync(
              `INSERT INTO expenses (id, userId, accountId, date, limitAmount, spent, saved, note, synced, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
               ON CONFLICT(id) DO UPDATE SET
                 accountId = excluded.accountId,
                 date = excluded.date,
                 limitAmount = excluded.limitAmount,
                 spent = excluded.spent,
                 saved = excluded.saved,
                 note = excluded.note,
                 synced = 1,
                 updatedAt = excluded.updatedAt`,
              [id, userId, actId, exp.date, limit, spent, saved, note, exp.updatedAt || now]
            );
          }
        } else if (entityType === "account") {
          if (operation === "delete") {
            await db.runAsync("DELETE FROM accounts WHERE id = ? AND userId = ?", [entityId, userId]);
          } else if (operation === "upsert" || operation === "create" || operation === "update") {
            const acc = data;
            await db.runAsync(
              `INSERT INTO accounts (id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault, synced, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 type = excluded.type,
                 initialBalance = excluded.initialBalance,
                 monthlyBudget = excluded.monthlyBudget,
                 dailyBudget = excluded.dailyBudget,
                 currency = excluded.currency,
                 color = excluded.color,
                 icon = excluded.icon,
                 isDefault = excluded.isDefault,
                 synced = 1,
                 updatedAt = excluded.updatedAt`,
              [
                acc.id,
                userId,
                acc.name,
                acc.type || "budget",
                Number(acc.initialBalance) || 0,
                Number(acc.monthlyBudget) || 0,
                Number(acc.dailyBudget) || 0,
                acc.currency || "INR",
                acc.color || "#10b981",
                acc.icon || "wallet",
                acc.isDefault ? 1 : 0,
                acc.createdAt || now,
                acc.updatedAt || now,
              ]
            );
          }
        } else if (entityType === "settings") {
          const set = data;
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
              Number(set.monthlyBudget) || 0,
              Number(set.dailyBudget) || 0,
              set.currency || "INR",
              set.theme || "dark",
              set.currentMonth || "",
              set.updatedAt || now,
            ]
          );
        }
      }
    });
    return true;
  });
}

export async function resetLocalMonthExpenses(userId: string, monthStr: string, accountId?: string) {
  return await withSafeDb(async (db) => {
    const now = new Date().toISOString();
    if (accountId) {
      await db.runAsync("DELETE FROM expenses WHERE userId = ? AND accountId = ? AND date LIKE ?", [
        userId,
        accountId,
        `${monthStr}%`,
      ]);
    } else {
      await db.runAsync("DELETE FROM expenses WHERE userId = ? AND date LIKE ?", [
        userId,
        `${monthStr}%`,
      ]);
    }

    await db.runAsync(
      "INSERT INTO sync_queue (action, payload, createdAt) VALUES (?, ?, ?)",
      ["RESET_MONTH", JSON.stringify({ userId, accountId, monthStr }), now]
    );
  });
}

// ----------------------------------------------------
// Local Settings Operations
// ----------------------------------------------------

export async function getLocalSettings(userId: string) {
  return await withSafeDb(async (db) => {
    return await db.getFirstAsync<{
      userId: string;
      activeAccountId?: string;
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

// ----------------------------------------------------
// Streak & Metrics Operations
// ----------------------------------------------------

export async function calculateStreakFromLocal(userId: string, accountId?: string): Promise<number> {
  return await withSafeDb(async (db) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    let list: any[];
    if (accountId) {
      list = await db.getAllAsync<{
        date: string;
        spent: number;
        saved: number;
        note: string;
      }>("SELECT date, spent, saved, note FROM expenses WHERE userId = ? AND accountId = ?", [
        userId,
        accountId,
      ]);
    } else {
      list = await db.getAllAsync<{
        date: string;
        spent: number;
        saved: number;
        note: string;
      }>("SELECT date, spent, saved, note FROM expenses WHERE userId = ?", [
        userId,
      ]);
    }

    if (!list || list.length === 0) return 0;

    const expenseMap = new Map<string, { spent: number; saved: number; note: string }>();
    for (const exp of list) {
      expenseMap.set(exp.date, exp);
    }

    let streak = 0;

    // Check today: if user saved today, add to streak; if over budget today, streak is 0
    const todayExp = expenseMap.get(todayStr);
    const todayHasData = todayExp && (todayExp.spent > 0 || (todayExp.note && todayExp.note.trim() !== ""));

    if (todayHasData) {
      if (todayExp.saved >= 0) {
        streak++;
      } else {
        return 0; // Broken today
      }
    }

    // Step backwards day by day from yesterday
    for (let i = 1; i <= 365; i++) {
      const prevDate = subDays(today, i);
      const prevDateStr = format(prevDate, "yyyy-MM-dd");
      const exp = expenseMap.get(prevDateStr);

      if (!exp) {
        // If there's a day gap without an entry, consecutive streak ends
        break;
      }

      const hasData = exp.spent > 0 || (exp.note && exp.note.trim() !== "");
      if (hasData) {
        if (exp.saved >= 0) {
          streak++;
        } else {
          break;
        }
      } else {
        if (exp.saved >= 0) {
          streak++;
        } else {
          break;
        }
      }
    }

    return streak;
  });
}

export async function getUserAvailableMonthsFromLocal(userId: string, accountId?: string): Promise<string[]> {
  return await withSafeDb(async (db) => {
    const currentMonth = format(new Date(), "yyyy-MM");

    let list: any[];
    if (accountId) {
      list = await db.getAllAsync<{ date: string }>(
        "SELECT DISTINCT SUBSTR(date, 1, 7) as month FROM expenses WHERE userId = ? AND (accountId = ? OR accountId IS NULL) ORDER BY month DESC",
        [userId, accountId]
      );
    } else {
      list = await db.getAllAsync<{ date: string }>(
        "SELECT DISTINCT SUBSTR(date, 1, 7) as month FROM expenses WHERE userId = ? ORDER BY month DESC",
        [userId]
      );
    }

    const months = list.map((item) => (item as any).month).filter(Boolean);
    if (!months.includes(currentMonth)) {
      months.unshift(currentMonth);
    }
    return months;
  });
}

// ----------------------------------------------------
// Sync Queue helpers
// ----------------------------------------------------

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

export async function markAccountSynced(id: string) {
  return await withSafeDb(async (db) => {
    await db.runAsync("UPDATE accounts SET synced = 1 WHERE id = ?", [id]);
  });
}
