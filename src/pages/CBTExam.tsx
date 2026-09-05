import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calculator, Flag, Clock, ChevronLeft, ChevronRight, AlertTriangle, Volume2, VolumeX, Keyboard, HelpCircle, Eye, EyeOff, Sparkles, Grid3X3, Layers, Compass, Camera, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { JambCalculator } from '@/components/cbt/JambCalculator';
import { CBTNavigationDrawer } from '@/components/cbt/CBTNavigationDrawer';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { CbtSnapshotService } from '@/services/cbtSnapshotService';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/hooks/useConfirm';
import { recordStudyAction } from '@/lib/streakService';
import { awardMockExamCompletionXp, checkAndAwardBadges } from '@/lib/gamification';
import { saveExamSnapshot, clearExamSnapshot } from '@/lib/offlineDb';
import { persistActiveExamSession, getInterruptedExamSession, clearInterruptedExamSession } from '@/lib/examSessionStorage';
import { enqueueOfflineWrite } from '@/lib/syncQueue';
import { saveCompletedOfflineSession } from '@/lib/offlineStore';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';
import { fetchQuestionsForSubject, normalizeSubjectName, checkSubjectDataIntegrity } from '@/utils/subjectUtils';
import { cleanQuestionText, cleanOptionText } from '@/utils/questionUtils';
import { QuestionFlowService } from '@/services/questionFlowService';
import { validateUtmeSubjectCombination } from '@/utils/subjectTaxonomy';
import { useFocusLock } from '@/hooks/useFocusLock';
import { FocusLockOverlay } from '@/components/FocusLockOverlay';
import { toast } from 'sonner';
import { MathText } from '@/components/MathText';
import { playFiveMinuteWarningSound } from '@/lib/celebration';

interface CBTExamProps {
  defaultMode?: 'full_mock' | 'past_questions' | 'ai_generated_mock';
}

export default function CBTExam({ defaultMode }: CBTExamProps) {
  usePerfMonitoring('CBTExam');
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { confirmAction, ConfirmElement } = useConfirm();

  const searchParams = new URLSearchParams(location.search);
  const queryMode = searchParams.get('mode');
  let examMode: 'full_mock' | 'past_questions' | 'ai_generated_mock' = defaultMode || 'full_mock';

  if (location.pathname.includes('past-questions') || queryMode === 'past') {
    examMode = 'past_questions';
  } else if (location.pathname.includes('ai-mock') || queryMode === 'ai') {
    examMode = 'ai_generated_mock';
  } else if (location.pathname.includes('full-mock') || queryMode === 'full') {
    examMode = 'full_mock';
  }

  const modeTitle = examMode === 'past_questions' 
    ? 'JAMB Past Questions Exam' 
    : examMode === 'ai_generated_mock' 
    ? 'AI-Generated Adaptive Mock' 
    : 'Full JAMB Mock Exam';
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSubject, setStartingSubject] = useState<string>('');
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('');
  const [examSubjectsList, setExamSubjectsList] = useState<string[]>([]);
  
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({});
  const toggleEliminated = (questionId: string, option: string) => {
    setEliminatedOptions(prev => {
      const current = prev[questionId] || [];
      const updated = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: updated };
    });
  };

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeSpentOnQuestions, setTimeSpentOnQuestions] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours (typical JAMB time)
  const [showCalculator, setShowCalculator] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadText, setScratchpadText] = useState(() => localStorage.getItem('jamb_exam_scratchpad') || '');

  useEffect(() => {
    localStorage.setItem('jamb_exam_scratchpad', scratchpadText);
  }, [scratchpadText]);

  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(new Date().toISOString());
  const [warnings, setWarnings] = useState(0);
  const [isCompromised, setIsCompromised] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [showWarning, setShowWarning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const hasWarnedFiveMinutes = useRef(false);

  // Focus Lock Anti-Cheat Hook
  const {
    isLocked,
    warnings: focusLockWarnings,
    isCompromised: isFocusLockCompromised,
    showWarningModal: showFocusLockModal,
    setShowWarningModal: setShowFocusLockModal
  } = useFocusLock({
    enabled: hasStarted,
    maxWarnings: 3,
    onCompromised: () => {
      setIsCompromised(true);
      submitExam(true);
    }
  });

  const handleNext = useCallback(() => {
    if (currentQuestionIdx < questions.length - 1) {
      setSwipeDirection('left');
      setCurrentQuestionIdx(c => c + 1);
    }
  }, [currentQuestionIdx, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentQuestionIdx > 0) {
      setSwipeDirection('right');
      setCurrentQuestionIdx(c => c - 1);
    }
  }, [currentQuestionIdx]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (currentQuestionIdx < questions.length - 1) {
        handleNext();
      }
    },
    onSwipeRight: () => {
      if (currentQuestionIdx > 0) {
        handlePrev();
      }
    }
  });

  // Broadcast Focus Mode & Live Exam Active state to lock AI Tutor and suppress widgets
  useEffect(() => {
    if (hasStarted && profile?.id) {
      localStorage.setItem('scholars_live_exam_active', 'true');
      window.dispatchEvent(new CustomEvent('scholars:exam-active', { detail: { active: true } }));
      window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: true } }));

      // Call server endpoint to set is_ai_tutor_locked = true in database exam_sessions
      fetch('/api/exam-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId: profile.id,
          mode: 'CBT Exam',
          subjects: examSubjectsList
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data?.sessionId) setSessionId(data.sessionId);
      })
      .catch(err => console.warn('[Exam Session Start API Notice]', err));

      // Global Keydown Anti-Cheat Handler
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())) ||
          e.key === 'F12' ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
        ) {
          e.preventDefault();
          e.stopPropagation();
          toast.warning('Proctor Mode: Keyboard shortcut blocked during live CBT exam.');
        }
      };

      // Block copy, paste, cut, contextmenu, drag, selectstart on exam text areas & containers
      const blockCopyPaste = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        toast.warning('Proctor Mode: Copying, pasting, and text selection are disabled during live exam.');
      };

      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('copy', blockCopyPaste, true);
      window.addEventListener('paste', blockCopyPaste, true);
      window.addEventListener('cut', blockCopyPaste, true);
      window.addEventListener('contextmenu', blockCopyPaste, true);
      window.addEventListener('selectstart', blockCopyPaste, true);

      return () => {
        localStorage.removeItem('scholars_live_exam_active');
        window.dispatchEvent(new CustomEvent('scholars:exam-active', { detail: { active: false } }));
        window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: false } }));
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('copy', blockCopyPaste, true);
        window.removeEventListener('paste', blockCopyPaste, true);
        window.removeEventListener('cut', blockCopyPaste, true);
        window.removeEventListener('contextmenu', blockCopyPaste, true);
        window.removeEventListener('selectstart', blockCopyPaste, true);

        // Call server endpoint to set is_ai_tutor_locked = false
        fetch('/api/exam-session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, status: 'submitted' })
        }).catch(() => {});
      };
    } else {
      window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: focusMode } }));
    }
  }, [hasStarted, focusMode, profile?.id, examSubjectsList]);

  useEffect(() => {
    const initializeExam = async () => {
      
  if (!examSubjectsList || examSubjectsList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold font-display text-foreground">No Subjects Registered</h2>
          <p className="text-muted-foreground">Please complete your UTME subject registration in your profile to take the exam.</p>
          <Button onClick={() => navigate('/profile')} className="w-full font-bold">Go to Profile</Button>
        </div>
      </div>
    );
  }

  if (!profile) return;
      
      try {
        // Check for interrupted exam from localStorage or IndexedDB
        const activeInterrupted = getInterruptedExamSession();
        const shouldDirectResume = location.state?.resume;

        if (activeInterrupted && activeInterrupted.questions && activeInterrupted.questions.length > 0) {
          if (shouldDirectResume || window.confirm("We found an unfinished exam session. Would you like to resume your previous exam?")) {
            setQuestions(activeInterrupted.questions);
            setAnswers(activeInterrupted.answers || {});
            setFlagged(activeInterrupted.flagged || {});
            setSessionStartedAt(activeInterrupted.startedAt);
            setTimeLeft(activeInterrupted.timeLeft);
            setCurrentQuestionIdx(activeInterrupted.currentQuestionIdx || 0);
            setExamSubjectsList(activeInterrupted.subjects || []);
            setHasStarted(true);
            setLoading(false);
            toast.success("Exam session restored successfully!");
            return;
          } else {
            await clearInterruptedExamSession(profile.id);
          }
        }
      } catch (e) {
        console.warn("Interrupted session restore error:", e);
      }

      // JAMB 180-Question Master Logic via QuestionFlowService
      const userSubs = profile.utme_subjects?.length > 0 ? profile.utme_subjects : [];
      const validation = validateUtmeSubjectCombination(userSubs);
      const finalSubjects = validation.isValid 
        ? validation.normalizedSubjects 
        : [];

      setExamSubjectsList(finalSubjects);
      
      const flowResult = await QuestionFlowService.fetchQuestionsForMode({
        mode: examMode,
        subjectIds: finalSubjects,
        count: examMode === 'past_questions' ? 40 : 180
      });

      console.log(`[CBT Exam Question Flow] Full Mock Retrieved: ${flowResult.totalRetrieved} questions across ${Object.keys(flowResult.validation.subjectsCovered).length} subjects in ${flowResult.queryLatencyMs}ms (Zero Mock Enforced)`);

      if (flowResult.questions.length < 10) {
        toast.error("Insufficient active questions in the database to form a full exam. Please contact support.");
      }

      setQuestions(flowResult.questions);
      setLoading(false);
    };
    
    initializeExam();
  }, [profile, location.state]);

  // Proctoring: Fullscreen lock, Tab-switch, and Blur detection
  useEffect(() => {
    let lastWarningTime = 0;

    const triggerProctorWarning = (reason: string) => {
      if (!hasStarted) return;
      const now = Date.now();
      // Throttle warnings by 1.5s to avoid duplicate triggers from simultaneous blur + visibilitychange
      if (now - lastWarningTime < 1500) return;
      lastWarningTime = now;

      setWarnings(prev => {
        const newWarnings = prev + 1;
        if (newWarnings >= 3) {
          setIsCompromised(true);
          toast.error(`Proctor Mode: Maximum integrity violations reached (${newWarnings}/3). Submitting exam automatically.`);
          submitExam(true); // Submit forcefully as compromised
        } else {
          setShowWarning(true);
          toast.warning(`Proctor Warning (${newWarnings}/3): ${reason}`);
        }
        return newWarnings;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerProctorWarning('Tab switch / window minimize detected.');
      }
    };

    const handleBlur = () => {
      triggerProctorWarning('Window focus lost / application switched.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [hasStarted]);

  const targetEndTimeRef = useRef<number | null>(null);

  // Persistent, non-blocking background-resilient Timer Effect
  useEffect(() => {
    if (!hasStarted || questions.length === 0) return;

    // Initialize absolute target end timestamp if not set
    if (!targetEndTimeRef.current) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
    }

    const updateTimer = () => {
      if (!targetEndTimeRef.current) return;
      const remaining = Math.max(0, Math.floor((targetEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      setTimeSpentOnQuestions(prev => {
        const currentQId = questions[currentQuestionIdx]?.id;
        if (!currentQId) return prev;
        return { ...prev, [currentQId]: (prev[currentQId] || 0) + 1 };
      });

      if (remaining <= 0) {
        toast.error("Time's up! Submitting your exam automatically.");
        submitExam();
        return;
      }

      // 5-Minute Warning Audio Cue and Notification
      if (remaining === 300 || (remaining <= 300 && remaining > 290 && !hasWarnedFiveMinutes.current)) {
        hasWarnedFiveMinutes.current = true;
        if (soundEnabled) {
          playFiveMinuteWarningSound();
        }
        toast.warning('5 MINUTES REMAINING! Please review your answers and prepare to conclude your exam.', {
          duration: 9000
        });
      }
    };

    const timer = setInterval(updateTimer, 1000);

    // Force immediate recalibration when switching back from another browser window or tab
    const handleSyncOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTimer();
      }
    };

    window.addEventListener('focus', handleSyncOnVisibility);
    document.addEventListener('visibilitychange', handleSyncOnVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleSyncOnVisibility);
      document.removeEventListener('visibilitychange', handleSyncOnVisibility);
    };
  }, [hasStarted, questions, currentQuestionIdx, soundEnabled]);

  // JAMB Keyboard Navigation Shortcuts
  useEffect(() => {
    if (!hasStarted || questions.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in scratchpad or other input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();
      const currentQ = questions[currentQuestionIdx];
      if (!currentQ) return;

      const options = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];
      
      switch (key) {
        case 'A':
          if (options[0]) handleSelectAnswer(currentQ.id, options[0]);
          break;
        case 'B':
          if (options[1]) handleSelectAnswer(currentQ.id, options[1]);
          break;
        case 'C':
          if (options[2]) handleSelectAnswer(currentQ.id, options[2]);
          break;
        case 'D':
          if (options[3]) handleSelectAnswer(currentQ.id, options[3]);
          break;
        case 'P':
          handlePrev();
          break;
        case 'N':
          handleNext();
          break;
        case 'S':
          e.preventDefault();
          confirmAction(
            "Submit Exam",
            "Are you sure you want to submit your exam now?",
            () => submitExam()
          );
          break;
        case '?':
          setShowShortcutsModal(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, currentQuestionIdx, questions, answers, handleNext, handlePrev, confirmAction]);

  // Auto-save to both localStorage and Dexie periodically and on state change (crash safety)
  useEffect(() => {
    if (!hasStarted || !profile || questions.length === 0) return;
    
    persistActiveExamSession({
      userId: profile.id,
      questions,
      answers,
      flagged,
      startedAt: sessionStartedAt,
      savedAt: new Date().toISOString(),
      timeLeft,
      currentQuestionIdx,
      subjects: examSubjectsList
    });
  }, [hasStarted, answers, flagged, timeLeft, currentQuestionIdx, questions, profile, sessionStartedAt, examSubjectsList]);

  const submitExam = async (compromised = false) => {
    if (questions.length === 0 || submitting) return;
    setSubmitting(true);
    
    const timeSpentSeconds = 7200 - timeLeft;
    let finalScore = 0;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/cbt/submit-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          sessionId,
          mode: 'exam',
          answers,
          timeSpentSeconds,
          isPractice: false
        })
      });
      
      const result = await res.json();
      if (result.success) {
        finalScore = result.score;
        // Re-inject correct answers for the review UI
        result.results.forEach((r: any) => {
          const q = questions.find(q => q.id === r.id);
          if (q) q.correct_answer = r.correct_answer;
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.warn("Secure server submission failed, falling back to local scoring. Note: Offline scoring requires locally cached answer keys.", err);
      // Fallback local scoring (will only work correctly if offline pack provided correct_answer)
      questions.forEach((q) => {
        if (answers[q.id] === q.correct_answer) finalScore++;
      });
      
      // Save offline fallback result
      const sessionPayload = {
        id: sessionId,
        user_id: profile?.id,
        score: finalScore,
        total_questions: questions.length,
        status: compromised ? 'compromised' : 'submitted',
        is_ai_tutor_locked: false,
        submitted_at: new Date().toISOString()
      };
      await saveCompletedOfflineSession(sessionPayload as any);
    }
    
    // Clear backups
    sessionStorage.removeItem('cbt_backup');
    clearExamSnapshot();
    
    // Persist to Supabase exam_sessions directly to guarantee live dashboard and leaderboard progression
    if (profile?.id) {
      try {
        const scaledScore = questions.length > 0 
          ? Math.round((finalScore / questions.length) * 400) 
          : finalScore;

        await supabase.from('exam_sessions').upsert({
          id: sessionId,
          user_id: profile.id,
          score: scaledScore,
          total_questions: questions.length,
          status: compromised ? 'compromised' : 'submitted',
          is_ai_tutor_locked: false,
          submitted_at: new Date().toISOString()
        });

        // Trigger real-time notification for dashboard widgets (Heatmap, Predictor, Trend)
        window.dispatchEvent(new CustomEvent('scholars:exam-completed', {
          detail: { score: finalScore, scaledScore, total: questions.length, sessionId }
        }));
      } catch (dbErr) {
        console.warn('Failed to upsert exam_session in Supabase:', dbErr);
      }
    }

    // Save to Smart Mistake Bank (store complete question objects for instant remedial drill)
    const mistakesToSave = questions.filter(q => answers[q.id] !== q.correct_answer && q.correct_answer);
    if (mistakesToSave.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
        const cleanExisting = Array.isArray(existing) 
          ? existing.filter((item: any) => typeof item === 'object' && item?.id) 
          : [];
        const combined = [...cleanExisting, ...mistakesToSave];
        const uniqueMistakes = Array.from(new Map(combined.map(q => [q.id, q])).values());
        localStorage.setItem('jamb_mistake_bank', JSON.stringify(uniqueMistakes));
      } catch (e) {
        console.warn('Failed to save to Mistake Bank:', e);
      }
    }

    if (document.fullscreenElement) {
       document.exitFullscreen().catch(console.error);
    }
        
    navigate('/results', { state: { score: finalScore, total: questions.length, mode: 'CBT Exam', questions, answers, timeSpentSeconds } });
  };
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimeColorClass = () => {
    if (timeLeft <= 300) return "text-red-500 animate-pulse bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/40 shadow-sm";
    if (timeLeft <= 900) return "text-amber-500 bg-amber-500/10 px-3 py-1 rounded-lg";
    return "text-green-600 bg-green-500/10 px-3 py-1 rounded-lg";
  };
  const getQuestionPaceColor = (timeSpent: number) => {
    if (!timeSpent || timeSpent <= 35) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30";
    }
    if (timeSpent <= 45) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30";
    }
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse";
  };

  const getQuestionPaceLabel = (timeSpent: number) => {
    if (!timeSpent || timeSpent <= 35) {
      return `⚡ ${timeSpent || 0}s (40s Target: Great)`;
    }
    if (timeSpent <= 45) {
      return `⏳ ${timeSpent}s (Approaching 45s)`;
    }
    return `⚠️ ${timeSpent}s (Pace Alert: >45s)`;
  };


  const getPaceStatus = () => {
    if (!questions || questions.length === 0 || !hasStarted) return null;
    const totalDurationSecs = 7200; // Standard 2 hours
    const secondsPerQuestion = Math.max(15, Math.floor(totalDurationSecs / questions.length));
    const elapsedSeconds = totalDurationSecs - timeLeft;
    const targetSeconds = (currentQuestionIdx + 1) * secondsPerQuestion;

    if (elapsedSeconds < targetSeconds - 60) {
      return {
        label: "Ahead of Pace ⚡",
        colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        status: "ahead"
      };
    } else if (elapsedSeconds > targetSeconds + 90) {
      return {
        label: "Behind Pace ⚠️",
        colorClass: "bg-rose-500/15 text-rose-400 border-rose-500/25 animate-pulse",
        status: "behind"
      };
    } else {
      return {
        label: "On Track • Pace Perfect",
        colorClass: "bg-teal-500/15 text-teal-300 border-teal-500/25",
        status: "on_track"
      };
    }
  };

  const handleSelectAnswer = useCallback((questionId: string, option: string) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: option };
      if (profile) {
        saveExamSnapshot({
          id: `session_${profile.id}`,
          userId: profile.id,
          questions,
          answers: newAnswers,
          startedAt: sessionStartedAt,
          savedAt: new Date().toISOString(),
          timeLeft
        }).catch(console.warn);
      }
      return newAnswers;
    });
  }, [profile, questions, sessionStartedAt, timeLeft]);

  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const handleTakeSnapshot = async () => {
    setIsCapturingSnapshot(true);
    try {
      const snap = await CbtSnapshotService.captureSnapshot({
        examMode: 'mock',
        sessionTitle: `UTME CBT Exam (${examSubjectsList.join(', ')})`,
        questions,
        answers,
        currentQuestionIndex: currentQuestionIdx,
        timeLeftSeconds: timeLeft,
        totalTimeSeconds: 7200,
        flaggedIndices: Object.keys(flagged).filter(k => flagged[Number(k)]).map(Number),
        user: {
          id: profile?.id || 'anonymous_candidate',
          name: profile?.full_name || 'Candidate',
          email: profile?.email || 'candidate@scholarsresort.com'
        }
      });
      toast.success(`Session Snapshot #${snap.id} saved! Available in Admin Dashboard.`);
    } catch (err: any) {
      toast.error('Failed to capture snapshot: ' + err.message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const toggleFlag = useCallback(() => {
    setFlagged(prev => ({ ...prev, [currentQuestionIdx]: !prev[currentQuestionIdx] }));
  }, [currentQuestionIdx]);

  // Keyboard Shortcuts (A, B, C, D, 1, 2, 3, 4, N, P, F, G, C, K, M, S, ?, H)
  useEffect(() => {
    if (!hasStarted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing into an input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      const key = e.key.toUpperCase();
      const q = questions[currentQuestionIdx];

      // Help Modal Toggle
      if (e.key === '?' || (e.shiftKey && e.key === '/') || key === 'H') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setShowCalculator(false);
        setShowNavDrawer(false);
        return;
      }

      // Question Navigator Drawer Toggle (G or Q)
      if (key === 'G') {
        e.preventDefault();
        setShowNavDrawer(prev => !prev);
        return;
      }

      // Flagging
      if (key === 'F') {
        e.preventDefault();
        toggleFlag();
        return;
      }

      // Audio Mute Toggle
      if (key === 'M') {
        e.preventDefault();
        setSoundEnabled(prev => {
          const next = !prev;
          if (next) {
            playFiveMinuteWarningSound();
            toast.success('Audio cues enabled');
          } else {
            toast.info('Audio cues muted');
          }
          return next;
        });
        return;
      }

      // Calculator Toggle (C or K)
      if (key === 'K' || (key === 'C' && !['A', 'B', 'D'].includes(key) && e.altKey)) {
        e.preventDefault();
        setShowCalculator(prev => !prev);
        return;
      }
      
      if (!q) return;

      // Option A, B, C, D selection
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const optionIndex = key.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        if (q.options[optionIndex]) {
          handleSelectAnswer(q.id, q.options[optionIndex]);
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const optionIndex = parseInt(e.key, 10) - 1;
        if (q.options[optionIndex]) {
          handleSelectAnswer(q.id, q.options[optionIndex]);
        }
      } else if (key === 'N' || e.key === 'ArrowRight') {
        handleNext();
      } else if (key === 'P' || e.key === 'ArrowLeft') {
        handlePrev();
      } else if (key === 'S') {
        confirmAction(
            "Submit Exam",
            "Are you sure you want to submit your exam now?",
            () => submitExam()
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, currentQuestionIdx, questions, handleSelectAnswer, handleNext, handlePrev, soundEnabled, toggleFlag]);

  if (loading) {
    return <div className="flex flex-col h-screen bg-background items-center justify-center font-display text-xl animate-pulse">Loading Official Exam Engine...</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-4 font-display">No Questions Available</h2>
        <p className="text-muted-foreground mb-8">There are no active questions in the bank yet. Please ask an admin to add some.</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 w-full overflow-y-auto">
        <div className="bg-white dark:bg-card shadow-2xl rounded-xl border-t-8 border-green-600 max-w-4xl w-full p-4 sm:p-8 my-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start border-b border-slate-200 dark:border-border pb-4 sm:pb-6 mb-4 sm:mb-6 gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-200 dark:bg-muted border border-slate-300 dark:border-border flex items-center justify-center text-slate-500 dark:text-muted-foreground font-bold text-xs uppercase text-center rounded-lg shrink-0">
                Candidate<br/>Photo
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold uppercase text-green-800 dark:text-green-400 mb-1 font-display">Joint Admissions and Matriculation Board</h1>
                <h2 className="text-base sm:text-xl font-bold text-slate-700 dark:text-slate-200">2026 UTME Examination</h2>
                <div className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
                  <p><strong>Candidate Name:</strong> {String(profile?.full_name || 'REGISTERED CANDIDATE').toUpperCase()}</p>
                  <p><strong>Registration Number:</strong> {String(profile?.id || 'UTME').substring(0, 10).toUpperCase()}UT</p>
                  <p><strong>Seat Number:</strong> 042</p>
                </div>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl ml-auto mb-2 shadow-sm">
                SR
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <div className="bg-slate-50 dark:bg-muted/30 p-4 border border-slate-200 dark:border-border rounded-xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-border pb-1 text-sm sm:text-base">Registered UTME Subjects</h3>
              <ul className="list-disc pl-5 text-xs sm:text-sm space-y-1 font-semibold text-slate-700 dark:text-slate-300 mb-4">
                {examSubjectsList.map((s: string, i: number) => (
                  <li key={i}>{String(s || '').toUpperCase()} ({s === 'Use of English' ? '60 Qs' : '40 Qs'})</li>
                ))}
              </ul>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-border">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Choose Starting Subject First:
                </label>
                <select 
                  className="w-full bg-white dark:bg-card border border-slate-300 dark:border-border rounded-lg p-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 shadow-sm"
                  value={startingSubject}
                  onChange={(e) => setStartingSubject(e.target.value)}
                >
                  {examSubjectsList.map((subj, idx) => (
                    <option key={idx} value={subj}>
                      Start with {subj} ({subj === 'Use of English' ? '60 Qs' : '40 Qs'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-amber-500/10 dark:bg-amber-950/20 p-4 border border-amber-500/20 rounded-xl text-xs sm:text-sm text-amber-900 dark:text-amber-300">
              <h3 className="font-bold mb-2 border-b border-amber-500/20 pb-1 flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" /> Important Instructions
              </h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Do not click "Submit Exam" until you have attempted your questions.</li>
                <li><strong>Subject Switcher:</strong> Use the subject tabs at the top of the exam screen to freely switch between registered subjects at any time during the test.</li>
                <li><strong>Mobile & Desktop Ready:</strong> On mobile, swipe left/right or tap Jump to navigate questions.</li>
                <li>On desktop, use <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">A</kbd> <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">B</kbd> <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">C</kbd> <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">D</kbd> keys to select answers.</li>
                <li>Use <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">N</kbd> for Next, <kbd className="px-1.5 py-0.5 bg-card border rounded text-xs font-mono">P</kbd> for Previous.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 border-t border-slate-200 dark:border-border pt-4 sm:pt-6">
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-8 sm:px-12 py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-lg font-bold tracking-wide transition-all active:scale-95"
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch((err) => console.log('Fullscreen denied:', err));
                }
                
                // Find index of first question matching chosen starting subject
                const startIdx = questions.findIndex(q => q.subject_name === startingSubject);
                if (startIdx >= 0) {
                  setCurrentQuestionIdx(startIdx);
                  setActiveSubjectTab(startingSubject);
                }

                setHasStarted(true);
                setSessionStartedAt(new Date().toISOString());
              }}
            >
              START EXAM WITH {String(startingSubject || '').toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentQuestionIdx];

  return (
    <div className="h-[100dvh] w-full bg-[#f4f7f6] dark:bg-background text-foreground flex flex-col overflow-hidden select-none">
      <FocusLockOverlay
        isOpen={showFocusLockModal}
        warnings={focusLockWarnings}
        maxWarnings={3}
        isCompromised={isFocusLockCompromised}
        onResume={() => {
          setShowFocusLockModal(false);
          if (isFocusLockCompromised) {
            submitExam(true);
          }
        }}
      />
      
      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center text-white p-6 text-center animate-in fade-in">
          <AlertTriangle className="w-24 h-24 mb-6" />
          <h1 className="text-4xl font-bold mb-4 font-display">WARNING! ({warnings}/3)</h1>
          <p className="text-xl max-w-2xl mb-8">
            You have left the exam tab. This is a violation of exam rules. 
            If you do this {3 - warnings} more time{3 - warnings !== 1 ? 's' : ''}, your exam will be automatically submitted and marked as compromised.
          </p>
          <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/20 h-14 px-10 text-lg" onClick={() => setShowWarning(false)}>
            Return to Exam
          </Button>
        </div>
      )}

      {/* Header - Classic JAMB style with modern touches */}
      <header className={`transition-all duration-300 bg-white dark:bg-card border-b border-slate-200 dark:border-border flex items-center justify-between px-3 md:px-6 shadow-xs flex-shrink-0 ${focusMode ? 'h-14 md:h-16 bg-slate-900 text-white border-slate-800' : 'h-16 md:h-20'}`}>
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-bold text-sm md:text-xl shrink-0 ${focusMode ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'}`}>
            {focusMode ? <Eye className="w-4 h-4 md:w-5 md:h-5" /> : 'SR'}
          </div>
          <div className="min-w-0">
            <h1 className={`font-bold text-xs sm:text-sm md:text-lg leading-tight uppercase truncate ${focusMode ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
              {focusMode ? 'Focus Mode Active' : modeTitle}
            </h1>
            {!focusMode && (
              <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
                {profile?.full_name || 'Candidate'} • <span className="font-mono">{String(profile?.id || 'UTME01').substring(0,6).toUpperCase()}</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Focus Mode Toggle */}
          <Button 
            id="cbt-focus-mode-toggle-btn"
            variant="outline" 
            size="sm" 
            onClick={() => {
              const next = !focusMode;
              setFocusMode(next);
              if (next) {
                toast.info('Focus Mode Enabled: Minimized distraction view');
              } else {
                toast.info('Focus Mode Disabled');
              }
            }} 
            className={`h-8 sm:h-9 px-2 sm:px-3 text-xs border font-medium transition-all ${
              focusMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 shadow-xs' 
                : 'bg-slate-100 dark:bg-muted hover:bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-border'
            }`}
            title="Toggle Focus Mode"
          >
            {focusMode ? <EyeOff className="w-3.5 h-3.5 sm:mr-1.5" /> : <Eye className="w-3.5 h-3.5 sm:mr-1.5 text-purple-600 dark:text-purple-400" />}
            <span className="hidden sm:inline">{focusMode ? 'Exit' : 'Focus'}</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const nextState = !soundEnabled;
              setSoundEnabled(nextState);
              if (nextState) {
                playFiveMinuteWarningSound();
                toast.success('Exam audio cues enabled');
              } else {
                toast.info('Exam audio cues muted');
              }
            }} 
            className={`hidden sm:flex h-9 px-3 text-xs border ${soundEnabled ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-muted text-slate-500 border-slate-300 dark:border-border'}`}
            title={soundEnabled ? 'Audio cues active' : 'Audio cues muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
            <span className="hidden md:inline">{soundEnabled ? 'Sound' : 'Muted'}</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowNavDrawer(true)} 
            className="h-8 sm:h-9 px-2 sm:px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-bold flex items-center gap-1 sm:gap-1.5 shadow-xs"
            title="Open Question Navigator Grid (Shortcut: G)"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.2 rounded-full font-mono">
              {currentQuestionIdx + 1}/{questions.length}
            </span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowCalculator(!showCalculator)} 
            className="h-8 sm:h-9 px-2 sm:px-2.5 text-xs bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-200 border-slate-300 dark:border-border"
          >
            <Calculator className="w-3.5 h-3.5 sm:mr-1" /> 
            <span className="hidden md:inline">Calc</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowScratchpad(!showScratchpad)} 
            className={`h-8 sm:h-9 px-2 sm:px-2.5 text-xs border border-slate-300 dark:border-border ${
              showScratchpad ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold' : 'bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-200'
            }`}
            title="Open Exam Scratchpad & Scribble Notes"
          >
            <Edit3 className="w-3.5 h-3.5 sm:mr-1" /> 
            <span className="hidden md:inline">Scratchpad</span>
          </Button>

          {/* Admin / Diagnostic Snapshot Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTakeSnapshot}
            disabled={isCapturingSnapshot}
            className="h-8 sm:h-9 px-2 sm:px-2.5 text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30 font-semibold"
            title="Capture Active Exam State Snapshot for Diagnostics"
          >
            <Camera className={`w-3.5 h-3.5 sm:mr-1 ${isCapturingSnapshot ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">{isCapturingSnapshot ? 'Saving...' : 'Snapshot'}</span>
          </Button>

          <div className="flex flex-col items-end pl-1 sm:pl-2 gap-1">
            {getPaceStatus() && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${getPaceStatus()?.colorClass}`}>
                {getPaceStatus()?.label}
              </span>
            )}
            {!focusMode && (
              <span className="hidden sm:inline text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Time Left</span>
            )}
            <motion.div 
              animate={timeLeft <= 300 ? { scale: [1, 1.05, 1], opacity: [1, 0.7, 1] } : {}}
              transition={timeLeft <= 300 ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
              className={`flex items-center gap-1 md:gap-1.5 text-sm sm:text-lg md:text-2xl font-display font-bold px-2 py-0.5 sm:py-1 rounded-lg ${
                timeLeft <= 300 
                  ? 'bg-red-500/10 text-red-600 border border-red-500/30' 
                  : focusMode ? 'bg-purple-950/80 text-purple-300 border border-purple-700' : getTimeColorClass()
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="font-mono tracking-tighter">{formatTime(timeLeft)}</span>
            </motion.div>
          </div>
        </div>
      </header>
      
      {showCalculator && (
        <div className="fixed top-16 sm:top-24 right-3 sm:right-10 z-50 animate-in slide-in-from-top-4">
          <JambCalculator onClose={() => setShowCalculator(false)} />
        </div>
      )}

      {showScratchpad && (
        <div className="fixed top-20 sm:top-28 right-3 sm:right-20 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-4 text-slate-100">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
            <span className="font-bold text-[10px] tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              JAMB Brain-Dump Pad
            </span>
            <button 
              onClick={() => setShowScratchpad(false)}
              className="text-slate-400 hover:text-slate-200 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              Close
            </button>
          </div>
          <textarea
            value={scratchpadText}
            onChange={(e) => setScratchpadText(e.target.value)}
            placeholder="Type your notes, formulas, calculations, or novel character maps here... (Auto-saves instantly)"
            className="w-full h-44 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none font-mono placeholder:text-slate-600"
          />
          <div className="text-[10px] text-slate-500 text-right mt-1.5">
            Saves to browser memory
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Side: Question Area */}
        <div 
          {...swipeHandlers}
          className="flex-1 flex flex-col relative bg-card text-card-foreground m-1.5 sm:m-2 md:m-4 lg:mr-0 rounded-xl shadow-xs border border-border min-h-0 touch-pan-y"
        >
          {/* Real JAMB Subject Switcher Tabs */}
          <div className="bg-slate-900 dark:bg-slate-950 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto rounded-t-xl hide-scrollbar">
            {examSubjectsList.map((subjName, idx) => {
              const activeQSubject = q?.subject_name;
              const isSelectedSubject = activeQSubject === subjName;
              
              // Count answered in this subject
              const subjectQs = questions.filter(item => item.subject_name === subjName);
              const answeredSubjCount = subjectQs.filter(item => !!answers[item.id]).length;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    const firstSubjIdx = questions.findIndex(item => item.subject_name === subjName);
                    if (firstSubjIdx >= 0) {
                      setCurrentQuestionIdx(firstSubjIdx);
                      setActiveSubjectTab(subjName);
                    }
                  }}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded text-[10px] sm:text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-1 sm:gap-2 ${
                    isSelectedSubject
                      ? 'bg-emerald-600 text-white shadow-xs border border-emerald-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{subjName}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] ${isSelectedSubject ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                    {answeredSubjCount}/{subjectQs.length || (subjName === 'Use of English' ? 60 : 40)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile Swipe Navigation Helper */}
          <div className="px-3 py-1.5 bg-muted/20 border-b border-border/50 text-[11px] text-muted-foreground flex items-center justify-between sm:hidden select-none">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Swipe ⟵ / ⟶ to switch questions
            </span>
            <button 
              onClick={() => setShowNavDrawer(true)}
              className="text-primary font-bold hover:underline flex items-center gap-0.5"
            >
              Open Grid <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 md:p-4 border-b border-border flex flex-wrap justify-between items-center bg-muted/30 gap-2">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
               <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md font-bold text-xs md:text-sm border border-primary/20">
                 Question {currentQuestionIdx + 1} of {questions.length}
               </span>
               
               {/* Dynamic JAMB 40s Rule Pacer Badge */}
               <span className={`px-2.5 py-1 rounded-md text-[11px] md:text-xs font-bold transition-colors ${getQuestionPaceColor(timeSpentOnQuestions[q?.id] || 0)}`}>
                 {getQuestionPaceLabel(timeSpentOnQuestions[q?.id] || 0)}
               </span>

               <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-[10px] md:text-xs font-bold uppercase">
                 {q?.subject_name || 'Subject'}
               </span>
               <button 
                 onClick={() => setShowNavDrawer(true)}
                 className="hidden sm:flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-1"
               >
                 <Grid3X3 className="w-3 h-3" /> Jump
               </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCalculator(!showCalculator)} className="md:hidden h-8 text-xs gap-1">
                <Calculator className="w-3.5 h-3.5" /> Calc
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleFlag} 
                className={`h-8 text-xs ${flagged[currentQuestionIdx] ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" : ""}`}
              >
                <Flag className={`w-3.5 h-3.5 mr-1.5 ${flagged[currentQuestionIdx] ? "fill-red-600 text-red-600" : ""}`} />
                {flagged[currentQuestionIdx] ? 'Flagged' : 'Flag'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { 
                  toast.success("Question flagged for admin review. Thank you!"); 
                  const current = JSON.parse(localStorage.getItem("jamb_reported_errors") || "[]"); 
                  current.push({ 
                    id: Date.now().toString(), 
                    question_id: questions[currentQuestionIdx]?.id, 
                    reason: "Student Report", 
                    details: "Reported during CBT Exam", 
                    status: "pending" 
                  }); 
                  localStorage.setItem("jamb_reported_errors", JSON.stringify(current)); 
                }} 
                className="h-8 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20"
              >
                Report Error
              </Button>
            </div>
          </div>
          
          <motion.div 
            key={currentQuestionIdx}
            initial={{ opacity: 0, x: swipeDirection === 'left' ? 16 : swipeDirection === 'right' ? -16 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
          >
            <div className="text-base md:text-xl leading-relaxed font-medium text-foreground">
              <MathText text={q.question_text} />
              {q.image_url && (
                <div className="my-4 flex justify-start">
                  <img 
                    src={q.image_url} 
                    alt="Question diagram" 
                    className="max-h-72 max-w-full object-contain rounded-lg border border-border shadow-xs bg-white p-2" 
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-3 md:gap-4 max-w-3xl">
              {q.options.map((opt: string, i: number) => {
                const isSelected = answers[q.id] === opt;
                const letter = String.fromCharCode(65 + i);
                const isEliminated = (eliminatedOptions[q.id] || []).includes(opt);
                
                return (
                  <div 
                    key={i} 
                    className="relative flex items-center w-full"
                  >
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={() => !isEliminated && handleSelectAnswer(q.id, opt)}
                      onDoubleClick={(e) => { e.stopPropagation(); toggleEliminated(q.id, opt); }}
                      className={`flex-1 flex items-start text-left p-3.5 pr-20 md:p-4 md:pr-24 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/10 dark:bg-primary/20 text-foreground shadow-sm' 
                          : isEliminated
                            ? 'border-dashed border-slate-700/40 opacity-40 bg-slate-100/5 dark:bg-slate-900/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center font-bold mr-3 md:mr-4 shrink-0 text-xs md:text-sm transition-colors ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {letter}
                      </div>
                      <span className={`text-sm md:text-lg pt-0.5 ${isSelected ? 'font-semibold text-primary' : 'text-foreground'} ${isEliminated ? 'line-through opacity-55' : ''}`}>
                        <MathText text={cleanOptionText(opt)} />
                      </span>
                    </motion.button>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEliminated(q.id, opt);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded border border-slate-700/30 bg-slate-900/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 text-[9px] font-mono tracking-wider font-bold transition-colors active:scale-95"
                      title={isEliminated ? "Restore option" : "Eliminate option"}
                    >
                      {isEliminated ? "RESTORE" : "CROSS OUT"}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <div className="p-2.5 sm:p-3 md:p-4 border-t border-border bg-muted/30 rounded-b-xl flex justify-between items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handlePrev} 
              disabled={currentQuestionIdx === 0} 
              className="flex-1 sm:flex-none sm:w-28 md:w-32 h-9 md:h-10 text-xs md:text-sm font-semibold active:scale-95"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowNavDrawer(true)}
              className="h-9 px-2.5 sm:px-3 text-xs font-bold text-primary hover:bg-primary/10 border-primary/30 flex items-center gap-1 active:scale-95"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Jump</span>
            </Button>

            <Button 
              onClick={handleNext} 
              disabled={currentQuestionIdx === questions.length - 1} 
              className="flex-1 sm:flex-none sm:w-28 md:w-32 h-9 md:h-10 text-xs md:text-sm bg-primary hover:bg-primary/90 font-semibold active:scale-95"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            {/* Mobile-only Submit Quick Action */}
            <Button 
              onClick={() => {
                confirmAction(
                  "Submit Exam",
                  "Are you sure you want to submit your exam now?",
                  () => submitExam()
                );
              }}
              variant="destructive"
              size="sm"
              className="lg:hidden h-9 px-2.5 sm:px-3 text-xs font-bold shadow-xs active:scale-95"
            >
              Submit
            </Button>
          </div>
        </div>

        {/* Right Side: Desktop Navigator */}
        <div className="hidden lg:flex w-80 bg-card text-card-foreground m-4 ml-2 rounded-xl shadow-xs border border-border flex-col max-h-full">
          <div className="p-3.5 border-b border-border bg-muted/30 rounded-t-xl flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground">Question Navigator</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowNavDrawer(true)}
                className="h-6 px-1.5 text-[11px] text-primary font-bold hover:bg-primary/10"
              >
                <Layers className="w-3 h-3 mr-1" />
                Expand
              </Button>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {Object.keys(answers).length}/{questions.length} Answered
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3.5">
             <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isFlagged = flagged[idx];
                  const isCurrent = currentQuestionIdx === idx;
                  
                  let bgColor = "bg-muted/40 border-border text-muted-foreground";
                  if (isCurrent) bgColor = "bg-primary border-primary text-primary-foreground font-bold shadow-xs scale-105";
                  else if (isFlagged) bgColor = "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 font-semibold";
                  else if (isAnswered) bgColor = "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium";

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`w-full aspect-square rounded-lg border text-xs transition-all flex items-center justify-center ${bgColor} hover:opacity-80 active:scale-95`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
             </div>
          </div>

          <div className="p-3.5 border-t border-border bg-muted/30 rounded-b-xl space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500/30 border border-emerald-500 rounded" /> Answered</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500/30 border border-red-500 rounded" /> Flagged</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-muted border border-border rounded" /> Unanswered</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-primary rounded" /> Current</div>
            </div>
            <Button onClick={() => submitExam()} variant="destructive" className="w-full font-bold h-10 shadow-xs text-sm active:scale-95">
              SUBMIT EXAM
            </Button>
          </div>
        </div>

      </div>

      {/* Floating Persistent Non-Blocking Timer Widget */}
      {hasStarted && !submitting && (
        <div className="fixed bottom-4 right-4 z-40 hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/90 text-white dark:bg-card/95 dark:text-card-foreground backdrop-blur-md border border-slate-700 dark:border-border shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Clock className={`w-4 h-4 ${timeLeft <= 300 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
          <span className="font-mono text-xs font-bold tracking-tight">
            {formatTime(timeLeft)}
          </span>
          <span className="text-[10px] text-slate-400 border-l border-slate-700 dark:border-border pl-2 pr-1 font-sans">
            {Object.keys(answers).length}/{questions.length} answered
          </span>
          {getPaceStatus() && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getPaceStatus()?.colorClass}`}>
              {getPaceStatus()?.label}
            </span>
          )}
        </div>
      )}

      {/* Mobile Floating Quick Navigator Trigger Pill */}
      {hasStarted && !submitting && (
        <div className="fixed bottom-4 left-4 z-40 sm:hidden animate-in fade-in slide-in-from-bottom-2">
          <Button
            onClick={() => setShowNavDrawer(true)}
            className="h-10 px-3.5 rounded-full bg-slate-900/95 text-white dark:bg-card/95 dark:text-card-foreground border border-slate-700 dark:border-border shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold active:scale-95 transition-transform"
          >
            <Grid3X3 className="w-4 h-4 text-emerald-400" />
            <span>Q{currentQuestionIdx + 1}/{questions.length}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </Button>
        </div>
      )}

      {/* Persistent Accessible Navigation Drawer */}
      <CBTNavigationDrawer
        isOpen={showNavDrawer}
        onClose={() => setShowNavDrawer(false)}
        questions={questions}
        currentIdx={currentQuestionIdx}
        onSelectQuestion={(idx) => {
          setCurrentQuestionIdx(idx);
          if (questions[idx]?.subject_name) {
            setActiveSubjectTab(questions[idx].subject_name);
          }
        }}
        answers={answers}
        flagged={flagged}
        subjects={examSubjectsList}
        activeSubject={q?.subject_name}
        onSelectSubject={(subj) => {
          setActiveSubjectTab(subj);
          const firstSubjIdx = questions.findIndex(item => item.subject_name === subj);
          if (firstSubjIdx >= 0) {
            setCurrentQuestionIdx(firstSubjIdx);
          }
        }}
        onSubmitExam={() => submitExam()}
      />

      {/* Floating Scratchpad */}
      {showScratchpad && (
        <motion.div 
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, x: 20, y: 100 }}
          animate={{ opacity: 1, scale: 1, x: 20, y: 100 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-50 w-72 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ touchAction: "none" }}
        >
          <div className="bg-slate-100 dark:bg-slate-800 p-2 flex justify-between items-center cursor-move border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5" /> Scratchpad
            </span>
            <button onClick={() => setShowScratchpad(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={scratchpadText}
            onChange={(e) => setScratchpadText(e.target.value)}
            className="w-full h-48 p-3 text-sm bg-transparent resize-none focus:outline-none focus:ring-0 text-slate-800 dark:text-slate-200"
            placeholder="Type your calculations, formulas, or rough notes here..."
          />
        </motion.div>
      )}

      {/* CBT Shortcuts Cheat Sheet Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Keyboard className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">CBT Exam Keyboard Shortcuts</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowShortcutsModal(false)}>✕</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 my-5 text-sm">
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Choose Option</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shadow-sm">A / B / C / D</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Next Question</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-blue-600 dark:text-blue-400 shadow-sm">N / ➔</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Previous</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-blue-600 dark:text-blue-400 shadow-sm">P / ⬅</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Navigator Drawer</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-primary shadow-sm">G</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Bookmark / Flag</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-amber-600 dark:text-amber-400 shadow-sm">F</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Calculator</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-foreground shadow-sm">K</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Audio Cues</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shadow-sm">M</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">Submit Exam</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-red-600 dark:text-red-400 shadow-sm">S</kbd>
              </div>
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <span className="font-medium text-foreground">This Guide</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-xs text-purple-600 dark:text-purple-400 shadow-sm">?</kbd>
              </div>
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={() => setShowShortcutsModal(false)}>
              Got it, continue exam
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
