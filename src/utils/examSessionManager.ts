/**
 * ExamSessionManager Utility
 * 
 * Central coordinator for:
 * 1. Validating incomplete/active exam sessions in Supabase & IndexedDB before starting new PQ or CBT drills.
 * 2. Forcing Resume or Discard choices to avoid 400 Bad Request database collisions.
 * 3. Enforcing global session-locks to prevent double-click / concurrent network requests (reducing 500 errors).
 * 4. Cleaning up abandoned sessions synchronously and asynchronously.
 */

import { supabase } from '@/lib/supabase';
import { checkForActiveExamSession, type ActiveSessionCheckResult } from '@/services/examSessionValidator';
import { cleanupActiveExamSessions, cleanupIncompleteSessions as serviceCleanupIncomplete } from '@/services/examCleanupService';
import { examSessionLock } from '@/lib/examSessionLock';
import { sanitizeIndexedDbKey } from '@/utils/indexedDbKeySanitizer';
import { clearInterruptedExamSession } from '@/lib/examSessionStorage';
import { toast } from 'sonner';

export interface ExamSessionValidationOptions {
  userId?: string;
  onProceed?: () => void | Promise<void>;
  onConflict?: (conflict: ActiveSessionCheckResult) => void;
}

export class ExamSessionManager {
  /**
   * Validates whether an incomplete session exists for the user in Supabase, IndexedDB, or LocalStorage.
   */
  public static async validateActiveSession(userId?: string): Promise<ActiveSessionCheckResult> {
    const cleanId = sanitizeIndexedDbKey(userId, '');
    return await checkForActiveExamSession(cleanId || undefined);
  }

  /**
   * Cleans up all pending, incomplete, or active sessions for a user, marking them 'abandoned' in Supabase.
   */
  public static async cleanupIncompleteSessions(userId?: string): Promise<boolean> {
    const cleanId = sanitizeIndexedDbKey(userId, '');
    return await serviceCleanupIncomplete(cleanId || undefined);
  }

  /**
   * Explicitly discards an active session, resets storage, and marks it as 'abandoned' in Supabase.
   */
  public static async discardSession(userId?: string, sessionId?: string, silent: boolean = false): Promise<boolean> {
    const cleanUserId = sanitizeIndexedDbKey(userId, '');
    const result = await cleanupActiveExamSessions({
      userId: cleanUserId || undefined,
      sessionId: sessionId || undefined,
      reason: 'abandoned',
      silent
    });
    if (!silent && result.success) {
      toast.info('Previous exam session discarded.');
    }
    return result.success;
  }

  /**
   * Synchronously and asynchronously purges local session backups & IndexedDB snapshots.
   */
  public static async clearLocalSnapshots(userId?: string): Promise<void> {
    const cleanUserId = sanitizeIndexedDbKey(userId, '');
    await clearInterruptedExamSession(cleanUserId || undefined);
  }

  /**
   * Global session-lock management to prevent duplicate exam start requests.
   */
  public static acquireLock(source: string = 'exam_starter', timeoutMs: number = 8000): boolean {
    return examSessionLock.acquire(source, timeoutMs);
  }

  public static releaseLock(): void {
    examSessionLock.release();
  }

  public static isLocked(): boolean {
    return examSessionLock.getIsLocked();
  }

  public static async runWithLock<T>(fn: () => Promise<T>, source: string = 'exam_action', timeoutMs: number = 8000): Promise<T | null> {
    return await examSessionLock.runWithLock(fn, source, timeoutMs);
  }

  /**
   * Creates a safe initial exam record in Supabase with pre-cleanup of stale in_progress records.
   */
  public static async initializeExamSession(params: {
    userId: string;
    totalQuestions: number;
    subjects?: string[];
  }): Promise<{ sessionId: string | null; error?: any }> {
    const cleanUserId = sanitizeIndexedDbKey(params.userId, '');
    if (!cleanUserId || cleanUserId === 'guest') {
      return { sessionId: crypto.randomUUID() };
    }

    try {
      // 1. Mark any existing incomplete sessions as abandoned
      await this.cleanupIncompleteSessions(cleanUserId);

      // 2. Insert new session
      const { data, error } = await supabase
        .from('exam_sessions')
        .insert({
          user_id: cleanUserId,
          status: 'in_progress',
          total_questions: params.totalQuestions,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.warn('[ExamSessionManager] Failed to create session record:', error);
        return { sessionId: crypto.randomUUID(), error };
      }

      return { sessionId: data?.id || crypto.randomUUID() };
    } catch (err) {
      console.error('[ExamSessionManager] Error in initializeExamSession:', err);
      return { sessionId: crypto.randomUUID(), error: err };
    }
  }
}

export default ExamSessionManager;
