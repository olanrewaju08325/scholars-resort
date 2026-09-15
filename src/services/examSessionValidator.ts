import { supabase } from '@/lib/supabase';
import { getInterruptedExamSession, getInterruptedExamSessionAsync, type InterruptedExamData } from '@/lib/examSessionStorage';
import { getExamSnapshot, sanitizeDbKey } from '@/lib/offlineDb';

export interface ActiveSessionCheckResult {
  hasActiveSession: boolean;
  source: 'localStorage' | 'indexedDB' | 'supabase' | null;
  sessionData: any | null;
  sessionId: string | null;
  summary: {
    answeredCount: number;
    totalCount: number;
    timeLeft: number;
    subjectName?: string;
    startedAt?: string;
  };
}

/**
 * Validates whether an unfinished / in-progress CBT or PQ session exists
 * across localStorage, Dexie IndexedDB, or Supabase.
 */
export async function checkForActiveExamSession(userId?: string): Promise<ActiveSessionCheckResult> {
  const cleanUserId = sanitizeDbKey(userId);
  const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  // 1. Check Synchronous & Async Local Storage
  const localSession: InterruptedExamData | null = getInterruptedExamSession();
  if (localSession && (!cleanUserId || localSession.userId === cleanUserId || localSession.userId === 'guest')) {
    const answered = Object.keys(localSession.answers || {}).length;
    const total = localSession.questions?.length || 0;
    if (total > 0 && localSession.timeLeft > 0) {
      return {
        hasActiveSession: true,
        source: 'localStorage',
        sessionData: localSession,
        sessionId: null,
        summary: {
          answeredCount: answered,
          totalCount: total,
          timeLeft: localSession.timeLeft,
          subjectName: localSession.subjects?.[0] || 'JAMB Exam',
          startedAt: localSession.startedAt
        }
      };
    }
  }

  // 2. Check IndexedDB Dexie Snapshot
  if (cleanUserId) {
    try {
      const dexieSnapshot = await getExamSnapshot(cleanUserId);
      if (dexieSnapshot && Array.isArray(dexieSnapshot.questions) && dexieSnapshot.questions.length > 0 && dexieSnapshot.timeLeft > 0) {
        const savedTime = new Date(dexieSnapshot.savedAt).getTime();
        if (!isNaN(savedTime) && (Date.now() - savedTime <= 24 * 60 * 60 * 1000)) {
          const answered = Object.keys(dexieSnapshot.answers || {}).length;
          return {
            hasActiveSession: true,
            source: 'indexedDB',
            sessionData: dexieSnapshot,
            sessionId: null,
            summary: {
              answeredCount: answered,
              totalCount: dexieSnapshot.questions.length,
              timeLeft: dexieSnapshot.timeLeft,
              startedAt: dexieSnapshot.startedAt
            }
          };
        }
      }
    } catch (e) {
      console.warn('[SessionValidator] Dexie check notice:', e);
    }
  }

  // 3. Check Remote Supabase in-progress sessions (if user logged in & online)
  if (navigator.onLine && cleanUserId && isUuid(cleanUserId)) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, user_id, status, total_questions, score, started_at')
        .eq('user_id', cleanUserId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.id) {
        // Check age of the server session
        const startedTime = new Date(data.started_at).getTime();
        const ageHours = (Date.now() - startedTime) / (1000 * 60 * 60);

        // If older than 8 hours, it's stale
        if (isNaN(startedTime) || ageHours <= 8) {
          return {
            hasActiveSession: true,
            source: 'supabase',
            sessionData: data,
            sessionId: data.id,
            summary: {
              answeredCount: 0,
              totalCount: data.total_questions || 40,
              timeLeft: 0,
              startedAt: data.started_at
            }
          };
        }
      }
    } catch (err) {
      console.warn('[SessionValidator] Supabase check notice:', err);
    }
  }

  return {
    hasActiveSession: false,
    source: null,
    sessionData: null,
    sessionId: null,
    summary: {
      answeredCount: 0,
      totalCount: 0,
      timeLeft: 0
    }
  };
}
