import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, X, Bookmark, BookmarkPlus, Sparkles, MessageSquare, PauseCircle, PlayCircle, Clock, RotateCcw, Grid3X3, Layers, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { recordStudyAction } from '@/lib/streakService';
import { awardXp, checkAndAwardBadges } from '@/lib/gamification';
import { withRetry } from '@/lib/apiWithRetry';
import { toast } from 'sonner';
import { callGroqAPI, stripThinkTags } from '@/services/aiService';
import { saveCompletedOfflineSession } from '@/lib/offlineStore';
import { fetchQuestionsForSubject, checkSubjectDataIntegrity } from '@/utils/subjectUtils';
import { cleanQuestionText, cleanOptionText, ContentNormalizer } from '@/utils/questionUtils';
import { QuestionFlowService, type ExamMode } from '@/services/questionFlowService';
import { CBTNavigationDrawer } from '@/components/cbt/CBTNavigationDrawer';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { CbtSnapshotService } from '@/services/cbtSnapshotService';
import { useFocusLock } from '@/hooks/useFocusLock';
import { FocusLockOverlay } from '@/components/FocusLockOverlay';

const PracticeSession = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [correctAnswersMap, setCorrectAnswersMap] = useState<Record<string, boolean>>({});
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
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // Advanced Practice State
  const [isPaused, setIsPaused] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0); // per question
  const [totalTime, setTotalTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // For Time Management Mode
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus Lock Anti-Cheat Hook
  const {
    isLocked,
    warnings: focusLockWarnings,
    isCompromised: isFocusLockCompromised,
    showWarningModal: showFocusLockModal,
    setShowWarningModal: setShowFocusLockModal,
    resetWarnings: resetFocusLockWarnings
  } = useFocusLock({
    enabled: true,
    maxWarnings: 3,
    onCompromised: () => {
      setIsPaused(true);
    }
  });

  // AI State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const currentQ = questions[currentIndex];
  const selectedAns = currentQ ? answersMap[currentQ.id] || null : null;
  const isAnswered = !!selectedAns;

  // Next & Prev Question Navigation
  const handleNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      setSwipeDirection('left');
      setCurrentIndex(c => c + 1);
      setAiExplanation(null);
      setTimeSpent(0);
      if (state?.isTimeManagementMode) setTimeRemaining(40);
    } else {
      // End of session
      sessionStorage.removeItem('practice_session_state');
      
      if (sessionId) {
        await supabase.from('exam_sessions').update({
          score,
          total_questions: questions.length,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }).eq('id', sessionId);
        
        if (questions.length >= 5 || score > 0) { 
          await recordStudyAction(profile?.id || '', 'practice');
        }
      }
      
      const percentageScore = questions.length > 0 ? (score / questions.length) * 100 : 0;
      
      saveCompletedOfflineSession({
        id: crypto.randomUUID(),
        mode: 'Practice Drill',
        score,
        totalQuestions: questions.length,
        percentageScore,
        timeSpentSeconds: totalTime,
        completedAt: new Date().toISOString(),
        subjects: state?.subjectName ? [state.subjectName] : [],
        userId: profile?.id
      });
      
      // Update Smart Mistake Bank
      const mistakesToSave = questions.filter(q => answersMap[q.id] && answersMap[q.id] !== q.correct_answer);
      try {
        let existing = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
        if (state?.mode === 'mistakes') {
          // Remove questions answered correctly this time
          const correctlyAnsweredIds = questions.filter(q => answersMap[q.id] === q.correct_answer).map(q => q.id);
          existing = existing.filter((q: any) => !correctlyAnsweredIds.includes(q.id));
        }
        if (mistakesToSave.length > 0) {
          const combined = [...existing, ...mistakesToSave];
          existing = Array.from(new Map(combined.map(item => [item.id, item])).values());
        }
        localStorage.setItem('jamb_mistake_bank', JSON.stringify(existing));
      } catch (e) {
        console.warn('Failed to update Mistake Bank:', e);
      }

      if (profile) {
        const practiceXp = 30 + Math.round((percentageScore / 100) * 40);
        await awardXp(profile.id, practiceXp, `Completed ${state?.learningStyle || 'Practice'} Session (${score}/${questions.length})`);

        await checkAndAwardBadges(profile.id, {
          score: percentageScore,
          timeSpentSecs: totalTime,
          totalTimeSecs: totalTime,
          isFirstExam: false 
        });
      }

      navigate('/results', { state: { score, total: questions.length, mode: state?.learningStyle || 'Practice' } });
    }
  }, [currentIndex, questions, sessionId, score, profile, totalTime, state, navigate]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSwipeDirection('right');
      setCurrentIndex(c => c - 1);
      setAiExplanation(null);
    }
  }, [currentIndex]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (currentIndex < questions.length - 1) {
        handleNext();
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        handlePrev();
      }
    }
  });

  // Load state from session storage if resuming
  useEffect(() => {
    if (!state?.subjectId && !state?.topicId && !state?.learningStyle && state?.mode !== 'mistakes') {
      navigate('/practice');
      return;
    }

    const initPractice = async () => {
      // Check for saved session in sessionStorage
      const savedSession = sessionStorage.getItem('practice_session_state');
      if (savedSession && state?.resume) {
        const parsed = JSON.parse(savedSession);
        setQuestions(parsed.questions);
        setCurrentIndex(parsed.currentIndex);
        setScore(parsed.score);
        setSessionId(parsed.sessionId);
        setTotalTime(parsed.totalTime);
        if (parsed.answersMap) setAnswersMap(parsed.answersMap);
        if (parsed.correctAnswersMap) setCorrectAnswersMap(parsed.correctAnswersMap);
        setLoading(false);
        return;
      }

      if (state.mode === 'mistakes') {
        const mistakes = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
        if (mistakes.length > 0) {
          setQuestions(mistakes);
        } else {
          toast.info("No missed questions to retake!");
          navigate('/practice');
        }
        setLoading(false);
        return;
      }

      // 1. Create Practice Session Record in exam_sessions
      const { data: sessionData } = await supabase.from('exam_sessions').insert({
        user_id: profile?.id,
        status: 'started',
        started_at: new Date().toISOString(),
        total_questions: state.questionCount || 20
      }).select().maybeSingle();
      
      if (sessionData) setSessionId(sessionData.id);

      // 2. Fetch Questions dynamically using QuestionFlowService directly from Supabase
      const count = state.questionCount || 20;
      let targetMode: ExamMode = 'subject_practice';
      if (state.mode === 'topic' || (state.topicId && state.topicId !== 'all')) {
        targetMode = 'topic_drill';
      } else if (state.mode === 'speed' || state.isTimeManagementMode) {
        targetMode = 'speed_test';
      } else if (state.mode === 'daily') {
        targetMode = 'daily_quiz';
      }

      const flowResult = await QuestionFlowService.fetchQuestionsForMode({
        mode: targetMode,
        subjectId: state.subjectId !== 'all' ? state.subjectId : undefined,
        topicId: state.topicId !== 'all' ? state.topicId : undefined,
        count,
        difficulty: state.difficulty,
        learningStyle: state.learningStyle,
        userId: profile?.id
      });

      console.log(`[CBT Question Flow Service] Mode: ${targetMode} | Retrieved: ${flowResult.totalRetrieved} | Latency: ${flowResult.queryLatencyMs}ms | Zero-Mock Enforced: ${flowResult.validation.noMockFallbackUsed}`);

      if (flowResult.questions && flowResult.questions.length > 0) {
        setQuestions(flowResult.questions);
      } else {
        setQuestions([]);
        toast.error(flowResult.errorMessage || "No active questions found in the database for this selection. Please select another subject or topic.");
      }
      setLoading(false);

      if (state.isTimeManagementMode) {
        setTimeRemaining(40); // 40 seconds per question
      }
    };

    initPractice();
  }, [state, profile, navigate]);

  // Timer Effect
  useEffect(() => {
    if (loading || isPaused || isAnswered || questions.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimeSpent(prev => prev + 1);
      setTotalTime(prev => prev + 1);
      
      if (state?.isTimeManagementMode && timeRemaining !== null) {
        setTimeRemaining(prev => {
          if (prev && prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev ? prev - 1 : 0;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isPaused, isAnswered, timeRemaining, state?.isTimeManagementMode]);

  // Save state on pause
  useEffect(() => {
    if (questions.length > 0 && !loading) {
      sessionStorage.setItem('practice_session_state', JSON.stringify({
        questions,
        currentIndex,
        score,
        sessionId,
        totalTime,
        answersMap,
        correctAnswersMap
      }));
    }
  }, [currentIndex, score, isPaused, totalTime, answersMap, correctAnswersMap]);

  const handleTimeUp = () => {
    if (!currentQ || answersMap[currentQ.id]) return;
    setAnswersMap(prev => ({ ...prev, [currentQ.id]: '__TIME_UP__' }));
    setCorrectAnswersMap(prev => ({ ...prev, [currentQ.id]: false }));
    triggerAIExplanation(false, '__TIME_UP__');
  };

  const handleSelect = async (option: string) => {
    if (!currentQ || answersMap[currentQ.id]) return;

    const isCorrect = option === currentQ.correct_answer;
    
    setAnswersMap(prev => ({ ...prev, [currentQ.id]: option }));
    setCorrectAnswersMap(prev => ({ ...prev, [currentQ.id]: isCorrect }));

    if (isCorrect) setScore(s => s + 1);

    // Save answer to DB
    if (sessionId) {
      try {
        await supabase.from('session_answers').insert({
          user_id: profile?.id,
          practice_session_id: sessionId,
          question_id: currentQ.id,
          selected_answer: option,
          is_correct: isCorrect,
          time_spent_secs: timeSpent
        });
      } catch (ansErr) {
        console.warn('Notice: PracticeSession session_answers insert notice:', ansErr);
      }
    }

    // Automatically trigger AI explanation
    triggerAIExplanation(isCorrect, option);
  };

  const triggerAIExplanation = async (isCorrect: boolean | null, optChosen: string) => {
    setIsGeneratingAi(true);
    try {
      const q = currentQ;
      const prompt = `The student just answered a JAMB question. Question: "${q.question_text || q.question}". Correct Answer: "${q.correct_answer}". Student's Answer: "${optChosen}". Provide a brief, encouraging, and clear explanation of why the correct answer is right. Keep it under 3 sentences.`;
      
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setAiExplanation(content || `The correct answer is ${q.correct_answer}.`);
    } catch (err) {
      const q = currentQ;
      setAiExplanation(`AI Tutor (Fallback): The correct answer is **${q.correct_answer}**. ${q.explanation || ''}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAIAction = async (action: string) => {
    setIsGeneratingAi(true);
    try {
      const q = currentQ;
      let prompt = "";
      if (action === 'simpler') {
        prompt = `Explain the following JAMB question conceptually as if to a 10 year old: "${q.question_text || q.question}". Correct Answer: "${q.correct_answer}". Use an analogy.`;
      } else if (action === 'another') {
        prompt = `Provide a different perspective or rule of thumb to solve this JAMB question: "${q.question_text || q.question}". Correct Answer: "${q.correct_answer}".`;
      } else if (action === 'similar') {
        toast.success("Generating a practice problem...");
        prompt = `Generate a similar practice JAMB question based on: "${q.question_text || q.question}" with its answer and explanation.`;
      }
      
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setAiExplanation(content || 'Could not generate explanation.');
    } catch (err) {
      toast.error('AI request failed.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const toggleBookmark = async () => {
    if (!currentQ) return;
    const isBookmarked = bookmarks[currentQ.id];
    
    setBookmarks(prev => ({ ...prev, [currentQ.id]: !isBookmarked }));
    
    if (!isBookmarked && profile) {
      await supabase.from('bookmarks').insert({
        user_id: profile.id,
        question_id: currentQ.id,
        note: notes[currentQ.id] || ''
      });
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-display text-xl animate-pulse">Initializing Session...</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4 font-display">No Questions Found</h2>
        <p className="text-muted-foreground mb-8 text-center max-w-md">We couldn't find active questions matching this exact criteria. Try adjusting your filters.</p>
        <Button onClick={() => navigate('/practice')}>Return to Practice Setup</Button>
      </div>
    );
  }

  const q = currentQ;
  const answeredCount = Object.keys(answersMap).length;
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const handleTakeSnapshot = async () => {
    setIsCapturingSnapshot(true);
    try {
      const snap = await CbtSnapshotService.captureSnapshot({
        examMode: (state?.mode as any) || 'subject',
        sessionTitle: `Practice: ${selectedSubject} (${selectedYear || 'All Years'})`,
        questions,
        answers: answersMap,
        currentQuestionIndex: currentIndex,
        timeLeftSeconds: timeRemaining || 3600,
        totalTimeSeconds: 3600,
        flaggedIndices: [],
        user: {
          id: profile?.id || 'anonymous_student',
          name: profile?.full_name || 'Student',
          email: profile?.email || 'student@scholarsresort.com'
        },
        subjectName: selectedSubject
      });
      toast.success(`Practice Snapshot #${snap.id} captured!`);
    } catch (err: any) {
      toast.error('Snapshot capture error: ' + err.message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      <FocusLockOverlay
        isOpen={showFocusLockModal}
        warnings={focusLockWarnings}
        maxWarnings={3}
        isCompromised={isFocusLockCompromised}
        onResume={() => {
          setShowFocusLockModal(false);
          if (isFocusLockCompromised) {
            navigate('/dashboard');
          }
        }}
      />
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-3 md:px-8 shadow-sm relative z-20 gap-2">
        <div className="font-display font-bold md:text-lg flex items-center gap-2 md:gap-3">
          <span className="hidden md:inline">Practice Mode</span>
          <span className="text-primary font-bold text-xs md:text-sm bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wider">
            {state?.learningStyle || 'Standard'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNavDrawer(true)}
            className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/10 flex items-center gap-1 border border-primary/20 rounded-lg"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Q{currentIndex + 1}/{questions.length}</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {state?.isTimeManagementMode && (
             <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-xs md:text-sm ${
               (timeRemaining || 0) <= 10 ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-muted border-border'
             }`}>
               <Clock className="w-3.5 h-3.5" /> 00:{timeRemaining?.toString().padStart(2, '0')}
             </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleTakeSnapshot}
            disabled={isCapturingSnapshot}
            className="h-9 text-xs font-semibold gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30"
            title="Take snapshot for diagnostics"
          >
            <Camera className={`w-3.5 h-3.5 ${isCapturingSnapshot ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Snapshot</span>
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => setShowNavDrawer(true)} className="hidden sm:flex h-9 text-xs font-semibold gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5 text-primary" /> Navigator
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)} className="h-9 text-xs">
            {isPaused ? <PlayCircle className="w-4 h-4 mr-1.5" /> : <PauseCircle className="w-4 h-4 mr-1.5" />}
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} title="Exit Session" className="text-muted-foreground hover:text-red-500 h-9 w-9">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {isPaused && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <PauseCircle className="w-20 h-20 text-primary mb-6 animate-pulse" />
          <h2 className="text-3xl font-display font-bold mb-2">Session Paused</h2>
          <p className="text-muted-foreground mb-8">Your progress is safely saved locally.</p>
          <Button size="lg" className="h-14 px-10 text-lg shadow-premium rounded-xl" onClick={() => setIsPaused(false)}>
            Resume Practice <PlayCircle className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      <main className="flex-1 p-3 md:p-8 max-w-4xl mx-auto w-full flex flex-col relative z-10">
        {/* Mobile Swipe Gesture Helper */}
        <div className="mb-2 px-3 py-1.5 bg-muted/30 rounded-xl border border-border/50 text-[11px] text-muted-foreground flex items-center justify-between sm:hidden select-none">
          <span className="flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Swipe ⟵ / ⟶ to switch questions
          </span>
          <button 
            onClick={() => setShowNavDrawer(true)}
            className="text-primary font-bold hover:underline flex items-center gap-0.5"
          >
            Grid ({answeredCount}/{questions.length}) <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <Card 
          {...swipeHandlers}
          className="flex-1 mb-4 md:mb-6 border-border shadow-sm bg-card transition-all duration-300 touch-pan-y"
        >
          <CardContent className="p-4 sm:p-6 md:p-10">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  Time: {timeSpent}s
                  <span className={`w-2 h-2 rounded-full inline-block transition-colors duration-300 ${
                    timeSpent < 30 ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' :
                    timeSpent < 45 ? 'bg-amber-500 shadow-sm shadow-amber-500/50' :
                    'bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse'
                  }`} title={timeSpent < 30 ? 'Pace: Perfect' : timeSpent < 45 ? 'Pace: Warning' : 'Pace: Take action!'} />
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowNavDrawer(true)}
                  className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/10 gap-1"
                >
                  <Grid3X3 className="w-3.5 h-3.5" /> Jump
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleBookmark} className={bookmarks[q.id] ? "text-primary h-8 w-8 p-0" : "text-muted-foreground h-8 w-8 p-0"}>
                  {bookmarks[q.id] ? <Bookmark className="w-5 h-5 fill-primary" /> : <BookmarkPlus className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: swipeDirection === 'left' ? 16 : swipeDirection === 'right' ? -16 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <p className="text-base sm:text-lg md:text-xl mb-8 leading-relaxed font-medium">
                {cleanQuestionText(q.question_text || q.question)}
              </p>
              
              <div className="space-y-3 md:space-y-4">
                {q.options.map((opt: string, i: number) => {
                  let btnClass = "border-border hover:bg-muted";
                  let Icon = null;
                  const isEliminated = (eliminatedOptions[q.id] || []).includes(opt);
                  
                  if (isAnswered) {
                    if (opt === q.correct_answer) {
                      btnClass = "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 font-semibold";
                      Icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                    } else if (opt === selectedAns) {
                      btnClass = "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 font-semibold";
                      Icon = <XCircle className="w-5 h-5 text-red-500" />;
                    } else {
                      btnClass = "opacity-50 border-border";
                    }
                  } else if (selectedAns === opt) {
                     btnClass = "border-primary bg-primary/5 text-primary";
                  } else if (isEliminated) {
                    btnClass = "border-dashed border-slate-700/40 opacity-40 bg-slate-100/5 dark:bg-slate-900/5";
                  }

                  return (
                    <div key={i} className="relative flex items-center w-full">
                      <Button 
                        variant="outline"
                        className={`w-full justify-start h-auto min-h-[3.25rem] py-3 pl-4 pr-20 text-left whitespace-normal text-sm sm:text-base font-normal transition-all rounded-xl ${btnClass}`}
                        onClick={() => !isEliminated && handleSelect(opt)}
                        disabled={isAnswered || isPaused}
                      >
                        <span className="font-bold mr-3 w-6 text-muted-foreground">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className={`flex-1 ${isEliminated ? 'line-through opacity-55' : ''}`}>{cleanOptionText(opt)}</span>
                        {Icon}
                      </Button>
                      
                      {!isAnswered && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEliminated(q.id, opt);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded border border-slate-700/30 bg-slate-900/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 text-[9px] font-mono tracking-wider font-bold transition-colors active:scale-95 z-10"
                          title={isEliminated ? "Restore option" : "Eliminate option"}
                        >
                          {isEliminated ? "RESTORE" : "CROSS OUT"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* AI Explanation Area (Automatically shown on answer) */}
              {isAnswered && (
                <div className="mt-8 pt-6 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <h3 className="font-bold text-base md:text-lg font-display">AI Tutor Explanation</h3>
                  </div>
                  
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 md:p-5 mb-4 text-muted-foreground leading-relaxed text-sm md:text-base">
                    {isGeneratingAi ? (
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <span className="animate-pulse text-xs">AI Tutor is generating tailored breakdown...</span>
                      </div>
                    ) : (
                      aiExplanation
                    )}
                  </div>

                  {!isGeneratingAi && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => handleAIAction('another')}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Explain another way
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => handleAIAction('simpler')}>
                        <MessageSquare className="w-3 h-3 mr-1" /> Simpler explanation
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => handleAIAction('similar')}>
                        <Sparkles className="w-3 h-3 mr-1" /> Generate similar question
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Practice Navigation Controls */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <Button 
            variant="outline" 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="h-11 px-4 text-xs sm:text-sm font-semibold"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setShowNavDrawer(true)}
            className="h-11 px-4 text-xs sm:text-sm font-bold text-primary border-primary/30 hover:bg-primary/10 gap-1.5"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">Question Grid</span>
            <span className="sm:hidden">Jump</span>
          </Button>

          <Button 
            size="lg" 
            className="h-11 px-5 text-xs sm:text-sm shadow-md font-bold" 
            onClick={handleNext}
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Session'} 
            <ChevronRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </main>

      {/* Persistent Accessible Navigation Drawer for Practice Mode */}
      <CBTNavigationDrawer
        isOpen={showNavDrawer}
        onClose={() => setShowNavDrawer(false)}
        questions={questions}
        currentIdx={currentIndex}
        onSelectQuestion={(idx) => {
          setCurrentIndex(idx);
          setAiExplanation(null);
        }}
        answers={answersMap}
        isPracticeMode={true}
        correctAnswersMap={correctAnswersMap}
      />
    </div>
  );
};

export default PracticeSession;
