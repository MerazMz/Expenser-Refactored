import { AppState, AppStateStatus } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import {
  getPendingSyncQueue,
  removeSyncQueueItem,
  markExpenseSynced,
  markSettingsSynced,
  markAccountSynced,
  bulkUpsertExpensesFromServer,
  bulkUpsertAccountsFromServer,
  upsertSettingsFromServer,
  getLocalSyncCursor,
  setLocalSyncCursor,
  applyIncrementalSyncChanges,
} from "../db/sqlite";
import { syncMutationWithServer, pullServerUserData } from "./api";

let isSyncingQueue = false;
let isPullingData = false;
let lastPullTime = 0;
const MIN_PULL_INTERVAL_MS = 5000; // Minimum 5s between automatic pulls
let currentUserId: string | null = null;
let backgroundSyncTimer: NodeJS.Timeout | null = null;

type SyncListener = () => void;
const listeners: Set<SyncListener> = new Set();

export function subscribeSyncUpdates(fn: SyncListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifySyncUpdates() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.log("Error in sync listener:", e);
    }
  });
}

/**
 * Pull latest data from server using incremental cursor synchronization.
 * If cursor exists, downloads only changed entities since that cursor.
 * If cursor is 0 or forceFull is true, performs a full initial snapshot.
 */
export async function pullLatestDataFromServer(
  userId: string,
  forceFull: boolean = false
): Promise<boolean> {
  if (!userId) return false;

  const now = Date.now();
  if (!forceFull && now - lastPullTime < MIN_PULL_INTERVAL_MS) {
    return true; // Cooldown active, skip redundant pull
  }

  if (isPullingData) return true;

  isPullingData = true;
  lastPullTime = now;

  try {
    const cursor = forceFull ? 0 : await getLocalSyncCursor(userId);
    const res = await pullServerUserData(userId, cursor);

    if (res && res.success) {
      if (res.isIncremental && res.changes) {
        if (res.changes.length > 0) {
          await applyIncrementalSyncChanges(userId, res.changes);
          notifySyncUpdates();
        }
        if (res.cursor) {
          await setLocalSyncCursor(userId, res.cursor);
        }
        return true;
      }

      // Full snapshot
      if (res.accounts && Array.isArray(res.accounts)) {
        await bulkUpsertAccountsFromServer(userId, res.accounts);
      }
      if (res.settings) {
        await upsertSettingsFromServer(userId, res.settings);
      }
      if (res.expenses && Array.isArray(res.expenses)) {
        await bulkUpsertExpensesFromServer(userId, res.expenses);
      }
      if (res.cursor) {
        await setLocalSyncCursor(userId, res.cursor);
      }

      notifySyncUpdates();
      return true;
    }
  } catch (e) {
    console.log("Error pulling data from server:", e);
  } finally {
    isPullingData = false;
  }
  return false;
}

/**
 * Process all pending mutations in the local SQLite queue and upload them to production PostgreSQL.
 * Safe and idempotent.
 */
export async function processOfflineSyncQueue() {
  if (isSyncingQueue) return;

  isSyncingQueue = true;

  try {
    const queue = await getPendingSyncQueue();
    let anySuccess = false;

    for (const item of queue) {
      try {
        const payload = JSON.parse(item.payload);
        const success = await syncMutationWithServer(item.action, payload);

        if (success) {
          anySuccess = true;
          if (item.action === "SAVE_EXPENSE") {
            const actId = payload.accountId || `${payload.userId}_default`;
            await markExpenseSynced(`${payload.userId}_${actId}_${payload.date}`);
            await markExpenseSynced(`${payload.userId}_${payload.date}`);
          } else if (item.action === "SAVE_SETTINGS") {
            await markSettingsSynced(payload.userId);
          } else if (item.action === "CREATE_ACCOUNT" || item.action === "UPDATE_ACCOUNT") {
            if (payload.id) {
              await markAccountSynced(payload.id);
            }
          }
          await removeSyncQueueItem(item.id);
        } else {
          // Pause queue processing if server fails or is unreachable
          break;
        }
      } catch (e) {
        console.log("Error processing sync item:", e);
      }
    }

    if (anySuccess) {
      notifySyncUpdates();
    }
  } finally {
    isSyncingQueue = false;
  }
}

/**
 * Initialize Event-Driven synchronization:
 * 1. Immediate initial sync on app startup
 * 2. Network reconnection trigger (offline -> online)
 * 3. App foreground trigger (background -> active)
 * 4. Gentle fallback heartbeat (every 45s) only while app is active
 */
export function initializeAutoSync(userId?: string) {
  if (userId) {
    currentUserId = userId;
  }

  // 1. Initial flush & incremental sync
  processOfflineSyncQueue();
  if (currentUserId) {
    pullLatestDataFromServer(currentUserId);
  }

  // 2. Network reconnection listener
  NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processOfflineSyncQueue();
      if (currentUserId) {
        pullLatestDataFromServer(currentUserId);
      }
    }
  });

  // 3. AppState change listener (foreground resume)
  AppState.addEventListener("change", (nextState: AppStateStatus) => {
    if (nextState === "active") {
      processOfflineSyncQueue();
      if (currentUserId) {
        pullLatestDataFromServer(currentUserId);
      }
    }
  });

  // 4. Gentle fallback background interval (every 45s, negligible payload with cursor)
  if (backgroundSyncTimer) {
    clearInterval(backgroundSyncTimer);
  }
  backgroundSyncTimer = setInterval(() => {
    if (currentUserId && AppState.currentState === "active") {
      processOfflineSyncQueue();
      pullLatestDataFromServer(currentUserId);
    }
  }, 45000);
}
