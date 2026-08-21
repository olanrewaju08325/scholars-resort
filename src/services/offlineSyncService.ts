import Dexie, { type Table } from 'dexie';
import { supabase } from '@/lib/supabase';
import { saveJambBooks, fetchJambBooks } from './novelService';
import { toast } from 'sonner';

export interface PendingOperation {
  id?: number;
  entity: 'question' | 'literature_book' | 'bulk_question';
  action: 'delete' | 'bulk_delete' | 'save_literature';
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
}

class AdminOfflineDB extends Dexie {
  pendingOperations!: Table<PendingOperation, number>;

  constructor() {
    super('ScholarsAdminOfflineDB');
    this.version(1).stores({
      pendingOperations: '++id, entity, action, status, timestamp'
    });
  }
}

export const adminOfflineDb = new AdminOfflineDB();

/**
 * Add an operation to the offline sync queue
 */
export const queueOfflineOperation = async (
  entity: PendingOperation['entity'],
  action: PendingOperation['action'],
  payload: any
): Promise<number> => {
  const opId = await adminOfflineDb.pendingOperations.add({
    entity,
    action,
    payload,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0
  });

  // If online, immediately attempt to flush queue
  if (navigator.onLine) {
    syncPendingOperations();
  } else {
    toast.info('You are offline. Action saved to local sync queue and will upload automatically when reconnected.', {
      duration: 4000
    });
  }

  return opId;
};

/**
 * Get total pending operations count
 */
export const getPendingOperationsCount = async (): Promise<number> => {
  return await adminOfflineDb.pendingOperations.where('status').equals('pending').count();
};

/**
 * Flush and sync all pending offline operations to Supabase
 */
export const syncPendingOperations = async (): Promise<{ success: boolean; syncedCount: number }> => {
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0 };
  }

  const pending = await adminOfflineDb.pendingOperations
    .where('status')
    .equals('pending')
    .toArray();

  if (pending.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let syncedCount = 0;
  const syncToast = toast.loading(`Syncing ${pending.length} offline administrative update(s)...`);

  for (const op of pending) {
    try {
      await adminOfflineDb.pendingOperations.update(op.id!, { status: 'syncing' });

      if (op.action === 'delete' && op.entity === 'question') {
        const { error } = await supabase.from('questions').delete().eq('id', op.payload.id);
        if (error) throw error;
      } else if (op.action === 'bulk_delete' && op.entity === 'bulk_question') {
        const { error } = await supabase.from('questions').delete().in('id', op.payload.ids);
        if (error) throw error;
      } else if (op.action === 'save_literature' && op.entity === 'literature_book') {
        const res = await saveJambBooks(op.payload.books);
        if (!res.success) throw new Error(res.error);
      }

      // Successfully synced: delete from IndexedDB
      await adminOfflineDb.pendingOperations.delete(op.id!);
      syncedCount++;
    } catch (err: any) {
      console.warn(`Failed sync for operation #${op.id}:`, err);
      await adminOfflineDb.pendingOperations.update(op.id!, {
        status: 'pending',
        retryCount: (op.retryCount || 0) + 1,
        lastError: err?.message || 'Network sync error'
      });
    }
  }

  toast.dismiss(syncToast);

  if (syncedCount > 0) {
    toast.success(`Successfully synced ${syncedCount} offline change(s) to database!`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('literature_updated'));
      window.dispatchEvent(new Event('questions_updated'));
    }
  }

  return { success: true, syncedCount };
};

/**
 * Initialize automatic sync listeners for online event & service worker messages
 */
export const initAdminOfflineSync = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    toast.info('Network restored! Processing pending offline updates...', { duration: 3000 });
    syncPendingOperations();
  });

  // Service Worker background sync message handling
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
        syncPendingOperations();
      }
    });
  }
};
