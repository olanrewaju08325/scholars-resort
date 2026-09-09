import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export const MistakeBankQuickCard: React.FC = () => {
  const navigate = useNavigate();
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jamb_mistake_bank');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMistakeCount(parsed.length);
        }
      }
    } catch {
      setMistakeCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card className="border border-border/80 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              mistakeCount > 0 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {mistakeCount > 0 ? (
                <RotateCcw className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                  <span>Correction Center (Mistake Bank)</span>
                </h3>
                {mistakeCount > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {mistakeCount} {mistakeCount === 1 ? 'Question' : 'Questions'} to Review
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All Clean
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                {mistakeCount > 0
                  ? `You have ${mistakeCount} questions saved from previous practice sessions. Reviewing your past mistakes is the fastest way to add 30-50 marks to your UTME aggregate.`
                  : 'Questions you answer incorrectly during mock exams automatically save here. Review them anytime to turn your weak areas into strengths.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto">
            {mistakeCount > 0 ? (
              <Button
                onClick={() => navigate('/practice?mode=mistakes')}
                className="w-full sm:w-auto h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Practice Missed Qs</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate('/cbt')}
                className="w-full sm:w-auto h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
              >
                <span>Take a CBT Mock</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
