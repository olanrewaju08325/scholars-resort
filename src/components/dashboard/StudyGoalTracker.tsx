import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Target, CalendarDays, Save, Clock, Zap, TrendingUp } from 'lucide-react';

export const StudyGoalTracker = () => {
  const { profile } = useAuth();
  const [goal, setGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form
  const [targetScore, setTargetScore] = useState(300);
  const [examDate, setExamDate] = useState('2027-04-19');
  const [dailyHours, setDailyHours] = useState(2);

  useEffect(() => {
    fetchGoal();
  }, [profile?.id]);

  const fetchGoal = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('study_goals')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    
    if (data) {
      setGoal(data);
      setTargetScore(data.target_score);
      setExamDate(data.exam_date || '2027-04-19');
      setDailyHours(data.daily_study_hours || 2);
    } else {
      setIsEditing(true); // prompt new user to set goals
    }
    setLoading(false);
  };

  const saveGoal = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('study_goals').upsert({
        user_id: profile.id,
        target_score: targetScore,
        exam_date: examDate,
        daily_study_hours: dailyHours,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Study goals saved!');
      setIsEditing(false);
      fetchGoal();
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
    setSaving(false);
  };

  const daysLeft = goal?.exam_date
    ? Math.max(0, Math.ceil((new Date(goal.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : Math.ceil((new Date('2027-04-19').getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const progressPercent = goal ? Math.min(100, Math.round(((profile?.xp || 0) / (goal.target_score * 10)) * 100)) : 0;

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center text-muted-foreground">Loading study goals...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row justify-between items-center">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-5 h-5 text-primary" /> My Study Goals
        </CardTitle>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3" /> Target JAMB Score
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="150" max="400" step="5"
                  value={targetScore}
                  onChange={(e) => setTargetScore(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="font-bold text-primary w-12 text-center">{targetScore}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Exam Date
              </label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="bg-background border-border h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Daily Study Hours: {dailyHours}h
              </label>
              <input
                type="range"
                min="1" max="12" step="0.5"
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {goal && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="flex-1 border-border hover:bg-muted">
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={saveGoal} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                <Save className="w-3 h-3 mr-1" /> {saving ? 'Saving...' : 'Save Goals'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-primary">{goal?.target_score}</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Target</div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-500">{daysLeft}</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Days Left</div>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-500">{goal?.daily_study_hours}h</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Per Day</div>
              </div>
            </div>

            {/* XP Progress Bar (proxy for readiness) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-500" /> XP Progress
                </span>
                <span className="text-xs font-bold text-primary">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-primary to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{profile?.xp || 0} XP earned</span>
                <span>Goal: {(goal?.target_score || 300) * 10} XP</span>
              </div>
            </div>

            {/* Motivational recommendation */}
            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg text-sm text-green-600 dark:text-green-400">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Study {goal?.daily_study_hours}h/day to be on track. Focus on your weakest subject first each session.</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
