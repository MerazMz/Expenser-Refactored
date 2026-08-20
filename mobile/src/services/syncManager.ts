import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getPendingSyncQueue,
  removeSyncQueueItem,
  markExpenseSynced,
  markSettingsSynced,
  bulkUpsertExpensesFromServer,
  upsertSettingsFromServer,
} from "../db/sqlite";
import { syncMutationWithServer, pullServerUserData } from "./api";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const LAST_SYNC_KEY = "@expenser_last_cloud_sync_timestamp";

let isSyncingQueue = false;
let isPullingData = false;
let lastSyncTime = 0;

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
 * Pull latest data with smart caching.
 * If data was synced within CACHE_TTL_MS, skip API call unless force=true.
 */
export async function pullLatestDataFromServer(
  userId: string
): Promise<boolean> {
  if (!userId) return false;

  if (isPullingData) return true;
  isPullingData = true;

  try {
    const res = await pullServerUserData(userId);
    if (res && res.success) {
      if (res.settings) {
        await upsertSettingsFromServer(userId, res.settings);
      }
      if (res.expenses && Array.isArray(res.expenses)) {
        await bulkUpsertExpensesFromServer(userId, res.expenses);
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
            await markExpenseSynced(`${payload.userId}_${payload.date}`);
          } else if (item.action === "SAVE_SETTINGS") {
            await markSettingsSynced(payload.userId);
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

export function initializeAutoSync(userId?: string) {
  NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      processOfflineSyncQueue();
      if (userId) {
        pullLatestDataFromServer(userId);
      }
    }
  });

  processOfflineSyncQueue();
  if (userId) {
    pullLatestDataFromServer(userId);
  }
}
