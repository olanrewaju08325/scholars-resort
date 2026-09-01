import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Award, CheckCircle, RefreshCw, AlertTriangle, ArrowRight, BrainCircuit } from 'lucide-react';

interface MasteryLoopTrackerProps {
  userId: string;
}

export function MasteryLoopTracker({ userId }: MasteryLoopTrackerProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    learnCount: 0,
    practiceCount: 0,
    mistakeCount: 0,
    understandCount: 0,
    retestCount: 0,
    masteryRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMasteryLoopStats() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        // Query user's full practice answers
        const { data: answers, error } = await supabase
          .from('session_answers')
          .select('question_id, is_correct, created_at')
          .eq('user_id', userId);

        if (error) throw error;

        if (!answers || answers.length === 0) {
          setLoading(false);
          return;
        }

        // Group attempts by question_id chronologically
        const attemptsByQuestion: Record<string, any[]> = {};
        answers.forEach((ans: any) => {
          if (!ans.question_id) return;
          if (!attemptsByQuestion[ans.question_id]) {
            attemptsByQuestion[ans.question_id] = [];
          }
          attemptsByQuestion[ans.question_id].push(ans);
        });

        let retestSuccessCount = 0;
        let understandCount = 0;
        let totalUniqueTopicsSet = new Set<string>();

        // Count unique topics practiced to estimate "Learn" phase
        const qIds = Object.keys(attemptsByQuestion);
        if (qIds.length > 0) {
          const { data: qTopics } = await supabase
            .from('questions')
            .select('topic_id')
            .in('id', qIds.slice(0, 200));
          
          if (qTopics) {
            qTopics.forEach(q => {
              if (q.topic_id) totalUniqueTopicsSet.add(q.topic_id);
            });
          }
        }

        Object.values(attemptsByQuestion).forEach((attempts: any[]) => {
          attempts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (attempts.length > 1) {
            const firstAttempt = attempts[0];
            const hasCorrectLater = attempts.slice(1).some(a => a.is_correct);
            if (!firstAttempt.is_correct) {
              understandCount++; // Wrong attempt triggered explanation review
              if (hasCorrectLater) {
                retestSuccessCount++; // Retested & corrected successfully
              }
            }
          }
        });

        const activeMistakesCount = Object.values(attemptsByQuestion).filter((attempts: any[]) => {
          // Latest attempt was wrong
          attempts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return !attempts[0].is_correct;
        }).length;

        const totalPracticed = answers.length;
        const masteryRate = understandCount > 0 ? Math.round((retestSuccessCount / understandCount) * 100) : 0;

        setStats({
          learnCount: totalUniqueTopicsSet.size || Math.min(Math.ceil(totalPracticed / 8), 12),
          practiceCount: totalPracticed,
          mistakeCount: activeMistakesCount,
          understandCount: understandCount,
          retestCount: retestSuccessCount,
          masteryRate
        });
      } catch (err) {
        console.warn('[MasteryLoopTracker] Error computing loop stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMasteryLoopStats();
  }, [userId]);

  const steps = [
    {
      label: '1. Learn',
      desc: 'Study concepts',
      count: `${stats.learnCount} topics`,
      icon: BookOpen,
      color: 'text-blue-500 bg-blue-500/10'
    },
    {
      label: '2. Practice',
      desc: 'CBT Sessions',
      count: `${stats.practiceCount} solved`,
      icon: RefreshCw,
      color: 'text-purple-500 bg-purple-500/10'
    },
    {
      label: '3. Mistake',
      desc: 'Flag areas',
      count: `${stats.mistakeCount} active`,
      icon: AlertTriangle,
      color: 'text-red-500 bg-red-500/10'
    },
    {
      label: '4. Understand',
      desc: 'AI & Review',
      count: `${stats.understandCount} topics`,
      icon: BrainCircuit,
      color: 'text-amber-500 bg-amber-500/10'
    },
    {
      label: '5. Retest',
      desc: 'Correction rate',
      count: `${stats.masteryRate}% success`,
      icon: Award,
      color: 'text-green-500 bg-green-500/10'
    }
  ];

  if (loading) {
    return (
      <Card className="bg-card border-border shadow-sm p-6 text-center text-muted-foreground">
        Analyzing your learning loop progress...
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary animate-pulse" />
          <CardTitle className="text-lg font-display">My Adaptive Mastery Loop</CardTitle>
        </div>
        <CardDescription>
          Scholars Resort tracks your progress through the 5 essential phases of UTME retention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dynamic Connected Loop Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative">
          {steps.map((step, idx) => {
            const IconComponent = step.icon;
            return (
              <div key={idx} className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors relative group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.color} mb-3 shadow-sm`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">{step.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                  {step.count}
                </div>
                
                {/* Horizontal arrows on desktop */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/30">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action / Context Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 border border-border rounded-xl gap-4">
          <div className="space-y-1">
            <h5 className="font-bold text-sm flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Retest Accuracy: {stats.masteryRate}%
            </h5>
            <p className="text-xs text-muted-foreground max-w-lg">
              {stats.retestCount} previously missed questions have been successfully solved correctly during remedial practice drills! Keep retaking missed items.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => navigate('/weakness-drills')}>
              Practice Weak Areas
            </Button>
            <Button size="sm" onClick={() => navigate('/weakness-drills')}>
              Retest My Mistakes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
