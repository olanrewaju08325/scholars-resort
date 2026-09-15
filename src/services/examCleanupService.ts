import { supabase } from '@/lib/supabase';
import { clearInterruptedExamSession } from '@/lib/examSessionStorage';
import { clearExamSnapshot, sanitizeDbKey } from '@/lib/offlineDb';

export interface ExamCleanupOptions {
  userId?: string;
  sessionId?: string;
  reason?: 'abandoned' | 'started_new' | 'user_discard' | 'timeout';
  silent?: boolean;
}

/**
 * Global Exam Cleanup Service
 * 
 * Safely purges local and IndexedDB exam states and updates lingering Supabase
 * exam_sessions records to 'abandoned', preventing 400 Bad Request collisions and
 * clearing backend AI Tutor locks.
 */
export async function cleanupActiveExamSessions(options: ExamCleanupOptions = {}): Promise<{ success: boolean }> {
  const { userId, sessionId, reason = 'abandoned', silent = false } = options;
  const cleanUserId = sanitizeDbKey(userId);
  const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  try {
    // 1. Purge client-side storage keys synchronously & in Dexie
    if (typeof window !== 'undefined') {
      localStorage.removeItem('scholars_interrupted_exam_session');
      localStorage.removeItem('scholars_live_exam_active');
      sessionStorage.removeItem('cbt_backup');
    }

    await clearInterruptedExamSession(cleanUserId);
    await clearExamSnapshot(cleanUserId);

    // 2. Archive / Mark in-progress records in Supabase as 'abandoned'
    if (cleanUserId && isUuid(cleanUserId)) {
      try {
        let query = supabase
          .from('exam_sessions')
          .update({
            status: 'abandoned',
            submitted_at: new Date().toISOString()
          })
          .eq('user_id', cleanUserId)
          .eq('status', 'in_progress');

        if (sessionId && isUuid(sessionId)) {
          query = query.eq('id', sessionId);
        }

        const { error } = await query;
        if (error && !silent) {
          console.warn('[ExamCleanup] Supabase table update note:', error.message);
        }
      } catch (err) {
        if (!silent) console.warn('[ExamCleanup] Supabase direct cleanup failed, proceeding to API endpoint:', err);
      }
    }

    // 3. Call backend API to guarantee server AI Tutor locks and exam sessions are cleared
    try {
      if (sessionId && isUuid(sessionId)) {
        await fetch('/api/exam-session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: cleanUserId,
            sessionId,
            status: 'abandoned'
          })
        });
      } else if (cleanUserId && isUuid(cleanUserId)) {
        await fetch('/api/exam-session/abandon-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: cleanUserId })
        });
      }
    } catch (_) {}

    // 4. Notify all components across the application
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scholars:exam-session-cleared', {
        detail: { userId: cleanUserId, sessionId, reason, timestamp: Date.now() }
      }));
    }

    return { success: true };
  } catch (err) {
    console.error('[ExamCleanup] Unexpected cleanup error:', err);
    return { success: false };
  }
}
