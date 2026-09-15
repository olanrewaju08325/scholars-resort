import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { checkForActiveExamSession, type ActiveSessionCheckResult } from '@/services/examSessionValidator';
import { cleanupActiveExamSessions } from '@/services/examCleanupService';

export function useSessionValidator() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [conflictResult, setConflictResult] = useState<ActiveSessionCheckResult | null>(null);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState<boolean>(false);
  const [pendingProceedCallback, setPendingProceedCallback] = useState<(() => void | Promise<void>) | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);

  /**
   * Validate session before starting a new exam.
   * If an incomplete session exists, prompts the user.
   * Otherwise, executes onProceed immediately.
   */
  const validateBeforeStart = useCallback(async (onProceed: () => void | Promise<void>) => {
    try {
      const result = await checkForActiveExamSession(profile?.id);
      if (result.hasActiveSession) {
        setConflictResult(result);
        setPendingProceedCallback(() => onProceed);
        setIsConflictDialogOpen(true);
        return false;
      } else {
        await onProceed();
        return true;
      }
    } catch (err) {
      console.warn('[SessionValidator] Validation error, proceeding anyway:', err);
      await onProceed();
      return true;
    }
  }, [profile?.id]);

  /**
   * Resume the existing active session
   */
  const handleResume = useCallback(() => {
    setIsConflictDialogOpen(false);
    setConflictResult(null);
    setPendingProceedCallback(null);
    navigate('/cbt', { state: { resume: true, fromConflictPrompt: true } });
  }, [navigate]);

  /**
   * Discard the active session and execute the pending new exam
   */
  const handleDiscardAndProceed = useCallback(async () => {
    setIsCleaningUp(true);
    try {
      await cleanupActiveExamSessions({
        userId: profile?.id,
        sessionId: conflictResult?.sessionId || undefined,
        reason: 'started_new'
      });

      setIsConflictDialogOpen(false);
      const callback = pendingProceedCallback;
      setConflictResult(null);
      setPendingProceedCallback(null);

      if (callback) {
        await callback();
      }
    } finally {
      setIsCleaningUp(false);
    }
  }, [profile?.id, conflictResult, pendingProceedCallback]);

  const closeConflictDialog = useCallback(() => {
    setIsConflictDialogOpen(false);
    setConflictResult(null);
    setPendingProceedCallback(null);
  }, []);

  return {
    validateBeforeStart,
    isConflictDialogOpen,
    conflictResult,
    isCleaningUp,
    handleResume,
    handleDiscardAndProceed,
    closeConflictDialog
  };
}
