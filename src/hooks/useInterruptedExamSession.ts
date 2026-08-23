import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  getInterruptedExamSession, 
  clearInterruptedExamSession, 
  type InterruptedExamData 
} from '@/lib/examSessionStorage';

/**
 * Hook to automatically detect interrupted / prematurely closed CBT exam sessions upon app reload
 * and prompt the student to resume their test.
 */
export function useInterruptedExamSession() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [interruptedSession, setInterruptedSession] = useState<InterruptedExamData | null>(null);
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    // If user is already on the CBT exam page or not logged in, don't show the global popup
    if (location.pathname === '/cbt' || location.pathname === '/exam' || hasPrompted) {
      return;
    }

    const session = getInterruptedExamSession();
    if (session) {
      // If session belongs to the logged-in user or guest
      if (!profile || session.userId === profile.id || session.userId === 'local_guest') {
        setInterruptedSession(session);
        setHasPrompted(true);
      }
    }
  }, [profile, location.pathname, hasPrompted]);

  const resumeSession = useCallback(() => {
    if (!interruptedSession) return;
    setInterruptedSession(null);
    navigate('/cbt', { state: { resume: true, fromPrompt: true } });
  }, [interruptedSession, navigate]);

  const discardSession = useCallback(async () => {
    if (interruptedSession) {
      await clearInterruptedExamSession(interruptedSession.userId);
    }
    setInterruptedSession(null);
  }, [interruptedSession]);

  return {
    interruptedSession,
    resumeSession,
    discardSession
  };
}
