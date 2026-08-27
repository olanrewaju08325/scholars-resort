import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Brain, AlertTriangle, CheckCircle, TrendingDown, RefreshCw } from 'lucide-react';
import { callGroqAPI } from '@/services/aiService';

export const BurnoutDetector = () => {
  const { profile } = useAuth();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyzeStudent = async () => {
    if (localStorage.getItem('scholars_live_exam_active') === 'true') {
      toast.error('AI analysis tools are locked during live proctored CBT exams.');
      return;
    }
    if (!profile?.id) return;
    setLoading(true);

    try {
      // Gather student data from Supabase
      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('score, submitted_at')
        .eq('user_id', profile.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(10);

      const { data: logs } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', profile.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const streak = profile.streak_days || 0;
      const recentExams = sessions?.length || 0;
      const recentActivity = logs?.length || 0;

      const userData = `
Student data:
- Current streak: ${streak} days
- Exams taken in last 10 sessions: ${recentExams}
- Activity logs last 7 days: ${recentActivity} events
- Recent scores: ${sessions?.map(s => s.score || 0).join(', ') || 'none'}
      `.trim();

      // Call AI via Groq API
      const prompt = `You are an educational psychologist analyzing a Nigerian student preparing for JAMB UTME.
Analyze this study activity data:
${userData}

Provide a short, empathetic assessment (max 3 sentences) specifying their burnout risk (Low Risk, Moderate Risk, or High Risk) and 1 practical recommendation (e.g. sleep, pomodoro breaks, hydration).`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);

      setAnalysis({
        content: content || 'Unable to analyse at this time.',
        timestamp: new Date()
      });
    } catch (err: any) {
      toast.error('AI analysis failed. Please try again.');
      console.error('Burnout analysis error:', err);
    }
    setLoading(false);
  };

  const getRiskBadge = (content: string) => {
    const lower = content?.toLowerCase() || '';
    if (lower.includes('high')) return { label: 'High Risk', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle };
    if (lower.includes('medium')) return { label: 'Moderate Risk', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: TrendingDown };
    return { label: 'Low Risk', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle };
  };

  const badge = analysis ? getRiskBadge(analysis.content) : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row justify-between items-center">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="w-5 h-5 text-purple-500" /> Burnout Detector
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={analyzeStudent}
          disabled={loading}
          className="h-8 text-xs border-border hover:bg-muted gap-1"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          {loading ? 'Analysing...' : 'Analyse'}
        </Button>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Click "Analyse" to check your wellness score.</p>
            <p className="text-xs mt-1 opacity-60">AI reviews your study patterns to detect burnout.</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-6 text-muted-foreground">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">Analysing your study patterns...</p>
          </div>
        )}

        {analysis && badge && (
          <div className="space-y-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${badge.color}`}>
              <badge.icon className="w-4 h-4 shrink-0" />
              <span className="font-bold text-sm">{badge.label}</span>
              <span className="text-xs opacity-70 ml-auto">{analysis.timestamp.toLocaleTimeString()}</span>
            </div>

            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {analysis.content}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
