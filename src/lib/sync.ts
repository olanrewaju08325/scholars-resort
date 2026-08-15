import { supabase } from './supabase';
import { syncPendingAnswers } from './offlineDb';
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
    
    // Call the offlineDb's built-in sync function
    await syncPendingAnswers(supabase, session.user.id);
    
    // Optionally fetch subjects/questions here if we wanted full offline
    // But Dexie already caches them in offlineDb during normal usage if needed.
    
    console.log('Background sync complete.');
    return true;
  } catch (err) {
    console.error('Sync failed:', err);
    return false;
  }
};
