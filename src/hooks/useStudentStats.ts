import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useStudentStats() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    examsTaken: 0,
    averageScore: 0,
    totalStudyHours: 0,
    streak: 0,
    xp: 0,
    coins: 0,
    rank: 1,
    history: [] as { name: string; score: number }[],
    statsLoading: true,
  });

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      // 1. Fetch completed exam sessions safely
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const sessRes = await safeSupabaseQuery<any[]>(
        supabase
          .from('exam_sessions')
          .select('score, total_questions, started_at, submitted_at, status')
          .eq('user_id', profile.id),
        { contextName: 'useStudentStats.exam_sessions', fallbackValue: [] }
      );
      const sessions = (sessRes.data || []).filter(s => s.status === 'submitted' || s.status === 'completed');

      let examsTaken = 0;
      let totalScore = 0;
      let totalStudyMinutes = 0;
      const history: { name: string; score: number }[] = [];

      if (sessions && sessions.length > 0) {
        examsTaken = sessions.length;

        sessions.forEach((session, i) => {
          const pct = session.score != null && session.total_questions
            ? Math.round((session.score / session.total_questions) * 400)
            : 0;
          totalScore += session.score != null && session.total_questions
            ? (session.score / session.total_questions) * 100
            : 0;

          if (session.started_at && session.submitted_at) {
            const diffMs = new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime();
            totalStudyMinutes += diffMs / (1000 * 60);
          }

          history.push({ name: `Exam ${i + 1}`, score: pct });
        });
      }

      const averageScore = examsTaken > 0 ? Math.round(totalScore / examsTaken) : 0;
      const totalStudyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

      setStats({
        examsTaken,
        averageScore,
        totalStudyHours,
        streak: profile.streak_days || 0,
        xp: profile.xp || 0,
        coins: profile.coins || 0,
        rank: 1,
        history,
        statsLoading: false
      });
    };

    fetchStats();
  }, [profile]);

  return stats;
}
