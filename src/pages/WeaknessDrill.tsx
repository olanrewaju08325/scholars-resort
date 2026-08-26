import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, AlertTriangle, Clock, History, BrainCircuit, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadPerformanceSummaryPdf } from '@/lib/performanceSummaryPdf';

const WeaknessDrill = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportWeakTopicsPdf = async () => {
    setIsExporting(true);
    try {
      await downloadPerformanceSummaryPdf({
        studentName: profile?.full_name || 'Scholar Candidate',
        email: profile?.email || '',
        targetScore: profile?.target_score || 300,
        weakTopics: weakTopics.map(w => ({
          name: w.name,
          subjectName: w.subjects?.name || 'General',
          accuracy: w.accuracy,
          attempts: 10
        }))
      });
      toast.success('Weak Topics & Performance Summary PDF downloaded!');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to generate summary PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const fetchWeaknesses = async () => {
      if (!profile?.id) { setLoading(false); return; }
      try {
        const { data: answers } = await supabase
          .from('session_answers')
          .select('question_id, is_correct')
          .eq('user_id', profile.id)
          .limit(500);

        if (!answers || answers.length === 0) {
          setWeakTopics([]);
          setLoading(false);
          return;
        }

        const qIds = Array.from(new Set(answers.map((a: any) => a.question_id).filter(Boolean)));
        let qMap: Record<string, { topic_id: string; subject_id: string }> = {};

        if (qIds.length > 0) {
          const { data: questions } = await supabase
            .from('questions')
            .select('id, topic_id, subject_id')
            .in('id', qIds.slice(0, 200));

          (questions || []).forEach((q: any) => {
            qMap[q.id] = { topic_id: q.topic_id, subject_id: q.subject_id };
          });
        }

        const topicIds = Array.from(new Set(Object.values(qMap).map(q => q.topic_id).filter(Boolean)));
        const subjectIds = Array.from(new Set(Object.values(qMap).map(q => q.subject_id).filter(Boolean)));

        let topicNameMap: Record<string, string> = {};
        if (topicIds.length > 0) {
          const { data: topics } = await supabase.from('topics').select('id, name').in('id', topicIds);
          (topics || []).forEach((t: any) => { topicNameMap[t.id] = t.name; });
        }

        let subjectNameMap: Record<string, string> = {};
        if (subjectIds.length > 0) {
          const { data: subjects } = await supabase.from('subjects').select('id, name').in('id', subjectIds);
          (subjects || []).forEach((s: any) => { subjectNameMap[s.id] = s.name; });
        }

        const topicScores: Record<string, { correct: number; total: number; topicName: string; subjectId: string; subjectName: string }> = {};

        answers.forEach((a: any) => {
          const q = qMap[a.question_id];
          if (!q?.topic_id || !topicNameMap[q.topic_id]) return;
          const key = q.topic_id;
          if (!topicScores[key]) {
            topicScores[key] = { 
              correct: 0, 
              total: 0, 
              topicName: topicNameMap[q.topic_id], 
              subjectId: q.subject_id || '', 
              subjectName: subjectNameMap[q.subject_id] || 'General Studies' 
            };
          }
          topicScores[key].total++;
          if (a.is_correct) topicScores[key].correct++;
        });

        const weak = Object.entries(topicScores)
          .filter(([, v]) => v.total >= 3)
          .map(([id, v]) => ({ id, name: v.topicName, subject_id: v.subjectId, subjects: { name: v.subjectName }, accuracy: Math.round((v.correct / v.total) * 100) }))
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 6);

        setWeakTopics(weak.length > 0 ? weak : []);
      } catch (e) {
        console.error('[WeaknessDrill] Error loading weakness data:', e);
      }
      setLoading(false);
    };

    fetchWeaknesses();
  }, [profile]);

  const handleStartDrill = (topicId: string, subjectId: string, mode: 'weakness' | 'mistakes' | 'time' = 'weakness') => {
    if (!profile?.has_paid) {
      toast.error("Advanced drills require an active premium subscription.");
      navigate('/pricing');
      return;
    }
    
    navigate('/practice/session', { 
      state: { 
        subjectId: subjectId, 
        topicId: topicId,
        difficulty: 'adaptive',
        questionCount: 15,
        learningStyle: mode,
        isTimeManagementMode: mode === 'time',
        isMistakeReview: mode === 'mistakes'
      } 
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pt-10 px-4 md:px-10 pb-20">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Targeted Drills</h1>
              <p className="text-muted-foreground">Focus your practice to rapidly increase your score.</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleExportWeakTopicsPdf}
            disabled={isExporting}
            className="flex items-center gap-2 border-primary/30 hover:bg-primary/10 text-primary self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Generating PDF...' : 'Download Weak Topics PDF'}
          </Button>
        </div>

        <Tabs defaultValue="weakness" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-12 bg-muted/50">
            <TabsTrigger value="weakness" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Topic Weaknesses</TabsTrigger>
            <TabsTrigger value="mistakes" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Mistake Review</TabsTrigger>
            <TabsTrigger value="time" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Time Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="weakness">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-xl font-display">Low Accuracy Topics</CardTitle>
                </div>
                <CardDescription>We've analyzed your past performance. Focus on these topics to increase your JAMB score.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Analyzing your performance history...</div>
                ) : weakTopics.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground/30" />
                    <p className="font-semibold text-muted-foreground">No weaknesses identified yet.</p>
                    <p className="text-sm text-muted-foreground/70">Complete at least 3 practice sessions to see your weak topics.</p>
                    <Button size="sm" onClick={() => navigate('/practice')}>Start a Practice Session</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {weakTopics.map(topic => (
                      <div key={topic.id} className="flex items-center justify-between p-4 border border-border rounded-xl bg-background shadow-sm hover:shadow-premium transition-shadow">
                        <div>
                          <h4 className="font-bold">{topic.name}</h4>
                          <p className="text-sm text-muted-foreground">{topic.subjects?.name} • Accuracy: <span className="text-amber-500 font-bold">{topic.accuracy}%</span></p>
                        </div>
                        <Button onClick={() => handleStartDrill(topic.id, topic.subject_id, 'weakness')}>
                          Start Drill
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mistakes">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-xl font-display">Mistake Review Mode</CardTitle>
                </div>
                <CardDescription>Practice exclusively with questions you have failed in previous mock exams and sessions.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="p-8 border border-dashed border-border rounded-xl text-center bg-muted/20">
                    <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold mb-2">You have 45 Unreviewed Mistakes</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                      Reviewing your mistakes is the fastest way to improve. This drill will serve you a random set of 15 questions you got wrong recently.
                    </p>
                    <Button size="lg" className="rounded-xl shadow-premium px-8" onClick={() => handleStartDrill('all', 'all', 'mistakes')}>
                      Start Mistake Drill
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time">
            <Card className="bg-card border-border shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Clock className="w-48 h-48" />
              </div>
              <CardHeader className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <CardTitle className="text-xl font-display">Time-Management Training</CardTitle>
                </div>
                <CardDescription>Train yourself to answer questions under extreme pressure. 40 Seconds per question.</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                 <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {weakTopics.map(topic => (
                      <div key={topic.id} className="p-5 border border-border rounded-xl bg-background shadow-sm hover:border-red-500/50 transition-colors cursor-pointer group" onClick={() => handleStartDrill(topic.id, topic.subject_id, 'time')}>
                        <h4 className="font-bold mb-1 group-hover:text-red-500 transition-colors">{topic.subjects?.name}</h4>
                        <p className="text-xs text-muted-foreground">General Mix • Strict Timer</p>
                      </div>
                    ))}
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
          
        </Tabs>
      </div>
    </div>
  );
};

export default WeaknessDrill;
