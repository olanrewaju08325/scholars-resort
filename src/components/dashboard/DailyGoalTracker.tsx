import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, CheckCircle2, Flame, Edit3, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { toast } from 'sonner';

export const DailyGoalTracker: React.FC = () => {
  const { profile } = useAuth();
  const [dailyTarget, setDailyTarget] = useState<number>(30);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempTarget, setTempTarget] = useState<string>('30');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasCelebrated, setHasCelebrated] = useState<boolean>(false);

  const todayKey = new Date().toISOString().split('T')[0];

  const loadGoalData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load saved daily target
      const savedTarget = localStorage.getItem(`scholars_daily_target_${profile?.id || 'guest'}`);
      if (savedTarget) {
        const parsed = parseInt(savedTarget, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setDailyTarget(parsed);
          setTempTarget(String(parsed));
        }
      }

      // 2. Compute completed questions today
      let todayCount = 0;
      const localCount = localStorage.getItem(`scholars_completed_today_${todayKey}_${profile?.id || 'guest'}`);
      if (localCount) {
        todayCount = parseInt(localCount, 10) || 0;
      }

      // Also query Supabase session answers if available
      if (profile?.id) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { count, error } = await supabase
          .from('session_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', startOfDay.toISOString());

        if (!error && count !== null && count > todayCount) {
          todayCount = count;
          localStorage.setItem(`scholars_completed_today_${todayKey}_${profile.id}`, String(todayCount));
        }
      }

      setCompletedCount(todayCount);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [profile?.id, todayKey]);

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  const handleSaveTarget = () => {
    const num = parseInt(tempTarget, 10);
    if (isNaN(num) || num < 5) {
      toast.error('Please enter a valid goal of at least 5 questions.');
      return;
    }
    setDailyTarget(num);
    localStorage.setItem(`scholars_daily_target_${profile?.id || 'guest'}`, String(num));
    setIsEditing(false);
    toast.success(`Daily goal updated to ${num} practice questions!`);
  };

  const handleQuickAdd = (increment: number) => {
    const newCount = Math.max(0, completedCount + increment);
    setCompletedCount(newCount);
    localStorage.setItem(`scholars_completed_today_${todayKey}_${profile?.id || 'guest'}`, String(newCount));
    
    if (newCount >= dailyTarget && !hasCelebrated && completedCount < dailyTarget) {
      triggerConfetti();
      playSuccessChime();
      setHasCelebrated(true);
      toast.success('🎉 Daily Practice Goal Achieved! Keep up the great streak!');
    }
  };

  const percentage = Math.min(100, Math.round((completedCount / (dailyTarget || 1)) * 100));
  const remaining = Math.max(0, dailyTarget - completedCount);
  const isCompleted = completedCount >= dailyTarget;

  if (loading) {
    return (
      <Card id="daily-goal-tracker-widget" className="bg-card text-card-foreground border-border shadow-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card id="daily-goal-tracker-widget" className="bg-card text-card-foreground border-border shadow-md">
      <CardHeader className="pb-3 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded-md border border-primary/20">
              <Target className="w-4 h-4" />
            </span>
            <CardTitle className="text-sm font-bold text-foreground tracking-tight">
              Daily Practice Goal
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Daily question target to maintain top-tier UTME exam speed and accuracy.
          </CardDescription>
        </div>

        <div>
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={tempTarget}
                onChange={(e) => setTempTarget(e.target.value)}
                className="w-16 h-7 text-xs bg-background border-input text-center font-bold"
                min="5"
                max="500"
              />
              <Button size="sm" onClick={handleSaveTarget} className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTempTarget(String(dailyTarget));
                setIsEditing(true);
              }}
              className="h-7 text-xs font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Target
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Progress Display */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-2xl font-extrabold text-foreground">{completedCount}</span>
              <span className="text-xs text-muted-foreground font-medium"> / {dailyTarget} questions</span>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isCompleted 
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                  : 'bg-primary/20 text-primary border border-primary/30'
              }`}>
                {percentage}% Completed
              </span>
            </div>
          </div>

          <div className="w-full bg-muted rounded-full h-3 p-0.5 border border-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted 
                  ? 'bg-emerald-500' 
                  : 'bg-primary'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Motivational Status / Remaining */}
        <div className="flex items-center justify-between text-xs pt-1">
          {isCompleted ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Goal crushed for today! Keep the momentum going!</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Flame className="w-4 h-4 text-amber-500" />
              <span><strong>{remaining}</strong> more questions to hit today's target</span>
            </div>
          )}

          {/* Quick simulation adjust buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleQuickAdd(5)}
              title="Add 5 questions practiced"
              className="px-2 py-1 bg-muted hover:bg-muted/80 text-[11px] font-bold text-foreground rounded border border-border transition-colors"
            >
              +5
            </button>
            <button
              onClick={() => handleQuickAdd(10)}
              title="Add 10 questions practiced"
              className="px-2 py-1 bg-muted hover:bg-muted/80 text-[11px] font-bold text-foreground rounded border border-border transition-colors"
            >
              +10
            </button>
          </div>
        </div>

        {/* Quick Goal Presets */}
        <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs text-muted-foreground">
          <span>Quick Presets:</span>
          <div className="flex gap-1.5">
            {[20, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setDailyTarget(preset);
                  setTempTarget(String(preset));
                  localStorage.setItem(`scholars_daily_target_${profile?.id || 'guest'}`, String(preset));
                  toast.success(`Daily goal set to ${preset} questions.`);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  dailyTarget === preset 
                    ? 'bg-primary text-primary-foreground font-bold border-primary' 
                    : 'bg-muted/50 border-border hover:bg-muted text-foreground'
                }`}
              >
                {preset} Qs
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
