import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, CheckCircle, XCircle, ChevronRight, Target, ShieldCheck, Flame, BookOpen, SkipForward, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MathText } from '@/components/MathText';
import { supabase } from '@/lib/supabase';
import { recordStudyAction } from '@/lib/streakService';
import { ContentNormalizer, type NormalizedQuestion } from '@/utils/ContentNormalizer';
import { toast } from 'sonner';

interface DailyFiveQuestionDrillProps {
  userId: string;
}

export const DailyFiveQuestionDrill: React.FC<DailyFiveQuestionDrillProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [userUTMESubjects, setUserUTMESubjects] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [alreadyCompletedToday, setAlreadyCompletedToday] = useState(false);

  useEffect(() => {
    const checkDailyStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastCompleted = localStorage.getItem(`last_daily_drill_date_${userId}`);
        
        if (lastCompleted === today) {
          setAlreadyCompletedToday(true);
          setLoading(false);
          return;
        }

        // 1. Fetch user's registered UTME subjects
        const { data: prof } = await supabase
          .from('profiles')
          .select('utme_subjects')
          .eq('id', userId)
          .maybeSingle();

        const selectedSubjects: string[] = Array.isArray(prof?.utme_subjects) && prof.utme_subjects.length > 0
          ? prof.utme_subjects
          : ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];

        setUserUTMESubjects(selectedSubjects);

        // 2. Resolve Subject IDs
        let targetSubjectIds: string[] = [];
        const subjectIdToName: Record<string, string> = {};
        try {
          const { data: subs } = await supabase
            .from('subjects')
            .select('id, name');
          
          if (subs && subs.length > 0) {
            subs.forEach((s: any) => {
              if (s.id && s.name) subjectIdToName[s.id] = s.name;
            });
            targetSubjectIds = subs
              .filter((s: any) => selectedSubjects.some(us => us.toLowerCase() === s.name.toLowerCase() || s.name.toLowerCase().includes(us.toLowerCase())))
              .map((s: any) => s.id);
          }
        } catch {}

        // Helper to validate questions
        const filterValidOptions = (rawList: any[]): NormalizedQuestion[] => {
          return ContentNormalizer.normalizeStream(rawList).map(q => {
            if (!q.subject_name && q.subject_id && subjectIdToName[q.subject_id]) {
              q.subject_name = subjectIdToName[q.subject_id];
            }
            return q;
          }).filter(q => {
            if (!q.question_text || q.question_text.trim().length < 5) return false;
            if (!Array.isArray(q.options) || q.options.length < 2) return false;
            const validOptions = q.options.filter(o => o.text && o.text.trim().length > 0);
            return validOptions.length >= 2;
          });
        };

        // 3. Query questions filtered strictly by selected subjects if IDs exist
        let candidateQuestions: any[] = [];
        if (targetSubjectIds.length > 0) {
          const { data: subjectQs } = await supabase
            .from('questions')
            .select('*, subjects(name)')
            .eq('is_active', true)
            .in('subject_id', targetSubjectIds)
            .limit(50);

          if (subjectQs) candidateQuestions.push(...subjectQs);
        }

        let validNormalized = filterValidOptions(candidateQuestions);

        // Fallback: fetch active questions generally if needed
        if (validNormalized.length < 5) {
          const { data: fallbackData } = await supabase
            .from('questions')
            .select('*, subjects(name)')
            .eq('is_active', true)
            .limit(40);

          if (fallbackData) {
            const extraValid = filterValidOptions(fallbackData);
            const existingIds = new Set(validNormalized.map(q => q.id));
            extraValid.forEach(eq => {
              if (!existingIds.has(eq.id)) {
                validNormalized.push(eq);
                existingIds.add(eq.id);
              }
            });
          }
        }

        if (validNormalized.length >= 2) {
          const shuffled = validNormalized.sort(() => 0.5 - Math.random()).slice(0, 5);
          setQuestions(shuffled);
        }
      } catch (err) {
        console.warn('Daily drill fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) checkDailyStatus();
  }, [userId]);

  const handleSelectAnswer = (qId: string, optId: string) => {
    setAnswers(prev => ({ ...prev, [qId]: optId }));
    
    // Auto-advance
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(c => c + 1);
      } else {
        finishDrill(optId, qId);
      }
    }, 350);
  };

  const handleSkipQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(c => c + 1);
    } else {
      finishDrill('', questions[currentIdx]?.id || '');
    }
  };

  const finishDrill = async (lastAns: string, lastQid: string) => {
    let currentScore = 0;
    const finalAnswers = { ...answers, [lastQid]: lastAns };
    
    questions.forEach(q => {
      const userSelected = finalAnswers[q.id];
      const correctOptionLetter = (q.correct_option || 'A').toUpperCase();
      
      if (userSelected === correctOptionLetter) {
        currentScore += 1;
      } else {
        const correctOptObj = q.options.find(o => o.id === correctOptionLetter);
        if (correctOptObj && userSelected === correctOptObj.text) {
          currentScore += 1;
        }
      }
    });
    
    setScore(currentScore);
    setIsCompleted(true);
    setAlreadyCompletedToday(true);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`last_daily_drill_date_${userId}`, today);
    
    const firstQSubject = questions[0]?.subject_name || userUTMESubjects[0] || 'UTME Core';
    try {
      await recordStudyAction(userId, 'practice', firstQSubject);
    } catch {}

    setTimeout(() => {
      toast.success(`Streak Protected! Earned +50 XP (${currentScore}/${questions.length} correct in ${firstQSubject})`);
      setIsOpen(false);
    }, 2800);
  };

  const currentQ = questions[currentIdx];
  const subjectLabel = currentQ?.subject_name || 'UTME Practice';

  return (
    <>
      {/* ========================================================================= */}
      {/* Integrated Dashboard Banner Card (Non-Intrusive & Beautiful)              */}
      {/* ========================================================================= */}
      <Card className="border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-card to-amber-500/5 shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 text-orange-500">
                <Flame className="w-5 h-5 fill-orange-500 text-orange-500" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                    <span>Today's 5-Question Streak Drill</span>
                  </h3>
                  {alreadyCompletedToday ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Streak Protected
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                      +50 XP Daily Bonus
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                  {alreadyCompletedToday
                    ? "Great job! You have protected your study streak for today. Come back tomorrow for 5 fresh questions."
                    : "Solve 5 quick questions in under 3 minutes to keep your daily study streak alive and boost your recall."}
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center w-full sm:w-auto">
              {alreadyCompletedToday ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentIdx(0);
                    setIsCompleted(false);
                    setAnswers({});
                    setIsOpen(true);
                  }}
                  className="w-full sm:w-auto h-8 text-xs font-semibold border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Practice Again</span>
                </Button>
              ) : (
                <Button
                  onClick={() => setIsOpen(true)}
                  disabled={loading || questions.length === 0}
                  className="w-full sm:w-auto h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{loading ? 'Preparing Drill...' : 'Start 5-Minute Drill'}</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* Interactive Modal Popup (Triggered intentionally by student)               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isOpen && questions.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-base sm:text-lg">
                  <Flame className="w-5 h-5 fill-white text-orange-200" />
                  <span>UTME Daily Streak Lock</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1 hover:bg-white/20 rounded-full transition-colors text-white"
                  title="Close for now"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                {!isCompleted ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                      <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{subjectLabel}</span>
                      </span>
                      <span className="bg-muted px-2.5 py-1 rounded-full">
                        Question {currentIdx + 1} of {questions.length}
                      </span>
                    </div>

                    {/* Question text */}
                    <div className="p-4 bg-muted/40 rounded-xl border border-border text-sm sm:text-base font-medium leading-relaxed">
                      <MathText text={currentQ.question_text} />
                    </div>

                    {/* Question Image if any */}
                    {currentQ.image_url && (
                      <div className="max-h-48 overflow-hidden rounded-xl border border-border flex justify-center bg-black/5">
                        <img 
                          src={currentQ.image_url} 
                          alt="Question diagram" 
                          className="object-contain max-h-48"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Verified UTME Multiple Choice Options */}
                    <div className="grid grid-cols-1 gap-2">
                      {currentQ.options && currentQ.options.length > 0 ? (
                        currentQ.options.map((opt) => {
                          const isSelected = answers[currentQ.id] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleSelectAnswer(currentQ.id, opt.id)}
                              className={`text-left p-3 rounded-xl border-2 transition-all flex items-start gap-2.5 ${
                                isSelected 
                                  ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold shadow-xs' 
                                  : 'border-border hover:border-orange-500/50 hover:bg-muted/70 text-foreground'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-md font-bold flex items-center justify-center shrink-0 text-xs ${
                                isSelected ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                              }`}>
                                {opt.id}
                              </span>
                              <div className="flex-1 pt-0.5 text-xs sm:text-sm">
                                <MathText text={opt.text} />
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground bg-muted/50 rounded-xl">
                          Options not available for this question.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <span>Answer all 5 to lock today's study streak</span>
                      <button 
                        onClick={handleSkipQuestion}
                        className="flex items-center gap-1 hover:text-foreground font-semibold transition-colors"
                      >
                        <SkipForward className="w-3.5 h-3.5" /> Skip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <div className="mx-auto w-14 h-14 bg-orange-500/15 border border-orange-500/30 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-7 h-7 text-orange-500" />
                    </div>
                    <h2 className="text-xl font-display font-bold text-foreground">Streak Protected!</h2>
                    <p className="text-muted-foreground text-xs leading-relaxed max-w-sm mx-auto">
                      You scored <span className="font-bold text-foreground">{score}/{questions.length}</span>. Your UTME study streak is securely locked in for today, and +50 XP has been added to your profile.
                    </p>
                    
                    <div className="pt-2">
                      <Button 
                        onClick={() => setIsOpen(false)} 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 rounded-xl text-xs"
                      >
                        Back to Dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
