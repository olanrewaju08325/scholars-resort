import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { useAuth } from '@/context/AuthContext';

export const DailyMission = () => {
  const { profile } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMissions = async () => {
      if (!profile?.id) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // 1. Mission: Take an Exam today
      const examRes = await safeSupabaseQuery(
        supabase
          .from('exam_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'submitted')
          .gte('submitted_at', todayIso),
        { contextName: 'DailyMission.examSessions', fallbackValue: [] }
      );
      const examCount = examRes.count || 0;
        
      // 2. Mission: Generate AI Flashcards today
      const flashcardRes = await safeSupabaseQuery(
        supabase
          .from('activity_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('action', 'ai_generate')
          .gte('created_at', todayIso),
        { contextName: 'DailyMission.flashcards', fallbackValue: [] }
      );
      const flashcardCount = flashcardRes.count || 0;

      // 3. Mission: Study log check
      const studyRes = await safeSupabaseQuery(
        supabase
          .from('study_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', todayIso),
        { contextName: 'DailyMission.studyLogs', fallbackValue: [] }
      );
      const studyCount = studyRes.count || 0;

      const calculatedMissions = [
        {
          id: 'exam',
          title: 'Complete 1 Practice Exam',
          status: examCount > 0 ? 'completed' : 'pending',
          action: '/exam'
        },
        {
          id: 'study',
          title: 'Log a Study Session',
          status: studyCount > 0 ? 'completed' : 'pending',
          action: '/plan'
        },
        {
          id: 'flashcard',
          title: 'Use AI to generate Flashcards',
          status: flashcardCount > 0 ? 'completed' : 'pending',
          action: '/flashcards'
        }
      ];

      setMissions(calculatedMissions);
      setLoading(false);
    };
    
    fetchMissions();
  }, [profile]);


  const completedCount = missions.filter(m => m.status === 'completed').length;
  const progress = missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;

  if (loading) {
    return (
      <Card className="bg-card text-card-foreground border-border shadow-md">
         <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
         </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground border-border shadow-md relative overflow-hidden">
      {/* Background flare */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-3 border-b border-border/80 relative z-10 bg-muted/20">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Target className="w-5 h-5 text-primary" /> Today's Missions
          </CardTitle>
          <div className="text-sm font-semibold text-muted-foreground">
            {completedCount} / {missions.length} Completed
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden border border-border">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-out rounded-full" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-4 p-0 relative z-10">
        <ul className="divide-y divide-border/60">
          {missions.map(mission => (
            <li key={mission.id} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                {mission.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm font-medium ${mission.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {mission.title}
                </span>
              </div>
              {mission.status !== 'completed' && (
                <Button asChild size="sm" variant="default" className="h-8 text-xs font-bold px-3">
                  <Link to={mission.action}>Start Mission</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
