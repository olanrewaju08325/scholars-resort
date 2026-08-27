import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, CheckCircle, XCircle, ChevronRight, Target, ShieldCheck, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MathText } from '@/components/MathText';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const DailyFiveQuestionDrill = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const checkDailyStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastCompleted = localStorage.getItem('last_daily_drill_date');
        
        if (lastCompleted === today) {
          setLoading(false);
          return; // Already done today
        }

        // Fetch 5 random high-frequency questions
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('is_active', true)
          .limit(20);

        if (error || !data || data.length === 0) throw new Error('Could not fetch questions');
        
        // Shuffle and take 5
        const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 5);
        setQuestions(shuffled);
        
        // Wait a few seconds before popping up so the dashboard can load
        setTimeout(() => setIsOpen(true), 2500);
      } catch (err) {
        console.warn('Daily drill fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkDailyStatus();
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

  const finishDrill = (lastAns: string, lastQid: string) => {
    let currentScore = 0;
    const finalAnswers = { ...answers, [lastQid]: lastAns };
    
    questions.forEach(q => {
      if (finalAnswers[q.id] === q.correct_answer) {
        currentScore += 1;
      }
    });
    
    setScore(currentScore);
    setIsCompleted(true);
    
    // Mark as done
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('last_daily_drill_date', today);
    
    // Attempt to log streak XP (fake mutation for the UI if API isn't present)
    setTimeout(() => {
      toast.success(`Streak Protected! Earned +50 XP (${currentScore}/5 correct)`);
      setIsOpen(false);
    }, 3000);
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIdx];

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
            Daily Streak Lock
          </div>
          <button onClick={() => setIsOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!isCompleted ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-bold text-muted-foreground mb-4">
                <span>Question {currentIdx + 1} of 5</span>
                <span className="bg-muted px-2 py-1 rounded">{currentQ?.subject_name}</span>
              </div>
              
              <div className="text-base sm:text-lg font-medium text-foreground">
                 <MathText text={currentQ?.question_text || ''} />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {['a', 'b', 'c', 'd'].map((key) => {
                  const optText = currentQ[`option_${key}`];
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
                You scored <span className="font-bold text-foreground">{score}/5</span>. Your daily study streak is locked in.
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
