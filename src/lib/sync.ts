import { supabase } from './supabase';
import { syncPendingAnswers } from './offlineDb';
import { processSyncQueue } from './syncQueue';
import { toast } from 'sonner';

export const syncWithSupabase = async () => {
  try {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      console.log('Cannot sync: Device is offline');
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    console.log('Starting background sync with Supabase...');
    
    // Call the offlineDb's built-in answer sync function
    await syncPendingAnswers(supabase, session.user.id);
    
    // Process the generic IndexedDB offline write queue (exam results, progress, streaks, etc.)
    await processSyncQueue(supabase);
    
    console.log('Background sync complete.');
    return true;
  } catch (err) {
    console.error('Sync failed:', err);
    return false;
  }
};
