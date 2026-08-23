import { supabase } from './supabase';
import { offlineDb, type OfflineSyncItem } from './offlineDb';
import { isBatterySaverActive } from './batterySaver';
import { toast } from 'sonner';

export interface EnqueueWriteOptions {
  type: 'exam_result' | 'study_progress' | 'session_answer' | 'daily_goal' | 'profile_update' | 'custom_write';
  table: string;
  action?: 'insert' | 'upsert' | 'update';
  payload: any;
  matchCriteria?: Record<string, any>;
  userId?: string;
  silent?: boolean;
}

let isSyncing = false;

/**
 * Enqueue a failed or offline write operation to IndexedDB for later syncing.
 */
export async function enqueueOfflineWrite(options: EnqueueWriteOptions): Promise<number> {
  const {
    type,
    table,
    action = 'insert',
    payload,
    matchCriteria,
    userId,
    silent = false
  } = options;

  try {
    const item: OfflineSyncItem = {
      type,
      table,
      action,
      payload,
      matchCriteria,
      userId,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    const id = await offlineDb.syncQueue.add(item);

    if (!silent) {
      toast.info('Offline Mode: Data saved locally to device. Will sync automatically once connected.', {
        icon: '💾',
        duration: 5000
      });
    }

    console.info(`[SyncQueue] Enqueued offline ${action} for table "${table}" (ID: ${id})`);
    return id;
  } catch (err: any) {
    console.error('[SyncQueue] Failed to enqueue write item:', err);
    return -1;
  }
}

/**
 * Attempt to execute an operation immediately, or seamlessly fallback to IndexedDB queue if offline/failed.
 */
export async function executeWithOfflineQueue<T = any>(options: {
  type: EnqueueWriteOptions['type'];
  table: string;
  action?: 'insert' | 'upsert' | 'update';
  payload: any;
  matchCriteria?: Record<string, any>;
  userId?: string;
  executeOnline: () => Promise<{ data?: T; error?: any }>;
}): Promise<{ success: boolean; data?: T; queued?: boolean; error?: any }> {
  // If definitely offline, enqueue immediately
  if (!navigator.onLine) {
    await enqueueOfflineWrite({
      type: options.type,
      table: options.table,
      action: options.action,
      payload: options.payload,
      matchCriteria: options.matchCriteria,
      userId: options.userId
    });
    return { success: true, queued: true };
  }

  try {
    const { data, error } = await options.executeOnline();
    if (error) {
      console.warn(`[SyncQueue] Online operation failed on table ${options.table}:`, error);
      await enqueueOfflineWrite({
        type: options.type,
        table: options.table,
        action: options.action,
        payload: options.payload,
        matchCriteria: options.matchCriteria,
        userId: options.userId
      });
      return { success: true, queued: true, error };
    }
    return { success: true, data };
  } catch (err: any) {
    console.warn(`[SyncQueue] Online operation threw exception on table ${options.table}:`, err);
    await enqueueOfflineWrite({
      type: options.type,
      table: options.table,
      action: options.action,
      payload: options.payload,
      matchCriteria: options.matchCriteria,
      userId: options.userId
    });
    return { success: true, queued: true, error: err };
  }
}

/**
 * Calculate exponential backoff delay in milliseconds.
 * Strategy: baseDelay * 2^(retryCount) + jitter, capped at maxDelay (e.g. 2 minutes).
 */
export function calculateBackoffDelay(retryCount: number): number {
  const baseDelayMs = 2000; // 2 seconds initial
  const maxDelayMs = 120000; // 2 minutes max
  // Add 10-25% random jitter to avoid thundering herd
  const jitter = 1 + (Math.random() * 0.25);
  const exponential = baseDelayMs * Math.pow(2, Math.min(retryCount, 6)) * jitter;
  return Math.min(Math.round(exponential), maxDelayMs);
}

/**
 * Process all pending offline sync items in IndexedDB and send them to Supabase.
 * Respects exponential backoff timestamps for failed requests to avoid spamming the backend.
 */
export async function processSyncQueue(supabaseClient: any = supabase): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[SyncQueue] Sync already in progress, skipping...');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.log('[SyncQueue] Device is offline, cannot sync queue.');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const now = Date.now();
    // Retrieve items that are pending or failed
    const allCandidates = await offlineDb.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .toArray();

    // Filter by exponential backoff (only process if nextRetryTime is unset or reached)
    const eligibleItems = allCandidates.filter(item => {
      if (!item.nextRetryTime) return true;
      return now >= item.nextRetryTime;
    });

    if (eligibleItems.length === 0) {
      if (allCandidates.length > 0) {
        const nextEarliest = Math.min(...allCandidates.map(i => i.nextRetryTime || now));
        const waitSecs = Math.max(1, Math.round((nextEarliest - now) / 1000));
        console.log(`[SyncQueue] Backoff active: ${allCandidates.length} item(s) awaiting retry window in ~${waitSecs}s.`);
      }
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    console.log(`[SyncQueue] Starting sync for ${eligibleItems.length} eligible operation(s)...`);

    for (const item of eligibleItems) {
      if (!item.id) continue;

      try {
        await offlineDb.syncQueue.update(item.id, { status: 'syncing' });

        let query = supabaseClient.from(item.table);
        let error: any = null;

        if (item.action === 'insert') {
          const res = await query.insert(item.payload);
          error = res.error;
        } else if (item.action === 'upsert') {
          const res = await query.upsert(item.payload);
          error = res.error;
        } else if (item.action === 'update') {
          let updateQuery = query.update(item.payload);
          if (item.matchCriteria) {
            Object.entries(item.matchCriteria).forEach(([k, v]) => {
              updateQuery = updateQuery.eq(k, v);
            });
          }
          const res = await updateQuery;
          error = res.error;
        }

        if (error) {
          const nextRetryCount = (item.retryCount || 0) + 1;
          const backoffDelay = calculateBackoffDelay(nextRetryCount);
          const nextRetryTime = Date.now() + backoffDelay;

          console.warn(`[SyncQueue] Item ${item.id} sync error on ${item.table}. Exponential backoff retry #${nextRetryCount} in ${Math.round(backoffDelay / 1000)}s:`, error.message);
          
          await offlineDb.syncQueue.update(item.id, {
            status: 'failed',
            retryCount: nextRetryCount,
            nextRetryTime,
            lastError: error.message
          });
          failed++;
        } else {
          // Success: delete from sync queue
          await offlineDb.syncQueue.delete(item.id);
          synced++;
          console.log(`[SyncQueue] ✅ Successfully synced item #${item.id} to "${item.table}"`);
        }
      } catch (itemErr: any) {
        const nextRetryCount = (item.retryCount || 0) + 1;
        const backoffDelay = calculateBackoffDelay(nextRetryCount);
        const nextRetryTime = Date.now() + backoffDelay;

        console.error(`[SyncQueue] Exception syncing item #${item.id}. Backing off for ${Math.round(backoffDelay / 1000)}s:`, itemErr);
        
        await offlineDb.syncQueue.update(item.id, {
          status: 'failed',
          retryCount: nextRetryCount,
          nextRetryTime,
          lastError: itemErr.message || 'Unknown network exception'
        });
        failed++;
      }
    }

    if (synced > 0) {
      toast.success(`Cloud Sync: ${synced} offline study & exam record(s) synced to database!`, {
        icon: '☁️',
        duration: 4000
      });
    }
  } catch (queueErr) {
    console.error('[SyncQueue] Fatal queue processing error:', queueErr);
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Returns the count of pending offline records waiting to be synced.
 */
export async function getPendingQueueCount(): Promise<number> {
  try {
    return await offlineDb.syncQueue.where('status').anyOf(['pending', 'failed']).count();
  } catch {
    return 0;
  }
}

/**
 * Initializes automatic sync triggers on network reconnection and visibility change,
 * plus a periodic background check adjusted by Battery Saver mode.
 */
export function initSyncQueueListeners(): () => void {
  const handleOnline = () => {
    console.log('[SyncQueue] Network connection detected. Triggering sync...');
    processSyncQueue();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      processSyncQueue();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // Background sync periodic timer (30s normal, 5min in Battery Saver)
  const syncInterval = setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      const isBatterySaving = isBatterySaverActive();
      // If battery saver is active, reduce background activity
      if (!isBatterySaving || Math.random() < 0.2) {
        processSyncQueue();
      }
    }
  }, 45000);

  // Initial trigger if online
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(syncInterval);
  };
}
