import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cleanupActiveExamSessions, cleanupIncompleteSessions as serviceCleanupIncomplete, type ExamCleanupOptions } from '@/services/examCleanupService';
import { toast } from 'sonner';

export interface UseExamCleanupConfig {
  autoCleanupOnUnmount?: boolean;
  sessionId?: string;
  isSubmitted?: boolean;
}

/**
 * Custom hook to safely clean up, discard, or archive active exam sessions.
 * Automatically updates existing, incomplete 'exam_sessions' records in Supabase
 * to an 'abandoned' status instead of leaving them in an active state, preventing 400 Bad Request errors.
 */
export function useExamCleanup(config: UseExamCleanupConfig = {}) {
  const { profile } = useAuth();
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const isSubmittedRef = useRef(config.isSubmitted || false);
  const sessionIdRef = useRef(config.sessionId);

  useEffect(() => {
    isSubmittedRef.current = config.isSubmitted || false;
  }, [config.isSubmitted]);

  useEffect(() => {
    sessionIdRef.current = config.sessionId;
  }, [config.sessionId]);

  const cleanupSession = useCallback(async (options: Omit<ExamCleanupOptions, 'userId'> & { userId?: string } = {}) => {
    setIsCleaningUp(true);
    try {
      const targetUserId = options.userId || profile?.id;
      const result = await cleanupActiveExamSessions({
        ...options,
        userId: targetUserId
      });
      return result;
    } finally {
      setIsCleaningUp(false);
    }
  }, [profile?.id]);

  const abandonCurrentExam = useCallback(async (sessionId?: string, showNotification: boolean = true) => {
    setIsCleaningUp(true);
    try {
      const targetSessionId = sessionId || sessionIdRef.current;
      const result = await cleanupActiveExamSessions({
        userId: profile?.id,
        sessionId: targetSessionId,
        reason: 'abandoned'
      });
      if (showNotification) {
        toast.info('Exam session abandoned. Progress snapshot cleared.');
      }
      return result;
    } finally {
      setIsCleaningUp(false);
    }
  }, [profile?.id]);

  const cleanupIncomplete = useCallback(async (userId?: string) => {
    setIsCleaningUp(true);
    try {
      return await serviceCleanupIncomplete(userId || profile?.id);
    } finally {
      setIsCleaningUp(false);
    }
  }, [profile?.id]);

  // Handle auto-cleanup on unmount if requested (e.g. user leaves mid-exam without submitting)
  useEffect(() => {
    if (!config.autoCleanupOnUnmount) return;

    return () => {
      // If the exam was not submitted when unmounting, clean up and mark abandoned
      if (!isSubmittedRef.current && profile?.id) {
        cleanupActiveExamSessions({
          userId: profile.id,
          sessionId: sessionIdRef.current,
          reason: 'abandoned',
          silent: true
        });
      }
    };
  }, [config.autoCleanupOnUnmount, profile?.id]);

  return {
    cleanupSession,
    abandonCurrentExam,
    cleanupIncompleteSessions: cleanupIncomplete,
    isCleaningUp
  };
}

export default useExamCleanup;
