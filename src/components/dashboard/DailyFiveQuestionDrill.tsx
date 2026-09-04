import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, CheckCircle, XCircle, ChevronRight, Target, ShieldCheck, Flame, BookOpen, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MathText } from '@/components/MathText';
import { supabase } from '@/lib/supabase';
import { recordStudyAction } from '@/lib/streakService';
import { ContentNormalizer, type NormalizedQuestion } from '@/utils/ContentNormalizer';
import { toast } from 'sonner';

export const DailyFiveQuestionDrill = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [userUTMESubjects, setUserUTMESubjects] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const checkDailyStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastCompleted = localStorage.getItem(`last_daily_drill_date_${userId}`);
        
        if (lastCompleted === today) {
          setLoading(false);
          return; // Already completed today
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

        // 2. Resolve Subject IDs for selected subjects
        let targetSubjectIds: string[] = [];
        try {
          const { data: subs } = await supabase
            .from('subjects')
            .select('id, name');
          
          if (subs && subs.length > 0) {
            targetSubjectIds = subs
              .filter((s: any) => selectedSubjects.some(us => us.toLowerCase() === s.name.toLowerCase() || s.name.toLowerCase().includes(us.toLowerCase())))
              .map((s: any) => s.id);
          }
        } catch {}

        // Helper to validate questions have at least 2 non-empty options
        const filterValidOptions = (rawList: any[]): NormalizedQuestion[] => {
          return ContentNormalizer.normalizeStream(rawList).filter(q => {
            if (!q.question_text || q.question_text.trim().length < 5) return false;
            if (!Array.isArray(q.options) || q.options.length < 2) return false;
            // Check that options have non-empty text
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
            // Merge deduplicating by ID
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
          setTimeout(() => setIsOpen(true), 1500);
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
      
      // Match either option ID ('A') or text
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
    
    // Mark as completed for today
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`last_daily_drill_date_${userId}`, today);
    
    // Record context-aware study action & streak progression in Supabase
    const firstQSubject = questions[0]?.subject_name || userUTMESubjects[0] || 'UTME Core';
    try {
      await recordStudyAction(userId, 'practice', firstQSubject);
    } catch {}

    setTimeout(() => {
      toast.success(`Streak Protected! Earned +50 XP (${currentScore}/${questions.length} correct in ${firstQSubject})`);
      setIsOpen(false);
    }, 2800);
  };

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIdx];
  const subjectLabel = currentQ?.subject_name || userUTMESubjects[0] || 'UTME';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <Flame className="w-5 h-5 fill-white text-orange-200" />
            UTME Daily Streak Lock
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            title="Close for now"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!isCompleted ? (
            <div className="space-y-5">
              <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                  {subjectLabel}
                </span>
              </div>
              
              <div className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                 <MathText text={currentQ?.question_text || ''} />
              </div>

              {currentQ.image_url && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/40 p-2 max-h-48 flex items-center justify-center">
                  <img 
                    src={currentQ.image_url} 
                    alt="Question Diagram" 
                    className="max-h-44 object-contain rounded" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Verified UTME Multiple Choice Options */}
              <div className="grid grid-cols-1 gap-2.5">
                {currentQ.options && currentQ.options.length > 0 ? (
                  currentQ.options.map((opt) => {
                    const isSelected = answers[currentQ.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectAnswer(currentQ.id, opt.id)}
                        className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                          isSelected 
                            ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-semibold shadow-sm' 
                            : 'border-border hover:border-orange-500/50 hover:bg-muted/70 text-foreground'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center shrink-0 text-sm ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.id}
                        </span>
                        <div className="flex-1 pt-0.5 text-sm sm:text-base">
                          <MathText text={opt.text} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-xl">
                    Options not available for this question.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span>Lock your streak by completing all 5 questions</span>
                <button 
                  onClick={handleSkipQuestion}
                  className="flex items-center gap-1 hover:text-foreground font-semibold transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Streak Protected!</h2>
              <p className="text-muted-foreground text-sm">
                You scored <span className="font-bold text-foreground">{score}/{questions.length}</span>. Your UTME study streak is securely locked in for today.
              </p>
              
              <div className="pt-4">
                <Button onClick={() => setIsOpen(false)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 rounded-xl">
                  Continue to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

