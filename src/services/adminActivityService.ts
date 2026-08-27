import { supabase } from '@/lib/supabase';

export interface AdminActivityItem {
  id: string;
  action: string;
  details: string;
  entity: 'question_bank' | 'literature' | 'user' | 'system' | 'export' | 'auth' | 'settings';
  user_email?: string;
  user_name?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const LOCAL_STORAGE_KEY = 'scholar_admin_activity_logs';

/**
 * Get cached local activity logs
 */
export const getLocalActivities = (): AdminActivityItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Log an action performed in the Admin dashboard
 */
export const logAdminActivity = async (
  action: string,
  details: string,
  entity: AdminActivityItem['entity'],
  metadata?: Record<string, any>
): Promise<AdminActivityItem> => {
  const user = (await supabase.auth.getUser()).data.user;
  const userEmail = user?.email || 'admin@scholarsresort.com';
  const userName = user?.user_metadata?.full_name || 'Administrator';

  const newItem: AdminActivityItem = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    details,
    entity,
    user_email: userEmail,
    user_name: userName,
    timestamp: new Date().toISOString(),
    metadata
  };

  // Save to local storage cache (keep last 200 logs)
  try {
    const existing = getLocalActivities();
    const updated = [newItem, ...existing].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save activity to localStorage:', err);
  }

  // Attempt async sync to Supabase activity_logs
  try {
    await supabase.from('activity_logs').insert([{
      action: `${action}: ${details}`,
      metadata: metadata || {},
      created_at: newItem.timestamp
    }]);
  } catch (e) {
    // Ignore database log errors silently
  }

  // Dispatch custom window event for real-time UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin_activity_logged', { detail: newItem }));
  }

  return newItem;
};

/**
 * Fetch all activity logs combining Supabase & local cache
 */
export const fetchAllAdminActivities = async (): Promise<AdminActivityItem[]> => {
  const localLogs = getLocalActivities();

  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      const remoteLogs: AdminActivityItem[] = data.map((item: any) => ({
        id: item.id || `db_${item.created_at}`,
        action: item.action?.split(':')[0] || 'ACTION',
        details: item.action?.split(':').slice(1).join(':').trim() || item.action || '',
        entity: (item.entity_type as any) || 'system',
        user_email: item.user_email || 'admin@scholarsresort.com',
        user_name: item.profiles?.full_name || 'Admin User',
        timestamp: item.created_at || new Date().toISOString(),
        metadata: item.metadata
      }));

      // Merge remote & local logs deduplicated by timestamp
      const combinedMap = new Map<string, AdminActivityItem>();
      [...localLogs, ...remoteLogs].forEach(log => {
        combinedMap.set(log.id, log);
      });

      return Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
  } catch (err) {
    console.warn('Could not fetch remote audit_logs, using local:', err);
  }

  return localLogs;
};

/**
 * Clear local activity logs
 */
export const clearLocalActivities = () => {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin_activity_logged'));
    }
  } catch {}
};
