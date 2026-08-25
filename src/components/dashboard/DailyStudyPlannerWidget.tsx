import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, Clock, Sun, Sunset, Moon, Sparkles, CheckCircle2, 
  Circle, Play, RefreshCw, AlertTriangle, ArrowRight, BrainCircuit, Check 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  generateDailyStudyPlan, 
  toggleTaskCompletion, 
  type DailyPlannerData, 
  type StudyTask 
} from '@/services/dailyStudyPlannerService';
import { toast } from 'sonner';

export const DailyStudyPlannerWidget: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plannerData, setPlannerData] = useState<DailyPlannerData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);

  const loadPlan = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await generateDailyStudyPlan(user.id);
      setPlannerData(data);
    } catch (err) {
      console.error('Failed to load study plan:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleRegenerate = async () => {
    if (!user?.id) return;
    setRegenerating(true);
    try {
      // Clear localStorage cache for today to force re-computation
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.removeItem(`daily_study_plan_${user.id}_${todayStr}`);
      const data = await generateDailyStudyPlan(user.id);
      setPlannerData(data);
      toast.success('Adaptive study schedule updated based on your latest practice data!');
    } catch (e) {
      toast.error('Failed to update schedule');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleTask = async (task: StudyTask) => {
    if (!user?.id || !plannerData) return;
    try {
      const updatedTasks = await toggleTaskCompletion(user.id, plannerData.date, task.id, plannerData.tasks);
      const completedCount = updatedTasks.filter(t => t.isCompleted).length;
      const completionPercentage = Math.round((completedCount / updatedTasks.length) * 100);

      setPlannerData({
        ...plannerData,
        tasks: updatedTasks,
        completionPercentage
      });

      if (!task.isCompleted) {
        toast.success(`Task completed: "${task.title}" (+50 XP)`);
      }
    } catch (err) {
      toast.error('Failed to update task state');
    }
  };

  const handleStartTaskDrill = (task: StudyTask) => {
    navigate('/practice', {
      state: {
        subjectName: task.subject,
        topicName: task.topic,
        learningStyle: 'Targeted Weakness Drill'
      }
    });
  };

  const getSlotIcon = (slot: string) => {
    switch (slot) {
      case 'morning': return <Sun className="w-4 h-4 text-amber-500" />;
      case 'midday': return <Sun className="w-4 h-4 text-orange-500" />;
      case 'afternoon': return <Sunset className="w-4 h-4 text-rose-500" />;
      case 'evening': return <Moon className="w-4 h-4 text-indigo-400" />;
      default: return <Clock className="w-4 h-4 text-primary" />;
    }
  };

  if (loading) {
    return (
      <Card className="border-border shadow-sm bg-card">
        <CardContent className="p-8 flex items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Analyzing past database performance & generating study schedule...</span>
        </CardContent>
      </Card>
    );
  }

  const tasks = plannerData?.tasks || [];
  const pct = plannerData?.completionPercentage || 0;

  return (
    <Card className="border-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold px-2 py-0.5">
                <BrainCircuit className="w-3 h-3 mr-1" /> Dynamic Study Planner
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">{plannerData?.formattedDate}</span>
            </div>
            <CardTitle className="text-lg font-bold font-display mt-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Today's Adaptive Schedule
            </CardTitle>
            <CardDescription className="text-xs">
              Generated dynamically from your past test accuracy & target UTME subjects
            </CardDescription>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate Schedule
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-muted-foreground">Daily Plan Progress</span>
            <span className="text-primary font-bold">{pct}% Completed</span>
          </div>
          <Progress value={pct} className="h-2 bg-muted/50" />
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {plannerData?.weakTopicsFound && plannerData.weakTopicsFound.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Performance Insight: </span>
              Your plan prioritizes lower-performing topics ({plannerData.weakTopicsFound.slice(0, 2).join(', ')}) based on your database records.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all ${
                task.isCompleted
                  ? 'bg-muted/20 border-border/50 opacity-70'
                  : task.priority === 'high'
                  ? 'bg-primary/5 border-primary/30 shadow-xs'
                  : 'bg-card border-border hover:border-border/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task)}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    title={task.isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/60 hover:text-primary" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                        {getSlotIcon(task.timeSlot)}
                        {task.slotLabel} ({task.slotTime})
                      </span>

                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold px-2 py-0.2 ${
                          task.priority === 'high'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : task.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {task.priorityLabel}
                      </Badge>

                      <span className="text-[10px] text-muted-foreground font-medium">
                        ⏱ {task.durationMinutes} mins
                      </span>
                    </div>

                    <h4 className={`text-sm font-bold ${task.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </h4>

                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {task.recommendationReason}
                    </p>
                  </div>
                </div>

                {!task.isCompleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartTaskDrill(task)}
                    className="h-8 text-xs font-semibold gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Play className="w-3 h-3 fill-primary" /> Practice <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
