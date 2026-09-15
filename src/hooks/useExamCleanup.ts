import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cleanupActiveExamSessions, type ExamCleanupOptions } from '@/services/examCleanupService';
import { toast } from 'sonner';

/**
 * Custom hook to safely clean up, discard, or archive active exam sessions
 */
export function useExamCleanup() {
  const { profile } = useAuth();

  const cleanupSession = useCallback(async (options: Omit<ExamCleanupOptions, 'userId'> & { userId?: string } = {}) => {
    const targetUserId = options.userId || profile?.id;
    const result = await cleanupActiveExamSessions({
      ...options,
      userId: targetUserId
    });
    return result;
  }, [profile?.id]);

  const abandonCurrentExam = useCallback(async (sessionId?: string, showNotification: boolean = true) => {
    const result = await cleanupActiveExamSessions({
      userId: profile?.id,
      sessionId,
      reason: 'abandoned'
    });
    if (showNotification) {
      toast.info('Exam session abandoned. Progress snapshot cleared.');
    }
    return result;
  }, [profile?.id]);

  return {
    cleanupSession,
    abandonCurrentExam
  };
}
