import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Sun, Sunset, Moon, CheckCircle2, Circle, Loader2, BrainCircuit, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { callGroqAPI } from '@/services/aiService';
import { toast } from 'sonner';

interface ScheduleTask {
  id: string;
  title: string;
  completed: boolean;
  subject?: string;
  topic?: string;
}

interface ScheduleSlot {
  timeOfday: string;
  iconName: 'sun' | 'sunset' | 'moon';
  color: string;
  bg: string;
  time: string;
  tasks: ScheduleTask[];
}

const SlotIcon = ({ name, className }: { name: string; className: string }) => {
  if (name === 'sun') return <Sun className={className} />;
  if (name === 'sunset') return <Sunset className={className} />;
  return <Moon className={className} />;
};

export const StudySchedule = () => {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const today = new Date().toISOString().split('T')[0];

  const fetchTodaySchedule = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Check for today's study plan tasks
      const { data: studyTasks } = await supabase
        .from('study_plan_tasks')
        .select('*, subjects(name), topics(name)')
        .eq('user_id', profile.id)
        .eq('date', today)
        .order('time_slot', { ascending: true });

      if (studyTasks && studyTasks.length > 0) {
        setTasks(studyTasks.map((t: any) => ({
          id: t.id,
          title: t.title || `${t.subjects?.name || 'Study'}: ${t.topics?.name || 'Session'}`,
          completed: t.is_completed || false,
          subject: t.subjects?.name,
          topic: t.topics?.name,
        })));

        buildScheduleFromTasks(studyTasks);
      } else {
        // No tasks for today - show empty state
        setSchedule([]);
      }
    } catch (e) {
      console.error(e);
      setSchedule([]);
    }
    setLoading(false);
  }, [profile?.id, today]);

  useEffect(() => {
    if (profile?.id) {
      fetchTodaySchedule();
    }
  }, [profile, fetchTodaySchedule]);

  const buildScheduleFromTasks = (rawTasks: any[]) => {
    const morning: ScheduleTask[] = [];
    const afternoon: ScheduleTask[] = [];
    const evening: ScheduleTask[] = [];

    rawTasks.forEach((t: any) => {
      const slot = t.time_slot || 'morning';
      const task: ScheduleTask = {
        id: t.id,
        title: t.title || `${t.subjects?.name}: ${t.topics?.name}`,
        completed: t.is_completed || false,
      };
      if (slot === 'morning') morning.push(task);
      else if (slot === 'afternoon') afternoon.push(task);
      else evening.push(task);
    });

    const slots: ScheduleSlot[] = [];
    if (morning.length > 0) slots.push({ timeOfday: 'Morning', iconName: 'sun', color: 'text-yellow-500', bg: 'bg-yellow-500/10', time: '08:00 AM – 10:00 AM', tasks: morning });
    if (afternoon.length > 0) slots.push({ timeOfday: 'Afternoon', iconName: 'sunset', color: 'text-orange-500', bg: 'bg-orange-500/10', time: '02:00 PM – 04:00 PM', tasks: afternoon });
    if (evening.length > 0) slots.push({ timeOfday: 'Evening', iconName: 'moon', color: 'text-indigo-500', bg: 'bg-indigo-500/10', time: '08:00 PM – 09:30 PM', tasks: evening });

    setSchedule(slots);
  };

  const toggleTask = async (taskId: string, currentState: boolean) => {
    try {
      await supabase.from('study_plan_tasks').update({ is_completed: !currentState }).eq('id', taskId);
      setSchedule(prev => prev.map(slot => ({
        ...slot,
        tasks: slot.tasks.map(t => t.id === taskId ? { ...t, completed: !currentState } : t)
      })));
    } catch (e) {
      toast.error('Failed to update task.');
    }
  };

  const generateAISchedule = async () => {
    if (!profile?.id) return;
    setGenerating(true);

    try {
      // Get weak subjects from past exam data
      const { data: answers } = await supabase
        .from('session_answers')
        .select('is_correct, questions!question_id(subjects!subject_id(name))')
        .eq('user_id', profile.id)
        .limit(100);

      const subjectScores: Record<string, { correct: number; total: number }> = {};
      (answers || []).forEach((a: any) => {
        const name = a.questions?.subjects?.name;
        if (!name) return;
        if (!subjectScores[name]) subjectScores[name] = { correct: 0, total: 0 };
        subjectScores[name].total++;
        if (a.is_correct) subjectScores[name].correct++;
      });

      const weakSubjects = Object.entries(subjectScores)
        .map(([name, s]) => ({ name, rate: s.total > 0 ? s.correct / s.total : 1 }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 3)
        .map(s => s.name);

      const prompt = `Create a JSON daily study schedule for a Nigerian JAMB student.
Weak subjects: ${weakSubjects.join(', ') || 'Mathematics, Physics, Chemistry, Use of English'}.
Return ONLY valid JSON with this structure:
{
  "morning": [{"title": "Physics: Motion & Kinematics", "subject": "Physics"}],
  "afternoon": [{"title": "Mathematics: Quadratic Equations & Algebra", "subject": "Mathematics"}],
  "evening": [{"title": "Chemistry: Periodic Table & Bonding", "subject": "Chemistry"}]
}
Include 2 tasks per slot. Titles must be specific (subject + topic).`;

      const responseText = await callGroqAPI([{ role: 'user', content: prompt }]);

      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart === -1) throw new Error('No JSON found in response');

      const parsed = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));

      // Delete today's existing tasks and insert new ones
      await supabase.from('study_plan_tasks').delete().eq('user_id', profile.id).eq('date', today);

      const toInsert: any[] = [];
      ['morning', 'afternoon', 'evening'].forEach(slot => {
        (parsed[slot] || []).forEach((t: any) => {
          toInsert.push({ user_id: profile!.id, date: today, time_slot: slot, title: t.title, is_completed: false });
        });
      });

      if (toInsert.length > 0) {
        await supabase.from('study_plan_tasks').insert(toInsert);
      }

      toast.success('AI study schedule generated successfully!');
      fetchTodaySchedule();
    } catch (err: any) {
      toast.error(`Failed to generate schedule: ${err.message}`);
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
          <span className="text-muted-foreground">Loading today's schedule...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm h-full">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Today's Schedule
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs"
          onClick={generateAISchedule}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {schedule.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-6">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">No tasks scheduled for today.</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Let AI build you a personalized plan.</p>
            <Button size="sm" onClick={generateAISchedule} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              Generate Today's Plan
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {schedule.map((slot, i) => (
              <div key={i} className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${slot.bg} flex items-center justify-center`}>
                    <SlotIcon name={slot.iconName} className={`w-5 h-5 ${slot.color}`} />
                  </div>
                  <div>
                    <h4 className="font-bold">{slot.timeOfday}</h4>
                    <p className="text-xs text-muted-foreground font-semibold">{slot.time}</p>
                  </div>
                </div>
                
                <ul className="space-y-3 pl-2">
                  {slot.tasks.map(task => (
                    <li key={task.id} className="flex items-start gap-3">
                      <button
                        className="mt-0.5 shrink-0 focus:outline-none"
                        onClick={() => toggleTask(task.id, task.completed)}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>
                      <span className={`text-sm font-medium ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
