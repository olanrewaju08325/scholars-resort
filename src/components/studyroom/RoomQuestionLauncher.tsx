import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, HelpCircle, Sparkles, Send, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface RoomQuestionLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onShareQuestion: (question: any) => void;
  roomSubject?: string;
}

export const RoomQuestionLauncher: React.FC<RoomQuestionLauncherProps> = ({
  isOpen,
  onClose,
  onShareQuestion,
  roomSubject = 'Physics'
}) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSampleQuestions = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('questions')
          .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, subjects(name)')
          .eq('is_active', true)
          .limit(6);

        if (data && data.length > 0) {
          const formatted = data.map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            subject_name: q.subjects?.name || roomSubject,
            options: {
              a: q.option_a,
              b: q.option_b,
              c: q.option_c,
              d: q.option_d
            },
            correct_answer: q.correct_answer
          }));
          setQuestions(formatted);
        } else {
          // Fallback sample questions
          setQuestions([
            {
              id: 'q_sample_1',
              subject_name: 'Physics',
              question_text: 'A bullet of mass 50g moving with a velocity of 500 m/s strikes a wooden block. Calculate the kinetic energy.',
              options: { a: '6250 Joules', b: '1250 Joules', c: '3125 Joules', d: '5000 Joules' },
              correct_answer: 'a'
            },
            {
              id: 'q_sample_2',
              subject_name: 'Mathematics',
              question_text: 'Find the derivative dy/dx of the curve y = 3x^3 - 5x^2 + 7x - 12 at x = 2.',
              options: { a: '23', b: '19', c: '27', d: '15' },
              correct_answer: 'a'
            },
            {
              id: 'q_sample_3',
              subject_name: 'Use of English',
              question_text: 'Choose the option nearest in meaning: The minister presented a MODEST proposal.',
              options: { a: 'Humble and reasonable', b: 'Extravagant', c: 'Aggressive', d: 'Complicated' },
              correct_answer: 'a'
            }
          ]);
        }
      } catch (_) {
        setQuestions([
          {
            id: 'q_fallback',
            subject_name: roomSubject,
            question_text: 'Sample UTME Problem: Solve for x in the equation 2x^2 - 8x + 6 = 0.',
            options: { a: 'x = 1 or x = 3', b: 'x = 2 or x = 4', c: 'x = 0 or x = 5', d: 'x = -1 or x = -3' },
            correct_answer: 'a'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSampleQuestions();
  }, [isOpen, roomSubject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-foreground">
              Share Question to Whiteboard
            </h3>
            <p className="text-xs text-muted-foreground">
              Select a UTME question below to render onto the shared whiteboard for step-by-step group solving.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading practice questions...</div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-border hover:border-purple-500/50 bg-background transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
                    {q.subject_name}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      onShareQuestion(q);
                      onClose();
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs h-7 px-3"
                  >
                    <Send className="w-3 h-3 mr-1" /> Post to Board
                  </Button>
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-2">
                  {q.question_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
