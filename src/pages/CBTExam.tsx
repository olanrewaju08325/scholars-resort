import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Flag, Clock, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { JambCalculator } from '@/components/cbt/JambCalculator';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/hooks/useConfirm';
import { recordStudyAction } from '@/lib/streakService';
import { checkAndAwardBadges } from '@/lib/gamification';
import { saveExamSnapshot, clearExamSnapshot } from '@/lib/offlineDb';
import { toast } from 'sonner';
import { MathText } from '@/components/MathText';
import { playWarningBeep } from '@/lib/celebration';

const CBTExam = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { confirmAction, ConfirmElement } = useConfirm();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours (typical JAMB time)
  const [showCalculator, setShowCalculator] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(new Date().toISOString());
  const [warnings, setWarnings] = useState(0);
  const [isCompromised, setIsCompromised] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [showWarning, setShowWarning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initializeExam = async () => {
      if (!profile) return;
      
      try {
        const { getExamSnapshot } = await import('@/lib/offlineDb');
        const snapshot = await getExamSnapshot(profile.id);
        
        if (snapshot && snapshot.questions && snapshot.questions.length > 0) {
          const restore = window.confirm("We found an unfinished exam session from previously. Would you like to resume it?");
          if (restore) {
            setQuestions(snapshot.questions);
            setAnswers(snapshot.answers || {});
            setSessionStartedAt(snapshot.startedAt);
            setTimeLeft(snapshot.timeLeft);
            setLoading(false);
            return;
          } else {
            const { clearExamSnapshot } = await import('@/lib/offlineDb');
            await clearExamSnapshot(profile.id);
          }
        }
      } catch (e) {
        console.warn("Offline DB restore failed", e);
      }

      // JAMB 180-Question Master Logic
      // 1. Get subjects from profile, default if missing
      let subjects = profile.utme_subjects || [];
      if (!subjects || subjects.length < 4) {
        subjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
      }
      
      let allQuestions: any[] = [];
      
      // 2. Fetch English (60 questions)
      const { data: englishData } = await supabase
        .from('questions')
        .select('*, subjects!inner(name)')
        .eq('subjects.name', 'Use of English')
        .eq('is_active', true)
        .limit(60);
        
      if (englishData) allQuestions = [...allQuestions, ...englishData];
      
      // 3. Fetch 3 other subjects (40 each)
      const otherSubjects = subjects.filter((s: string) => s !== 'Use of English').slice(0, 3);
      
      for (const subject of otherSubjects) {
        const { data: subjectData } = await supabase
          .from('questions')
          .select('*, subjects!inner(name)')
          .eq('subjects.name', subject)
          .eq('is_active', true)
          .limit(40);
          
        if (subjectData) allQuestions = [...allQuestions, ...subjectData];
      }
      
      // Format options and shuffle slightly within blocks (in a real app we'd keep them ordered by subject)
      let parsed = allQuestions.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));
      
      // Shuffle questions to prevent pattern matching
      parsed = parsed.sort(() => Math.random() - 0.5);
      
      if (parsed.length < 10) { // arbitrary low limit to detect empty DB
        toast.error("Insufficient questions in the database to form a full exam. Please contact support.");
      }

      setQuestions(parsed);
      setLoading(false);
    };
    
    initializeExam();
  }, [profile]);

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
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasStarted, questions.length]);

  // Auto-save to Dexie every 60s (crash safety)
  useEffect(() => {
    if (!hasStarted || !profile) return;
    const interval = setInterval(async () => {
      await saveExamSnapshot({
        id: `session_${profile.id}`,
        userId: profile.id,
        questions,
        answers,
        startedAt: sessionStartedAt,
        savedAt: new Date().toISOString(),
        timeLeft
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [hasStarted, answers, timeLeft, questions, profile, sessionStartedAt]);


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

    // Save offline session to Dexie or directly to Supabase
    if (profile) {
      const sessionId = crypto.randomUUID();
      try {
        await supabase.from('exam_sessions').insert({
          id: sessionId,
          user_id: profile.id,
          status: compromised || isCompromised ? 'abandoned' : 'submitted',
          score,
          total_questions: questions.length,
          started_at: sessionStartedAt,
          submitted_at: new Date().toISOString()
        });
        
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
          await supabase.from('session_answers').insert(answersToSave);
        }
        
        // Log study action
        await recordStudyAction(profile.id, 'exam');

        // Gamification
        const { count } = await supabase.from('exam_sessions').select('id', { count: 'exact', head: true }).eq('user_id', profile.id);
        await checkAndAwardBadges(profile.id, {
            score: percentageScore,
            timeSpentSecs: timeSpentSeconds,
            totalTimeSecs: 7200,
            isFirstExam: count === 1
        });
      } catch (err) {
        console.error("Failed to sync exam session directly", err);
      }
    }
    
    // Clear offline snapshot
    if (profile) await clearExamSnapshot(profile.id);
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

  const toggleFlag = () => {
    setFlagged(prev => ({ ...prev, [currentQuestionIdx]: !prev[currentQuestionIdx] }));
  };

  // Keyboard Shortcuts (A, B, C, D, N, P, S)
  useEffect(() => {
    if (!hasStarted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const q = questions[currentQuestionIdx];
      
      if (!q) return;

      if (['A', 'B', 'C', 'D'].includes(key)) {
        const optionIndex = key.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
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
  }, [hasStarted, currentQuestionIdx, questions, handleSelectAnswer, handleNext, handlePrev]);

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
              <h3 className="font-bold text-slate-800 mb-2 border-b pb-1">Registered Subjects</h3>
              <ul className="list-disc pl-5 text-sm space-y-1 font-bold text-slate-700">
                {(profile?.utme_subjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry']).map((s: string, i: number) => (
                  <li key={i}>{s.toUpperCase()}</li>
                ))}
              </ul>
            </div>
            <div className="bg-yellow-50 p-4 border border-yellow-200 rounded text-sm text-yellow-900">
              <h3 className="font-bold mb-2 border-b border-yellow-200 pb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Important Instructions</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Do not click "Submit Exam" until you have answered all questions.</li>
                <li><strong>Laptop/PC Recommendation:</strong> For best exam experience, full split view, and quick desktop keyboard shortcuts (A, B, C, D, N, P), using a Laptop or Desktop computer is recommended.</li>
                <li>Use <kbd className="px-1 bg-white border border-slate-300 rounded">A</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">B</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">C</kbd> <kbd className="px-1 bg-white border border-slate-300 rounded">D</kbd> to select answers.</li>
                <li>Use <kbd className="px-1 bg-white border border-slate-300 rounded">N</kbd> for Next, <kbd className="px-1 bg-white border border-slate-300 rounded">P</kbd> for Previous.</li>
                <li>Any attempt to switch tabs or minimize the window will lead to automatic submission.</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-center border-t border-slate-200 pt-6">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 text-xl rounded-none shadow-lg"
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch((err) => console.log('Fullscreen denied:', err));
                }
                setHasStarted(true);
                setSessionStartedAt(new Date().toISOString());
              }}
            >
              START EXAM
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
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xl">
            SR
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight uppercase text-slate-800">Unified Tertiary Matriculation Examination</h1>
            <p className="text-sm text-slate-500 font-medium">{profile?.full_name || 'Candidate'} • {profile?.id.substring(0,8).toUpperCase()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <Button variant="outline" size="sm" onClick={() => setShowCalculator(!showCalculator)} className="hidden md:flex bg-slate-100 text-slate-700 border-slate-300">
            <Calculator className="w-4 h-4 mr-2" /> Calculator
          </Button>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time Remaining</span>
            <motion.div 
              animate={timeLeft <= 300 ? { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] } : {}}
              transition={timeLeft <= 300 ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
              className={`flex items-center gap-2 text-3xl font-display font-bold px-3 py-1 rounded-lg ${
                timeLeft <= 300 
                  ? 'bg-red-500/10 text-red-600 border border-red-500/30' 
                  : getTimeColorClass()
              }`}
            >
              <Clock className="w-6 h-6" />
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
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <div className="flex items-center gap-2">
               <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-bold text-sm">Question {currentQuestionIdx + 1}</span>
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
    </div>
  );
};

export default CBTExam;
