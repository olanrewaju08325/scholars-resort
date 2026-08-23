import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calculator, Flag, Clock, ChevronLeft, ChevronRight, AlertTriangle, Volume2, VolumeX, Keyboard, HelpCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { JambCalculator } from '@/components/cbt/JambCalculator';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/hooks/useConfirm';
import { recordStudyAction } from '@/lib/streakService';
import { checkAndAwardBadges } from '@/lib/gamification';
import { saveExamSnapshot, clearExamSnapshot } from '@/lib/offlineDb';
import { persistActiveExamSession, getInterruptedExamSession, clearInterruptedExamSession } from '@/lib/examSessionStorage';
import { enqueueOfflineWrite } from '@/lib/syncQueue';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';
import { fetchQuestionsForSubject, normalizeSubjectName, checkSubjectDataIntegrity } from '@/utils/subjectUtils';
import { toast } from 'sonner';
import { MathText } from '@/components/MathText';
import { playFiveMinuteWarningSound } from '@/lib/celebration';

const CBTExam = () => {
  usePerfMonitoring('CBTExam');
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { confirmAction, ConfirmElement } = useConfirm();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSubject, setStartingSubject] = useState<string>('Use of English');
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('Use of English');
  const [examSubjectsList, setExamSubjectsList] = useState<string[]>([]);
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours (typical JAMB time)
  const [showCalculator, setShowCalculator] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(new Date().toISOString());
  const [warnings, setWarnings] = useState(0);
  const [isCompromised, setIsCompromised] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [showWarning, setShowWarning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const hasWarnedFiveMinutes = useRef(false);

  // Broadcast Focus Mode state to suppress WhatsApp widget & floating overlays
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: focusMode } }));
    return () => {
      window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: false } }));
    };
  }, [focusMode]);

  useEffect(() => {
    const initializeExam = async () => {
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
            setExamSubjectsList(activeInterrupted.subjects || ['Use of English']);
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

      // JAMB 180-Question Master Logic
      let userSubs = profile.utme_subjects || [];
      if (!userSubs || userSubs.length < 4) {
        userSubs = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
      }
      
      const normalizedSubs = userSubs.map((s: string) => normalizeSubjectName(s));
      const hasEnglish = normalizedSubs.includes('Use of English');
      
      const finalSubjects = hasEnglish 
        ? ['Use of English', ...normalizedSubs.filter((s: string) => s !== 'Use of English').slice(0, 3)]
        : ['Use of English', ...normalizedSubs.slice(0, 3)];

      setExamSubjectsList(finalSubjects);
      
      let allQuestions: any[] = [];
      
      for (const subj of finalSubjects) {
        // Data integrity check
        const integrity = await checkSubjectDataIntegrity(subj);
        console.log('[CBT Exam Integrity Audit]', integrity);

        const limit = subj === 'Use of English' ? 60 : 40;
        const fetched = await fetchQuestionsForSubject(subj, limit);
        
        const tagged = (fetched || []).map(q => ({
          ...q,
          subject_name: subj,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        }));

        allQuestions = [...allQuestions, ...tagged];
      }

      if (allQuestions.length < 10) {
        toast.error("Insufficient active questions in the database to form a full exam. Please contact support.");
      }

      setQuestions(allQuestions);
      setLoading(false);
    };
    
    initializeExam();
  }, [profile, location.state]);

  // Proctoring: Fullscreen lock and Tab-switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!hasStarted) return;
      if (document.visibilityState === 'hidden') {
        setWarnings(prev => {
          const newWarnings = prev + 1;
          if (newWarnings >= 4) {
            setIsCompromised(true);
            submitExam(true); // Submit forcefully as compromised
          } else {
            setShowWarning(true);
          }
          return newWarnings;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasStarted]);

  // Timer Effect
  useEffect(() => {
    if (!hasStarted || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error("Time's up! Submitting your exam automatically.");
          submitExam();
          return 0;
        }

        // 5-Minute Warning Audio Cue and Notification
        if (prev === 300 || (prev <= 300 && prev > 290 && !hasWarnedFiveMinutes.current)) {
          hasWarnedFiveMinutes.current = true;
          if (soundEnabled) {
            playFiveMinuteWarningSound();
          }
          toast.warning('⏰ 5 MINUTES REMAINING! Please review your answers and prepare to conclude your exam.', {
            duration: 9000,
            icon: '⚠️'
          });
        }

        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasStarted, questions.length, soundEnabled]);

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
    
    // Calculate score
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_answer) score++;
    });
    
    const percentageScore = (score / questions.length) * 100;
    const timeSpentSeconds = 7200 - timeLeft;

    // Save offline session to Dexie or directly to Supabase with syncQueue fallback
    if (profile) {
      const sessionId = crypto.randomUUID();
      const sessionPayload = {
        id: sessionId,
        user_id: profile.id,
        status: compromised || isCompromised ? 'abandoned' : 'submitted',
        score,
        total_questions: questions.length,
        started_at: sessionStartedAt,
        submitted_at: new Date().toISOString()
      };

      try {
        const { error: sessionError } = await supabase.from('exam_sessions').insert(sessionPayload);
        if (sessionError) throw sessionError;
      } catch (err) {
        console.warn("Saving exam session to offline queue:", err);
        await enqueueOfflineWrite({
          type: 'exam_result',
          table: 'exam_sessions',
          action: 'insert',
          payload: sessionPayload,
          userId: profile.id
        });
      }
      
      // Save answers
      const answersToSave = Object.entries(answers).map(([qId, ans]) => ({
        user_id: profile.id,
        exam_session_id: sessionId,
        question_id: qId,
        selected_answer: ans,
        is_correct: questions.find(q => q.id === qId)?.correct_answer === ans,
        time_spent_seconds: 0
      }));

      if (answersToSave.length > 0) {
        try {
          const { error: ansError } = await supabase.from('session_answers').insert(answersToSave);
          if (ansError) throw ansError;
        } catch (ansErr) {
          console.warn('Saving session answers to offline queue:', ansErr);
          await enqueueOfflineWrite({
            type: 'session_answer',
            table: 'session_answers',
            action: 'insert',
            payload: answersToSave,
            userId: profile.id,
            silent: true
          });
        }
      }
      
      // Log study action
      try {
        await recordStudyAction(profile.id, 'exam');
      } catch (streakErr) {
        console.warn('Streak logging fallback:', streakErr);
      }

      // Gamification (if online)
      try {
        const { count } = await supabase.from('exam_sessions').select('id', { count: 'exact', head: true }).eq('user_id', profile.id);
        await checkAndAwardBadges(profile.id, {
          score: percentageScore,
          timeSpentSecs: timeSpentSeconds,
          totalTimeSecs: 7200,
          isFirstExam: count === 1
        });
      } catch (gamifyErr) {
        console.warn('Gamification badge check offline notice:', gamifyErr);
      }
    }
    
    // Clear interrupted exam session from localStorage and Dexie
    if (profile) {
      await clearInterruptedExamSession(profile.id);
    } else {
      await clearInterruptedExamSession();
    }
    sessionStorage.removeItem('cbt_backup');
    
    if (document.fullscreenElement) {
       document.exitFullscreen().catch(console.error);
    }
    
    navigate('/results', { state: { score, total: questions.length, mode: 'CBT Exam', questions, answers, timeSpentSeconds } });
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

  const handleNext = useCallback(() => {
    if (currentQuestionIdx < questions.length - 1) setCurrentQuestionIdx(c => c + 1);
  }, [currentQuestionIdx, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentQuestionIdx > 0) setCurrentQuestionIdx(c => c - 1);
  }, [currentQuestionIdx]);

  const toggleFlag = useCallback(() => {
    setFlagged(prev => ({ ...prev, [currentQuestionIdx]: !prev[currentQuestionIdx] }));
  }, [currentQuestionIdx]);

  // Keyboard Shortcuts (A, B, C, D, 1, 2, 3, 4, N, P, F, C, K, M, S, ?, H)
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
      <div className="flex flex-col h-screen bg-slate-100 items-center justify-center p-6 w-full">
        <div className="bg-white shadow-2xl rounded-none border-t-8 border-green-600 max-w-4xl w-full p-8">
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div className="flex gap-4 items-center">
              <div className="w-24 h-24 bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 font-bold text-xs uppercase text-center">
                Candidate<br/>Photo
              </div>
              <div>
                <h1 className="text-2xl font-bold uppercase text-green-800 mb-1">Joint Admissions and Matriculation Board</h1>
                <h2 className="text-xl font-bold text-slate-700">2026 UTME Examination</h2>
                <div className="mt-2 text-sm">
                  <p><strong>Candidate Name:</strong> {profile?.full_name?.toUpperCase()}</p>
                  <p><strong>Registration Number:</strong> {profile?.id.substring(0, 10).toUpperCase()}UT</p>
                  <p><strong>Seat Number:</strong> 042</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-green-600 rounded flex items-center justify-center text-white font-bold text-2xl ml-auto mb-2">
                SR
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 p-4 border border-slate-200 rounded">
              <h3 className="font-bold text-slate-800 mb-2 border-b pb-1">Registered UTME Subjects</h3>
              <ul className="list-disc pl-5 text-sm space-y-1 font-bold text-slate-700 mb-4">
                {examSubjectsList.map((s: string, i: number) => (
                  <li key={i}>{s.toUpperCase()} ({s === 'Use of English' ? '60 Qs' : '40 Qs'})</li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Choose Starting Subject First:
                </label>
                <select 
                  className="w-full bg-white border border-slate-300 rounded p-2 text-sm font-bold text-slate-800"
                  value={startingSubject}
                  onChange={(e) => setStartingSubject(e.target.value)}
                >
                  {examSubjectsList.map((subj, idx) => (
                    <option key={idx} value={subj}>
                      Start with {subj} First ({subj === 'Use of English' ? '60 Questions' : '40 Questions'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 border border-yellow-200 rounded text-sm text-yellow-900">
              <h3 className="font-bold mb-2 border-b border-yellow-200 pb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Important Instructions</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Do not click "Submit Exam" until you have answered all questions.</li>
                <li><strong>Subject Switcher:</strong> Use the subject tabs at the top of the exam screen to freely switch between registered subjects at any time during the test.</li>
                <li><strong>Laptop/PC Recommendation:</strong> For best exam experience, full split view, and quick desktop keyboard shortcuts (A, B, C, D, N, P), using a Laptop or Desktop computer is recommended.</li>
                <li>Use <kbd className="px-1 bg-white border border-slate-300 rounded">A</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">B</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">C</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">D</kbd> to select answers.</li>
                <li>Use <kbd className="px-1 bg-white border border-slate-300 rounded">N</kbd> for Next, <kbd className="px-1 bg-white border border-slate-300 rounded">P</kbd> for Previous.</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-center border-t border-slate-200 pt-6">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 text-xl rounded-none shadow-lg font-bold tracking-wide"
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
              START EXAM WITH {startingSubject.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentQuestionIdx];

  return (
    <div className="h-screen w-full bg-[#f4f7f6] text-slate-900 flex flex-col overflow-hidden select-none">
      
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
      <header className={`transition-all duration-300 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm flex-shrink-0 ${focusMode ? 'h-16 bg-slate-900 text-white border-slate-800' : 'h-20'}`}>
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-bold text-xl ${focusMode ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'}`}>
            {focusMode ? <Eye className="w-5 h-5" /> : 'SR'}
          </div>
          <div>
            <h1 className={`font-bold text-base md:text-lg leading-tight uppercase ${focusMode ? 'text-white' : 'text-slate-800'}`}>
              {focusMode ? 'Focus Mode Active • Unified Tertiary Matriculation Examination' : 'Unified Tertiary Matriculation Examination'}
            </h1>
            {!focusMode && (
              <p className="text-xs md:text-sm text-slate-500 font-medium">{profile?.full_name || 'Candidate'} • {profile?.id.substring(0,8).toUpperCase()}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* Focus Mode Toggle */}
          <Button 
            id="cbt-focus-mode-toggle-btn"
            variant="outline" 
            size="sm" 
            onClick={() => {
              const next = !focusMode;
              setFocusMode(next);
              if (next) {
                toast.info('Focus Mode Enabled: Minimized distraction view', { icon: '🎯' });
              } else {
                toast.info('Focus Mode Disabled');
              }
            }} 
            className={`h-9 px-3 text-xs border font-medium transition-all ${
              focusMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 shadow-md ring-2 ring-purple-400/50' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Toggle Focus Mode (Minimizes support widgets and distraction-free testing)"
          >
            {focusMode ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5 text-purple-600" />}
            <span>{focusMode ? 'Exit Focus' : 'Focus Mode'}</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const nextState = !soundEnabled;
              setSoundEnabled(nextState);
              if (nextState) {
                playFiveMinuteWarningSound();
                toast.success('Exam audio cues enabled (Test chime played)');
              } else {
                toast.info('Exam audio cues muted');
              }
            }} 
            className={`hidden sm:flex h-9 px-3 text-xs border ${soundEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
            title={soundEnabled ? 'Audio cues active (Click to mute)' : 'Audio cues muted (Click to enable)'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
            <span className="hidden md:inline">{soundEnabled ? 'Audio: On' : 'Audio: Muted'}</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowShortcutsModal(true)} 
            className="hidden lg:flex bg-slate-100 text-slate-700 border-slate-300 h-9 px-3 text-xs"
            title="View keyboard shortcuts (or press ?)"
          >
            <Keyboard className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            <span>Shortcuts (?)</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowCalculator(!showCalculator)} className="hidden md:flex bg-slate-100 text-slate-700 border-slate-300">
            <Calculator className="w-4 h-4 mr-2" /> Calculator
          </Button>

          <div className="flex flex-col items-end pl-2">
            {!focusMode && (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Time Left</span>
            )}
            <motion.div 
              animate={timeLeft <= 300 ? { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] } : {}}
              transition={timeLeft <= 300 ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
              className={`flex items-center gap-1.5 md:gap-2 text-xl md:text-3xl font-display font-bold px-2.5 py-1 rounded-lg ${
                timeLeft <= 300 
                  ? 'bg-red-500/10 text-red-600 border border-red-500/30' 
                  : focusMode ? 'bg-purple-950/80 text-purple-300 border border-purple-700' : getTimeColorClass()
              }`}
            >
              <Clock className="w-4 h-4 md:w-6 md:h-6" />
              <span className="font-mono tracking-tighter">{formatTime(timeLeft)}</span>
            </motion.div>
          </div>
        </div>
      </header>
      
      {showCalculator && (
        <div className="fixed top-24 right-10 z-50 animate-in slide-in-from-top-4">
          <JambCalculator onClose={() => setShowCalculator(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Side: Question Area */}
        <div className="flex-1 flex flex-col relative bg-white m-4 lg:mr-0 rounded-xl shadow-sm border border-slate-200 lg:min-h-0 min-h-[500px]">
          {/* Real JAMB Subject Switcher Tabs */}
          <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto rounded-t-xl hide-scrollbar">
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
                  className={`px-4 py-2 rounded text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 ${
                    isSelectedSubject
                      ? 'bg-green-600 text-white shadow-md border border-green-400'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{subjName}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelectedSubject ? 'bg-green-800 text-green-100' : 'bg-slate-800 text-slate-400'}`}>
                    {answeredSubjCount}/{subjectQs.length || (subjName === 'Use of English' ? 60 : 40)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-3">
               <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-bold text-sm">Question {currentQuestionIdx + 1} of {questions.length}</span>
               <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold uppercase">
                 {q?.subject_name || 'Subject'}
               </span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleFlag} className={flagged[currentQuestionIdx] ? "bg-red-50 text-red-600 border-red-200" : ""}>
              <Flag className={`w-4 h-4 mr-2 ${flagged[currentQuestionIdx] ? "fill-red-600" : ""}`} />
              {flagged[currentQuestionIdx] ? 'Flagged' : 'Flag for Review'}
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8">
            <div className="text-xl mb-10 leading-relaxed font-medium text-slate-800">
              <MathText text={q.question_text} />
            </div>
            
            <div className="grid grid-cols-1 gap-4 max-w-3xl">
              {q.options.map((opt: string, i: number) => {
                const isSelected = answers[q.id] === opt;
                const letter = String.fromCharCode(65 + i);
                
                return (
                  <motion.button 
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectAnswer(q.id, opt)}
                    className={`flex items-start text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-4 shrink-0 transition-colors ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-500'
                    }`}>
                      {letter}
                    </div>
                    <span className={`text-lg pt-1 ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                      <MathText text={opt} />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-between items-center">
            <Button variant="outline" onClick={handlePrev} disabled={currentQuestionIdx === 0} className="w-32">
              <ChevronLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            <Button onClick={handleNext} disabled={currentQuestionIdx === questions.length - 1} className="w-32 bg-blue-600 hover:bg-blue-700">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Right Side: Navigator */}
        <div className="w-full lg:w-80 bg-white m-4 lg:ml-4 lg:mr-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:max-h-full max-h-[400px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <h3 className="font-bold text-slate-800">Question Navigator</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
             <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isFlagged = flagged[idx];
                  const isCurrent = currentQuestionIdx === idx;
                  
                  let bgColor = "bg-white border-slate-200 text-slate-600";
                  if (isCurrent) bgColor = "bg-blue-600 border-blue-600 text-white shadow-md transform scale-110";
                  else if (isFlagged) bgColor = "bg-red-100 border-red-300 text-red-700";
                  else if (isAnswered) bgColor = "bg-green-100 border-green-300 text-green-800";

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`w-full aspect-square rounded border font-medium text-sm transition-all flex items-center justify-center ${bgColor} hover:opacity-80`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
             </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded" /> Answered</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded" /> Flagged</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-slate-200 rounded" /> Unanswered</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 border border-blue-600 rounded" /> Current</div>
            </div>
            <Button onClick={() => submitExam()} variant="destructive" className="w-full font-bold h-12 shadow-sm">
              SUBMIT EXAM
            </Button>
          </div>
        </div>

      </div>

      {/* CBT Shortcuts Cheat Sheet Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold">
                  <Keyboard className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">CBT Exam Keyboard Shortcuts</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowShortcutsModal(false)}>✕</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 my-5 text-sm">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Choose Option</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-green-700 shadow-sm">A / B / C / D</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Next Question</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-blue-700 shadow-sm">N / ➔</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Previous</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-blue-700 shadow-sm">P / ⬅</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Bookmark / Flag</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-amber-700 shadow-sm">F</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Calculator</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-slate-700 shadow-sm">K</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Audio Cues</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-emerald-700 shadow-sm">M</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">Submit Exam</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-red-600 shadow-sm">S</kbd>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-medium text-slate-700">This Guide</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-purple-700 shadow-sm">?</kbd>
              </div>
            </div>

            <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => setShowShortcutsModal(false)}>
              Got it, continue exam
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CBTExam;
