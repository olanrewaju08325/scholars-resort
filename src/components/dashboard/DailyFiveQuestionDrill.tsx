import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, CheckCircle, XCircle, ChevronRight, Target, ShieldCheck, Flame, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MathText } from '@/components/MathText';
import { supabase } from '@/lib/supabase';
import { recordStudyAction } from '@/lib/streakService';
import { toast } from 'sonner';

export const DailyFiveQuestionDrill = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
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
          return; // Already done today
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

        // 3. Query questions filtered strictly by selected subjects if IDs exist
        let qQuery = supabase.from('questions').select('*, subjects(name)').eq('is_active', true);
        if (targetSubjectIds.length > 0) {
          qQuery = qQuery.in('subject_id', targetSubjectIds);
        }

        const { data, error } = await qQuery.limit(30);

        if (error || !data || data.length === 0) {
          // Fallback: fetch active questions generally
          const { data: fallbackData } = await supabase.from('questions').select('*').eq('is_active', true).limit(15);
          if (fallbackData && fallbackData.length > 0) {
            const shuffled = fallbackData.sort(() => 0.5 - Math.random()).slice(0, 5);
            setQuestions(shuffled);
            setTimeout(() => setIsOpen(true), 2000);
          }
          return;
        }
        
        // Shuffle and take 5 questions strictly from selected subjects
        const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 5);
        setQuestions(shuffled);
        
        // Popup drill modal
        setTimeout(() => setIsOpen(true), 2000);
      } catch (err) {
        console.warn('Daily drill fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) checkDailyStatus();
  }, [userId]);

  const handleSelectAnswer = (qId: string, opt: string) => {
    setAnswers(prev => ({ ...prev, [qId]: opt }));
    
    // Auto-advance
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(c => c + 1);
      } else {
        finishDrill(opt, qId);
      }
    }, 400);
  };

  const finishDrill = async (lastAns: string, lastQid: string) => {
    let currentScore = 0;
    const finalAnswers = { ...answers, [lastQid]: lastAns };
    
    questions.forEach(q => {
      const correctVal = q.correct_option || q.correct_answer || q.answer;
      if (finalAnswers[q.id] === correctVal || finalAnswers[q.id] === q[`option_${String(correctVal).toLowerCase()}`]) {
        currentScore += 1;
      }
    });
    
    setScore(currentScore);
    setIsCompleted(true);
    
    // Mark as done for today
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`last_daily_drill_date_${userId}`, today);
    
    // Record context-aware study action & streak progression in Supabase
    const firstQSubject = questions[0]?.subjects?.name || userUTMESubjects[0] || 'UTME Core';
    await recordStudyAction(userId, 'practice', firstQSubject);

    setTimeout(() => {
      toast.success(`Streak Protected! Earned +50 XP (${currentScore}/5 correct in ${firstQSubject})`);
      setIsOpen(false);
    }, 2800);
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIdx];
  const subjectLabel = currentQ?.subjects?.name || currentQ?.subject_name || userUTMESubjects[0] || 'UTME';

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
          <button onClick={() => setIsOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!isCompleted ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-bold text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  Question {currentIdx + 1} of 5
                </span>
                <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                  {subjectLabel}
                </span>
              </div>
              
              <div className="text-base sm:text-lg font-medium text-foreground">
                 <MathText text={currentQ?.question_text || currentQ?.question || ''} />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {['a', 'b', 'c', 'd'].map((key) => {
                  const optText = currentQ[`option_${key}`] || currentQ?.options?.[key];
                  if (!optText) return null;
                  
                  const isSelected = answers[currentQ.id] === optText;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectAnswer(currentQ.id, optText)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600' 
                          : 'border-border hover:border-orange-500/50 hover:bg-muted'
                      }`}
                    >
                      <span className="font-bold uppercase mr-3 text-sm">{key}.</span>
                      <MathText text={optText} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Streak Protected!</h2>
              <p className="text-muted-foreground text-sm">
                You scored <span className="font-bold text-foreground">{score}/5</span>. Your UTME subject study streak is locked in.
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

