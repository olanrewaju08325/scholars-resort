import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronRight, X, Bookmark, BookmarkPlus, Sparkles, MessageSquare, PauseCircle, PlayCircle, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { recordStudyAction } from '@/lib/streakService';
import { awardXp, checkAndAwardBadges } from '@/lib/gamification';
import { withRetry } from '@/lib/apiWithRetry';
import { toast } from 'sonner';
import { callGroqAPI } from '@/services/aiService';
import { getCustomQuestions } from '@/lib/offlineStore';
import { fetchQuestionsForSubject, checkSubjectDataIntegrity } from '@/utils/subjectUtils';

const PracticeSession = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAns, setSelectedAns] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  // Advanced Practice State
  const [isPaused, setIsPaused] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0); // per question
  const [totalTime, setTotalTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // For Time Management Mode
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // AI State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  // Load state from session storage if resuming
  useEffect(() => {
    if (!state?.subjectId && !state?.topicId && !state?.learningStyle) {
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
        setLoading(false);
        return;
      }

      // 1. Create Practice Session Record
      const { data: sessionData } = await supabase.from('practice_sessions').insert({
        user_id: profile?.id,
        subject_id: state.subjectId !== 'all' ? state.subjectId : null
      }).select().maybeSingle();
      
      if (sessionData) setSessionId(sessionData.id);

      // 2. Fetch Questions dynamically using canonical subject matching
      const count = state.questionCount || 20;
      let fetchedQuestions: any[] = [];

      if (state.subjectId && state.subjectId !== 'all') {
        // Server-side data integrity check & real-time fetch
        const expectedCount = state.expectedQCount || undefined;
        const integrity = await checkSubjectDataIntegrity(state.subjectId, expectedCount);
        console.log('[CBT Practice Server-Side Integrity Audit]', integrity);

        if (integrity.discrepancyDetected) {
          console.warn(`[CBT Data Integrity Discrepancy] Setup count (${expectedCount}) !== DB count (${integrity.availableCount}). Forcing real-time fetch from Supabase.`);
        }

        fetchedQuestions = integrity.questions && integrity.questions.length > 0 
          ? integrity.questions 
          : await fetchQuestionsForSubject(state.subjectId, Math.max(count * 3, 100));
      } else {
        const { data: qData } = await supabase.from('questions').select('*').eq('is_active', true).limit(Math.max(count * 3, 100));
        fetchedQuestions = qData || [];
      }

      let filteredQuestions = [...fetchedQuestions];

      if (state.topicId && state.topicId !== 'all') {
        const topicFiltered = filteredQuestions.filter(q => q.topic_id === state.topicId);
        if (topicFiltered.length > 0) {
          filteredQuestions = topicFiltered;
        } else {
          console.warn(`[CBT Data Integrity Fallback] Topic "${state.topicId}" returned 0 questions. Falling back to subject-wide question pool.`);
        }
      }

      if (state.difficulty && state.difficulty !== 'mixed' && state.difficulty !== 'adaptive') {
        const diffFiltered = filteredQuestions.filter(q => q.difficulty === state.difficulty);
        if (diffFiltered.length > 0) {
          filteredQuestions = diffFiltered;
        } else {
          console.warn(`[CBT Data Integrity Fallback] Difficulty level "${state.difficulty}" returned 0 questions for this subject. Falling back to mixed difficulty questions.`);
        }
      }
      
      const customQ = getCustomQuestions(state.subjectId !== 'all' ? state.subjectId : undefined);

      let allCombined = [...filteredQuestions, ...customQ];
      if (allCombined.length > 0) {
        const parsed = allCombined.map(q => ({
          ...q,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        }));
        setQuestions(parsed.sort(() => Math.random() - 0.5).slice(0, count));
      } else {
        setQuestions([]);
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
        totalTime
      }));
    }
  }, [currentIndex, score, isPaused, totalTime]);

  const handleTimeUp = () => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedAns(null); // Time's up, no selection
    triggerAIExplanation(null);
  };

  const handleSelect = async (option: string) => {
    if (isAnswered) return;
    setSelectedAns(option);
    setIsAnswered(true);

    const q = questions[currentIndex];
    const isCorrect = option === q.correct_answer;
    
    if (isCorrect) setScore(s => s + 1);

    // Save answer to DB
    if (sessionId) {
      try {
        await supabase.from('session_answers').insert({
          user_id: profile?.id,
          practice_session_id: sessionId,
          question_id: q.id,
          selected_answer: option,
          is_correct: isCorrect,
          time_spent_secs: timeSpent
        });
      } catch (ansErr) {
        console.warn('Notice: PracticeSession session_answers insert notice:', ansErr);
      }
    }

    // Automatically trigger AI explanation
    triggerAIExplanation(isCorrect);
  };

  const triggerAIExplanation = async (isCorrect: boolean | null) => {
    setIsGeneratingAi(true);
    try {
      const q = questions[currentIndex];
      const prompt = `The student just answered a JAMB question. Question: "${q.question}". Correct Answer: "${q.correct_answer}". Student's Answer: "${selectedAns}". Provide a brief, encouraging, and clear explanation of why the correct answer is right. Keep it under 3 sentences.`;
      
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setAiExplanation(content || `The correct answer is ${q.correct_answer}.`);
    } catch (err) {
      const q = questions[currentIndex];
      setAiExplanation(`AI Tutor (Fallback): The correct answer is **${q.correct_answer}**. ${q.explanation || ''}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAIAction = async (action: string) => {
    setIsGeneratingAi(true);
    try {
      const q = questions[currentIndex];
      let prompt = "";
      if (action === 'simpler') {
        prompt = `Explain the following JAMB question conceptually as if to a 10 year old: "${q.question}". Correct Answer: "${q.correct_answer}". Use an analogy.`;
      } else if (action === 'another') {
        prompt = `Provide a different perspective or rule of thumb to solve this JAMB question: "${q.question}". Correct Answer: "${q.correct_answer}".`;
      } else if (action === 'similar') {
        toast.success("Generating a practice problem...");
        prompt = `Generate a similar practice JAMB question based on: "${q.question}" with its answer and explanation.`;
      }
      
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setAiExplanation(content || 'Could not generate explanation.');
    } catch (err) {
      toast.error('AI request failed.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelectedAns(null);
      setIsAnswered(false);
      setAiExplanation(null);
      setTimeSpent(0);
      if (state?.isTimeManagementMode) setTimeRemaining(40);
    } else {
      // End of session
      sessionStorage.removeItem('practice_session_state');
      
      if (sessionId) {
        await supabase.from('practice_sessions').update({
          score,
          total_questions: questions.length,
          completed_at: new Date().toISOString()
        }).eq('id', sessionId);
        
        if (questions.length >= 5 || score > 0) { 
          await recordStudyAction(profile?.id || '', 'practice');
        }
      }
      
      const percentageScore = questions.length > 0 ? (score / questions.length) * 100 : 0;
      
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
  };

  const toggleBookmark = async () => {
    const q = questions[currentIndex];
    const isBookmarked = bookmarks[q.id];
    
    setBookmarks(prev => ({ ...prev, [q.id]: !isBookmarked }));
    
    if (!isBookmarked && profile) {
      await supabase.from('bookmarks').insert({
        user_id: profile.id,
        question_id: q.id,
        note: notes[q.id] || ''
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

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shadow-sm relative z-20">
        <div className="font-display font-bold md:text-lg flex items-center gap-2 md:gap-4">
          <span className="hidden md:inline">Practice Mode</span>
          <span className="text-primary font-bold text-xs md:text-sm bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wider">
            {state?.learningStyle || 'Standard'}
          </span>
          <span className="text-muted-foreground font-normal ml-2 text-sm">
            Q {currentIndex + 1} <span className="opacity-50">/ {questions.length}</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {state?.isTimeManagementMode && (
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm ${
               (timeRemaining || 0) <= 10 ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-muted border-border'
             }`}>
               <Clock className="w-4 h-4" /> 00:{timeRemaining?.toString().padStart(2, '0')}
             </div>
          )}
          
          <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <PlayCircle className="w-4 h-4 mr-2" /> : <PauseCircle className="w-4 h-4 mr-2" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} title="Exit Session" className="text-muted-foreground hover:text-red-500">
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

      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col relative z-10">
        <Card className="flex-1 mb-6 border-border shadow-sm bg-card transition-all duration-300">
          <CardContent className="p-6 md:p-10">
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Time Spent: {timeSpent}s</span>
              <Button variant="ghost" size="sm" onClick={toggleBookmark} className={bookmarks[q.id] ? "text-primary" : "text-muted-foreground"}>
                {bookmarks[q.id] ? <Bookmark className="w-5 h-5 fill-primary" /> : <BookmarkPlus className="w-5 h-5" />}
              </Button>
            </div>

            <p className="text-lg md:text-xl mb-10 leading-relaxed font-medium">
              {q.question_text}
            </p>
            
            <div className="space-y-4">
              {q.options.map((opt: string, i: number) => {
                let btnClass = "border-border hover:bg-muted";
                let Icon = null;
                
                if (isAnswered) {
                  if (opt === q.correct_answer) {
                    btnClass = "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400";
                    Icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                  } else if (opt === selectedAns) {
                    btnClass = "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400";
                    Icon = <XCircle className="w-5 h-5 text-red-500" />;
                  } else {
                    btnClass = "opacity-50 border-border";
                  }
                } else if (selectedAns === opt) {
                   btnClass = "border-primary bg-primary/5 text-primary";
                }

                return (
                  <Button 
                    key={i}
                    variant="outline"
                    className={`w-full justify-start h-auto min-h-[3.5rem] py-3 px-4 text-left whitespace-normal text-base font-normal transition-all ${btnClass}`}
                    onClick={() => handleSelect(opt)}
                    disabled={isAnswered || isPaused}
                  >
                    <span className="font-bold mr-4 w-6 text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1">{opt}</span>
                    {Icon}
                  </Button>
                );
              })}
            </div>

            {/* AI Explanation Area (Automatically shown on answer) */}
            {isAnswered && (
              <div className="mt-8 pt-8 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <h3 className="font-bold text-lg font-display">AI Explanation</h3>
                </div>
                
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 mb-4 text-muted-foreground leading-relaxed">
                  {isGeneratingAi ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                      <span className="animate-pulse">Llama 3 is thinking...</span>
                    </div>
                  ) : (
                    aiExplanation
                  )}
                </div>

                {!isGeneratingAi && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => handleAIAction('another')}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Explain another way
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => handleAIAction('simpler')}>
                      <MessageSquare className="w-3 h-3 mr-1" /> Simpler explanation
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => handleAIAction('similar')}>
                      <Sparkles className="w-3 h-3 mr-1" /> Generate similar question
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {isAnswered && (
          <div className="flex justify-end animate-in fade-in duration-300">
            <Button size="lg" className="shadow-premium px-8" onClick={handleNext}>
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Session'} 
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PracticeSession;
