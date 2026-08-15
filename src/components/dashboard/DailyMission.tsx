import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const DailyMission = () => {
  const { profile } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMissions = async () => {
      if (!profile?.id) return;
      
      try {
        // Today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        // 1. Mission: Take an Exam today
        const { count: examCount } = await supabase
          .from('exam_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'submitted')
          .gte('submitted_at', todayIso);
          
        // 2. Mission: Generate AI Flashcards today
        const { count: flashcardCount } = await supabase
          .from('activity_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('action', 'ai_generate')
          .gte('created_at', todayIso);

        // 3. Mission: Study for at least 1 hour (simulated by checking if study_logs exists today)
        const { count: studyCount } = await supabase
          .from('study_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', todayIso);

        const calculatedMissions = [
          {
            id: 'exam',
            title: 'Complete 1 Practice Exam',
            status: (examCount && examCount > 0) ? 'completed' : 'pending',
            action: '/exam'
          },
          {
            id: 'study',
            title: 'Log a Study Session',
            status: (studyCount && studyCount > 0) ? 'completed' : 'pending',
            action: '/plan'
          },
          {
            id: 'flashcard',
            title: 'Use AI to generate Flashcards',
            status: (flashcardCount && flashcardCount > 0) ? 'completed' : 'pending',
            action: '/flashcards'
          }
        ];

        setMissions(calculatedMissions);
      } catch (e) {
        console.error("Error fetching daily missions:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMissions();
  }, [profile]);

  const completedCount = missions.filter(m => m.status === 'completed').length;
  const progress = missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;

  if (loading) {
    return (
      <Card className="bg-slate-950/50 backdrop-blur-md border-slate-800 shadow-xl">
         <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
         </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-950/50 backdrop-blur-md border-slate-800 shadow-xl relative overflow-hidden">
      {/* Background flare */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-3 border-b border-slate-800/50 relative z-10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
            <Target className="w-5 h-5 text-blue-500" /> Today's Missions
          </CardTitle>
          <div className="text-sm font-semibold text-slate-400">
            {completedCount} / {missions.length} Completed
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full mt-3 overflow-hidden border border-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-1000 ease-out rounded-full" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-4 p-0 relative z-10">
        <ul className="divide-y divide-slate-800/50">
          {missions.map(mission => (
            <li key={mission.id} className="p-4 flex items-center justify-between hover:bg-slate-900/50 transition-colors">
              <div className="flex items-center gap-3">
                {mission.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-600 shrink-0" />
                )}
                <span className={`text-sm font-medium ${mission.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {mission.title}
                </span>
              </div>
              {mission.status !== 'completed' && (
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors">
                  <Link to={mission.action}>Start</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
