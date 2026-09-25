import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  getDownloadedPacksAsync, 
  findOfflinePackForSubject,
  type OfflinePack,
  type CompletedOfflineSession
} from '@/lib/offlineStore';
import { offlineDb, saveExamSnapshot, getExamSnapshot, clearExamSnapshot } from '@/lib/offlineDb';
import { enqueueOfflineWrite } from '@/lib/syncQueue';
import { useAuth } from '@/context/AuthContext';
import { 
  WifiOff, Clock, ShieldCheck, ChevronLeft, ChevronRight, 
  Flag, CheckCircle2, RotateCcw, Award, AlertTriangle, 
  HelpCircle, Calculator, Maximize2, Minimize2, Eye, EyeOff,
  BookOpen, Play, Check, X, ArrowLeft, Zap, Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const OfflineCBTEngine: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const queryMode = searchParams.get('mode') || 'subject_drill';
  const querySubject = searchParams.get('subject') || searchParams.get('subjectId') || '';
  const queryYear = searchParams.get('year') || '';
  const queryCount = Number(searchParams.get('count')) || (queryMode === 'full_mock' ? 180 : 40);
  const queryTimerMinutes = Number(searchParams.get('timer')) || (queryMode === 'full_mock' ? 120 : 40);

  // Engine state
  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<Record<string, OfflinePack>>({});
  const [selectedPack, setSelectedPack] = useState<OfflinePack | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjectTabs, setSubjectTabs] = useState<Array<{ name: string; startIndex: number; count: number }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'unanswered' | 'flagged'>('all');
  const [filterMissingVisuals, setFilterMissingVisuals] = useState(true);

  // Timer & Session state
  const [timeLeft, setTimeLeft] = useState(queryTimerMinutes * 60);
  const [isExamCompleted, setIsExamCompleted] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<CompletedOfflineSession | null>(null);
  const [subjectBreakdownStats, setSubjectBreakdownStats] = useState<Record<string, { score: number; total: number }>>({});
  const [reviewMode, setReviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const examContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Load downloaded packs from IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const storedPacks = await getDownloadedPacksAsync();
        if (!isMounted) return;
        setPacks(storedPacks);

        const packList = Array.from(new Set(Object.values(storedPacks))).filter(p => (p.questionsCount || 0) > 0);
        if (packList.length === 0) {
          setLoading(false);
          return;
        }

        if (queryMode === 'full_mock') {
          // --- FULL 4-SUBJECT UTME MOCK COMBINATION ---
          const registeredNames = (profile?.utme_subjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry']);
          const combinedQuestions: any[] = [];
          const tabs: Array<{ name: string; startIndex: number; count: number }> = [];

          registeredNames.forEach((sName) => {
            const matched = findOfflinePackForSubject(sName, storedPacks);
            if (matched && matched.questions && matched.questions.length > 0) {
              let pool = matched.questions;
              if (filterMissingVisuals) {
                const valid = pool.filter((q: any) => {
                  const flags = q.quality_flags || [];
                  return !flags.includes('needs_diagram') && !flags.includes('missing_figure');
                });
                if (valid.length >= 10) pool = valid;
              }

              const isEnglish = matched.subjectName.toLowerCase().includes('english');
              const targetCount = isEnglish ? 60 : 40;
              const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, targetCount);
              const tagged = shuffled.map((q: any) => ({
                ...q,
                subject_name: matched.subjectName
              }));

              const startIndex = combinedQuestions.length;
              combinedQuestions.push(...tagged);
              tabs.push({
                name: matched.subjectName,
                startIndex,
                count: tagged.length
              });
            }
          });

          // Fallback if not all 4 were downloaded: use available packs
          if (combinedQuestions.length === 0 && packList.length > 0) {
            packList.slice(0, 4).forEach((matched) => {
              const tagged = (matched.questions || []).slice(0, 40).map((q: any) => ({
                ...q,
                subject_name: matched.subjectName
              }));
              const startIndex = combinedQuestions.length;
              combinedQuestions.push(...tagged);
              tabs.push({ name: matched.subjectName, startIndex, count: tagged.length });
            });
          }

          setQuestions(combinedQuestions);
          setSubjectTabs(tabs);
          setSelectedPack(packList[0]);
          setCurrentIndex(0);
          setAnswers({});
          setFlagged({});
          setTimeLeft(120 * 60); // 2 hours standard
        } else if (queryMode === 'past_questions') {
          // --- PAST QUESTIONS DRILL (FILTERED BY YEAR) ---
          let matched = querySubject ? findOfflinePackForSubject(querySubject, storedPacks) : null;
          if (!matched && packList.length > 0) matched = packList[0];

          if (matched) {
            setSelectedPack(matched);
            let pool = matched.questions || [];
            
            if (queryYear && queryYear !== 'all') {
              const yearFiltered = pool.filter((q: any) => String(q.year) === String(queryYear));
              if (yearFiltered.length > 0) pool = yearFiltered;
            }

            if (filterMissingVisuals) {
              const valid = pool.filter((q: any) => {
                const flags = q.quality_flags || [];
                return !flags.includes('needs_diagram') && !flags.includes('missing_figure');
              });
              if (valid.length >= 10) pool = valid;
            }

            const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, queryCount);
            setQuestions(shuffled);
            setSubjectTabs([]);
            setCurrentIndex(0);
            setAnswers({});
            setFlagged({});
            setTimeLeft(queryTimerMinutes * 60);
          }
        } else {
          // --- STANDARD SUBJECT DRILL ---
          let matched = querySubject ? findOfflinePackForSubject(querySubject, storedPacks) : null;
          if (!matched && packList.length > 0) matched = packList[0];

          if (matched) {
            setSelectedPack(matched);
            let pool = matched.questions || [];

            if (filterMissingVisuals) {
              const valid = pool.filter((q: any) => {
                const flags = q.quality_flags || [];
                return !flags.includes('needs_diagram') && !flags.includes('missing_figure');
              });
              if (valid.length >= 10) pool = valid;
            }

            const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, queryCount);
            setQuestions(shuffled);
            setSubjectTabs([]);
            setCurrentIndex(0);
            setAnswers({});
            setFlagged({});
            setTimeLeft(queryTimerMinutes * 60);
          }
        }
      } catch (err) {
        console.warn('[OfflineCBTEngine] Init error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [querySubject, queryCount, queryMode, queryYear]);

  // 2. High-reliability Timer with auto-submit
  useEffect(() => {
    if (loading || isExamCompleted || questions.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isExamCompleted, questions.length]);

  // 3. Auto-save snapshot to IndexedDB on every answer change for crash recovery
  useEffect(() => {
    if (isExamCompleted || questions.length === 0) return;

    saveExamSnapshot({
      id: `offline_exam_${selectedPack?.subjectId || 'default'}`,
      userId: profile?.id || 'offline_student',
      questions,
      answers,
      startedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      timeLeft
    });
  }, [answers, currentIndex, timeLeft, isExamCompleted]);

  // 4. Keyboard Navigation (A, B, C, D, N, P, F, S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if calculator input is active or exam completed
      if (showCalculator || isExamCompleted) return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        handleOptionSelect(key);
      } else if (key === 'N' || e.key === 'ArrowRight') {
        if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
      } else if (key === 'P' || e.key === 'ArrowLeft') {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
      } else if (key === 'F') {
        toggleFlagCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length, isExamCompleted, showCalculator]);

  // Option selection
  const handleOptionSelect = (optionLetterOrText: string) => {
    if (isExamCompleted) return;
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: optionLetterOrText
    }));
  };

  const toggleFlagCurrent = () => {
    setFlagged(prev => ({
      ...prev,
      [currentIndex]: !prev[currentIndex]
    }));
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      examContainerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Calculate score & submit exam
  const handleSubmitExam = async (isAutoSubmit = false) => {
    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    questions.forEach((q, idx) => {
      const studentAns = answers[idx];
      if (!studentAns) return;

      const correctAns = String(q.correct_answer || '').trim();
      const options = q.options || [];

      // Check letter match (A, B, C, D) or full text match
      let isCorrect = false;
      if (studentAns.length === 1 && ['A', 'B', 'C', 'D'].includes(studentAns.toUpperCase())) {
        const optionIdx = ['A', 'B', 'C', 'D'].indexOf(studentAns.toUpperCase());
        const matchedOptionText = options[optionIdx];
        if (matchedOptionText && matchedOptionText.trim().toLowerCase() === correctAns.toLowerCase()) {
          isCorrect = true;
        } else if (studentAns.toUpperCase() === correctAns.toUpperCase()) {
          isCorrect = true;
        }
      } else {
        if (studentAns.trim().toLowerCase() === correctAns.toLowerCase()) {
          isCorrect = true;
        }
      }

      if (isCorrect) correctCount++;
    });

    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const timeSpent = (queryTimerMinutes * 60) - timeLeft;

    const completedSession: CompletedOfflineSession = {
      id: `offline_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mode: 'CBT Exam',
      score: correctCount,
      totalQuestions,
      percentageScore: percentage,
      timeSpentSeconds: Math.max(1, timeSpent),
      completedAt: new Date().toISOString(),
      subjects: [selectedPack?.subjectName || 'General CBT'],
      userId: profile?.id || 'offline_candidate'
    };

    // Save to IndexedDB completed sessions
    try {
      await offlineDb.completedOfflineSessions.put(completedSession);
      await clearExamSnapshot(profile?.id || 'offline_student');

      // Queue for background sync if online connection returns
      await enqueueOfflineWrite({
        type: 'exam_result',
        table: 'exam_sessions',
        action: 'insert',
        payload: {
          user_id: profile?.id,
          mode: 'offline_cbt',
          score: correctCount,
          total_questions: totalQuestions,
          percentage_score: percentage,
          subject: selectedPack?.subjectName,
          completed_at: new Date().toISOString()
        }
      });
    } catch (saveErr) {
      console.warn('[OfflineCBTEngine] Save session error:', saveErr);
    }

    setCompletedSessionData(completedSession);
    setIsExamCompleted(true);
    setReviewMode(true);

    if (isAutoSubmit) {
      toast.info('Time expired! Your offline CBT exam has been graded.');
    } else {
      toast.success(`Exam completed! You scored ${correctCount}/${totalQuestions} (${percentage}%)`);
    }
  };

  // Calculator button handler
  const handleCalcClick = (val: string) => {
    if (val === 'C') {
      setCalcInput('');
    } else if (val === '=') {
      try {
        // Safe evaluation for basic math
        const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '');
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${sanitized})`)();
        setCalcInput(String(Number(result.toFixed(6))));
      } catch {
        setCalcInput('Error');
      }
    } else if (val === '√') {
      try {
        const num = parseFloat(calcInput);
        if (!isNaN(num) && num >= 0) {
          setCalcInput(String(Number(Math.sqrt(num).toFixed(6))));
        } else {
          setCalcInput('Error');
        }
      } catch {
        setCalcInput('Error');
      }
    } else {
      setCalcInput(prev => prev + val);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  const currentQ = questions[currentIndex];

  // Palette filtered items
  const filteredPaletteIndices = useMemo(() => {
    return questions.map((_, idx) => idx).filter(idx => {
      if (paletteFilter === 'answered') return answers[idx] !== undefined;
      if (paletteFilter === 'unanswered') return answers[idx] === undefined;
      if (paletteFilter === 'flagged') return Boolean(flagged[idx]);
      return true;
    });
  }, [questions, paletteFilter, answers, flagged]);

  // Format time
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // Font size classes
  const fontClasses = {
    normal: 'text-sm sm:text-base leading-relaxed',
    large: 'text-base sm:text-lg leading-relaxed',
    xlarge: 'text-lg sm:text-xl leading-relaxed font-medium'
  };

  // -------------------------------------------------------------
  // VIEW: NO OFFLINE PACKS AVAILABLE
  // -------------------------------------------------------------
  if (!loading && Object.keys(packs).length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
            <WifiOff className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display text-white">No Offline Question Packs</h2>
            <p className="text-sm text-slate-400 mt-2">
              The Standalone Offline CBT Engine runs 100% locally from your device memory without internet access.
            </p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl text-xs text-slate-300 text-left space-y-2 border border-slate-700/50">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Required Step:
            </div>
            <p>Connect to internet briefly and download your registered subjects from the Offline Pack Manager.</p>
          </div>
          <Button 
            onClick={() => navigate('/offline-pack-manager')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-12 text-base text-white shadow-lg"
          >
            Open Offline Pack Manager
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: LOADING
  // -------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400">Loading Offline CBT Simulation Center...</p>
      </div>
    );
  }

  return (
    <div 
      ref={examContainerRef}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none antialiased font-sans"
    >
      {/* ─────────────────────────────────────────────────────────────
          ENGINE HEADER: DISTINCTIVE JAMB SIMULATION TERMINAL
      ───────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sm:px-6 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Engine Branding & Subject Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                  JAMB CBT Offline Terminal
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  100% Offline
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-slate-200">{selectedPack?.subjectName}</span>
                <span>• Question {currentIndex + 1} of {questions.length}</span>
              </p>
            </div>
          </div>

          {/* Center: High-Visibility Timer */}
          {!isExamCompleted && (
            <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-2 font-mono font-black text-lg transition-all ${
              timeLeft < 300 
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse ring-2 ring-red-500/30' :
              timeLeft < 600
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                'bg-slate-800 text-slate-100 border-slate-700'
            }`}>
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}

          {/* Right: Quick Controls & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Font Resize Control */}
            <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFontSize('normal')}
                className={`px-2 py-1 rounded font-bold transition-colors ${fontSize === 'normal' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Normal Font Size"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded font-bold transition-colors ${fontSize === 'large' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Large Font Size"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-1 rounded font-bold transition-colors ${fontSize === 'xlarge' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Extra Large Font Size"
              >
                A++
              </button>
            </div>

            {/* JAMB Calculator Toggle */}
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                showCalculator 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle JAMB On-screen Calculator"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden md:inline">Calculator</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs hidden sm:flex items-center"
              title="Toggle Fullscreen Exam Room Mode"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Submit / Finish Button */}
            {!isExamCompleted ? (
              <Button
                onClick={() => {
                  if (unansweredCount > 0) {
                    if (window.confirm(`You still have ${unansweredCount} unanswered question(s). Are you sure you want to finish and submit your exam?`)) {
                      handleSubmitExam(false);
                    }
                  } else {
                    if (window.confirm('Ready to submit your offline CBT exam?')) {
                      handleSubmitExam(false);
                    }
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 px-4 gap-1.5 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Submit Exam</span>
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/offline-pack-manager')}
                variant="outline"
                className="text-xs h-9 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Exit Terminal
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN EXAM LAYOUT: TWO COLUMNS (QUESTION CANVAS + PALETTE)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE QUESTION CARD & CONTROLS (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Question Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6 relative overflow-hidden backdrop-blur">
            
            {/* Top Indicator Bar */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold text-xs tracking-wider border border-emerald-500/30">
                  Question {currentIndex + 1}
                </span>
                {currentQ?.year && (
                  <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    JAMB {currentQ.year}
                  </span>
                )}
                {answers[currentIndex] !== undefined && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Answered ({answers[currentIndex]})
                  </span>
                )}
              </div>

              {/* Flag / Review Button */}
              {!isExamCompleted && (
                <button
                  type="button"
                  onClick={toggleFlagCurrent}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                    flagged[currentIndex]
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  <Flag className={`w-3.5 h-3.5 ${flagged[currentIndex] ? 'fill-amber-400' : ''}`} />
                  <span>{flagged[currentIndex] ? 'Flagged for Review' : 'Flag Question'}</span>
                </button>
              )}
            </div>

            {/* Question Text */}
            <div className={`${fontClasses[fontSize]} text-slate-100 font-normal space-y-4`}>
              <p className="whitespace-pre-wrap">{currentQ?.question_text || 'Loading question...'}</p>

              {/* Embedded Diagram / Image if present */}
              {(currentQ?.image_url || currentQ?.diagram_image) && (
                <div className="my-4 p-2 bg-slate-950 border border-slate-800 rounded-xl inline-block max-w-full overflow-hidden">
                  <img 
                    src={currentQ.image_url || currentQ.diagram_image} 
                    alt="Question Diagram" 
                    className="max-h-72 object-contain rounded-lg mx-auto"
                  />
                  <span className="block text-center text-[10px] text-slate-400 mt-1">Figure / Diagram</span>
                </div>
              )}
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-2">
              {(currentQ?.options || []).map((optText: string, oIdx: number) => {
                const letter = ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
                const isSelected = answers[currentIndex] === letter || answers[currentIndex] === optText;
                
                // Review mode colors
                let reviewColor = '';
                if (reviewMode) {
                  const correctAns = String(currentQ.correct_answer || '').trim();
                  const isThisCorrect = optText.trim().toLowerCase() === correctAns.toLowerCase() || letter === correctAns.toUpperCase();
                  if (isThisCorrect) {
                    reviewColor = 'border-emerald-500 bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500/30';
                  } else if (isSelected && !isThisCorrect) {
                    reviewColor = 'border-red-500 bg-red-500/15 text-red-300 ring-2 ring-red-500/30';
                  }
                }

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={isExamCompleted}
                    onClick={() => handleOptionSelect(letter)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                      reviewColor ? reviewColor :
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-500/15 text-white ring-2 ring-emerald-500/30 shadow-md'
                        : 'border-slate-800 bg-slate-850/80 text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 border ${
                      isSelected 
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {letter}
                    </span>
                    <span className={`flex-1 ${fontClasses[fontSize]}`}>
                      {optText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* In Review Mode: Show Detailed Explanation */}
            {reviewMode && currentQ?.explanation && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" /> Explanation & Verification
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {currentQ.explanation}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  <strong>Correct Answer:</strong> {currentQ.correct_answer}
                </div>
              </div>
            )}

            {/* Bottom Nav: Previous & Next Controls */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous (P)</span>
              </Button>

              <div className="text-xs text-slate-400 font-bold hidden sm:block">
                Press A, B, C, D on keyboard or tap option
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 text-xs font-bold"
              >
                <span>Next (N)</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: QUESTION PALETTE, STATS & CALCULATOR (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Status Summary Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span>Exam Progress</span>
              <span>{answeredCount} / {questions.length} answered</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / (questions.length || 1)) * 100}%` }}
              />
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <div className="font-extrabold text-emerald-400 text-sm">{answeredCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Answered</div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <div className="font-extrabold text-slate-300 text-sm">{unansweredCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Unanswered</div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <div className="font-extrabold text-amber-400 text-sm">{flaggedCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Flagged</div>
              </div>
            </div>
          </div>

          {/* Interactive Question Palette */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                Question Palette
              </span>
              
              {/* Palette filter pills */}
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaletteFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${paletteFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter('unanswered')}
                  className={`px-2 py-0.5 rounded transition-colors ${paletteFilter === 'unanswered' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter('flagged')}
                  className={`px-2 py-0.5 rounded transition-colors ${paletteFilter === 'flagged' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Flagged
                </button>
              </div>
            </div>

            {/* Question numbers grid */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto p-1 custom-scrollbar">
              {filteredPaletteIndices.map(idx => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[idx] !== undefined;
                const isFlagged = Boolean(flagged[idx]);

                let btnClass = 'border-slate-800 bg-slate-800 text-slate-300 hover:border-slate-600';
                if (isCurrent) {
                  btnClass = 'border-emerald-400 bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-400/40';
                } else if (isFlagged) {
                  btnClass = 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold';
                } else if (isAnswered) {
                  btnClass = 'border-emerald-600/40 bg-emerald-600/20 text-emerald-400 font-bold';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl border text-xs font-bold transition-all flex items-center justify-center relative ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && !isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* JAMB Standard Scientific/Basic Calculator Popup */}
          {showCalculator && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" /> JAMB On-Screen Calculator
                </span>
                <button
                  type="button"
                  onClick={() => setShowCalculator(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Calculator Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-right font-mono text-lg font-bold text-white overflow-x-auto">
                {calcInput || '0'}
              </div>

              {/* Calculator Keypad */}
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                {['C', '(', ')', '√', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map(btn => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleCalcClick(btn)}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-colors ${
                      btn === '=' ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 col-span-1' :
                      btn === 'C' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30' :
                      ['/', '*', '-', '+', '√', '(', ')'].includes(btn) ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700' :
                      'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Exam Mode Guarantees */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" /> Guaranteed Zero Network Traffic
            </div>
            <p>
              This CBT session operates completely offline from your local browser sandbox. Results are saved securely to your device.
            </p>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          COMPLETION MODAL / SUMMARY DIALOG
      ───────────────────────────────────────────────────────────── */}
      {isExamCompleted && completedSessionData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center border shadow-xl ${
              completedSessionData.percentageScore >= 70
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-4 ring-emerald-500/20'
                : completedSessionData.percentageScore >= 50
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              <Award className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                Offline CBT Result
              </span>
              <h2 className="text-3xl font-black text-white mt-1">
                {completedSessionData.score} / {completedSessionData.totalQuestions}
              </h2>
              <div className="text-emerald-400 font-extrabold text-lg mt-0.5">
                {completedSessionData.percentageScore}% Overall Score
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl grid grid-cols-2 gap-3 text-left text-xs">
              <div>
                <span className="text-slate-400 block">Subject:</span>
                <strong className="text-white text-sm">{selectedPack?.subjectName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Time Taken:</span>
                <strong className="text-white text-sm">
                  {Math.round(completedSessionData.timeSpentSeconds / 60)} mins
                </strong>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={() => {
                  setReviewMode(true);
                  setIsExamCompleted(false); // Closes modal so student can review answers on screen
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
              >
                <Eye className="w-4 h-4 mr-1.5" /> Review Answers & Explanations
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (selectedPack) {
                    initQuestionsForPack(selectedPack, queryCount, filterMissingVisuals);
                  }
                }}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 font-bold h-11"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Retake New Random Set
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/offline-pack-manager')}
                className="w-full text-slate-400 hover:text-white text-xs"
              >
                Return to Offline Pack Manager
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
