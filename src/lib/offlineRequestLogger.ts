import Dexie, { type Table } from 'dexie';
import { toast } from 'sonner';

export interface FailedNetworkLog {
  id?: number;
  url: string;
  method: string;
  errorReason: string;
  timestamp: number;
  status: 'pending' | 'retried' | 'resolved';
}

class FailedNetworkDB extends Dexie {
  failedNetworkLogs!: Table<FailedNetworkLog, number>;

  constructor() {
    super('ScholarsFailedNetworkDB');
    this.version(1).stores({
      failedNetworkLogs: '++id, url, method, status, timestamp'
    });
  }
}

export const failedNetworkDb = new FailedNetworkDB();

/**
 * Log a failed network request to IndexedDB
 */
export const logFailedNetworkRequest = async (
  url: string,
  method: string = 'GET',
  errorReason: string = 'Network failure or timeout'
): Promise<number> => {
  try {
    const id = await failedNetworkDb.failedNetworkLogs.add({
      url,
      method,
      errorReason,
      timestamp: Date.now(),
      status: 'pending'
    });
    return id;
  } catch (e) {
    console.warn('[OfflineRequestLogger] Failed to log request to IndexedDB:', e);
    return 0;
  }
};

/**
 * Get count of unresolved failed network logs
 */
export const getFailedNetworkLogsCount = async (): Promise<number> => {
  try {
    return await failedNetworkDb.failedNetworkLogs
      .where('status')
      .equals('pending')
      .count();
  } catch (e) {
    return 0;
  }
};

/**
 * Clear or resolve all failed network logs
 */
export const clearFailedNetworkLogs = async (): Promise<void> => {
  try {
    await failedNetworkDb.failedNetworkLogs.clear();
  } catch (e) {
    console.warn('[OfflineRequestLogger] Failed to clear logs:', e);
  }
};
