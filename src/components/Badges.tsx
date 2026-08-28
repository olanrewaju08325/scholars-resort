import React, { useEffect, useState } from 'react';
import { Award, Trophy, Zap, Target, Star, ShieldCheck, Flame, BookOpen, Sparkles, Sunrise, Moon, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface MilestoneBadge {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: { current: number; total: number };
}

const BADGE_DEFINITIONS = [
  { key: 'first_exam', title: 'First Steps', description: 'Completed your first CBT Mock Exam', icon: 'BookOpen', requirement: 1 },
  { key: 'early_bird', title: 'Early Bird', description: 'Completed a study drill or mock exam before 8:00 AM', icon: 'Sunrise', requirement: 1 },
  { key: 'quiz_master', title: 'Quiz Master', description: 'Scored 80% or higher in 5 or more practice quizzes', icon: 'Trophy', requirement: 5 },
  { key: 'speed_demon', title: 'Speed Demon', description: 'Answered 30+ questions in under 15 minutes with high accuracy', icon: 'Zap', requirement: 1 },
  { key: 'streak_7', title: '7-Day Scholar', description: 'Maintained a 7-day active study streak', icon: 'Flame', requirement: 7 },
  { key: 'score_100', title: 'Flawless 100%', description: 'Achieved 100% perfect score in an exam session', icon: 'Star', requirement: 1 },
  { key: 'score_80', title: 'High Achiever', description: 'Scored 80% or above in an official UTME simulation', icon: 'Target', requirement: 1 },
  { key: 'exam_10', title: 'CBT Veteran', description: 'Completed 10 full CBT Mock Exams', icon: 'ShieldCheck', requirement: 10 },
  { key: 'novel_master', title: 'Novel Maestro', description: 'Practiced and mastered chapters of The Life Changer', icon: 'Sparkles', requirement: 1 },
  { key: 'night_owl', title: 'Night Owl', description: 'Completed a late-night study drill after 9:00 PM', icon: 'Moon', requirement: 1 }
];

export const Badges: React.FC = () => {
  const { user, profile } = useAuth();
  const [badges, setBadges] = useState<MilestoneBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      // Fetch user's unlocked achievements from Supabase user_badges
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const achRes = await safeSupabaseQuery<any[]>(
        supabase.from('user_badges').select('*').eq('user_id', user.id),
        { contextName: 'Badges.fetchBadges.user_badges', fallbackValue: [] }
      );
      const unlockedData = achRes.data || [];

      // Fetch completed exam sessions safely
      const sessRes = await safeSupabaseQuery<any[]>(
        supabase.from('exam_sessions').select('score, total_questions, created_at, status').eq('user_id', user.id).eq('status', 'completed'),
        { contextName: 'Badges.fetchBadges.exam_sessions', fallbackValue: [] }
      );
      const allSessions = sessRes.data || [];

      const completedCount = allSessions?.length || 0;
      
      // Calculate 80%+ quizzes count
      const highScoringQuizzes = allSessions?.filter(s => {
        const pct = s.total_questions ? (s.score / s.total_questions) * 100 : s.score;
        return pct >= 80;
      }) || [];

      // Check for perfect score
      const hasPerfect = allSessions?.some(s => {
        const pct = s.total_questions ? (s.score / s.total_questions) * 100 : s.score;
        return pct >= 100;
      }) || false;

      // Check for early bird session (before 8 AM)
      const hasEarlyBird = allSessions?.some(s => {
        const hour = new Date(s.created_at).getHours();
        return hour >= 4 && hour < 8;
      }) || false;

      // Check for night owl session (after 9 PM)
      const hasNightOwl = allSessions?.some(s => {
        const hour = new Date(s.created_at).getHours();
        return hour >= 21 || hour < 4;
      }) || false;

      const unlockedKeysMap = new Map<string, string>();
      if (unlockedData) {
        unlockedData.forEach((item: any) => {
          unlockedKeysMap.set(item.badge_key, item.unlocked_at);
        });
      }

      // Auto-unlock new achievements
      const toUnlock: string[] = [];
      BADGE_DEFINITIONS.forEach((b) => {
        if (!unlockedKeysMap.has(b.key)) {
          if (b.key === 'first_exam' && completedCount >= 1) toUnlock.push(b.key);
          if (b.key === 'exam_10' && completedCount >= 10) toUnlock.push(b.key);
          if (b.key === 'score_100' && hasPerfect) toUnlock.push(b.key);
          if (b.key === 'score_80' && highScoringQuizzes.length >= 1) toUnlock.push(b.key);
          if (b.key === 'quiz_master' && highScoringQuizzes.length >= 5) toUnlock.push(b.key);
          if (b.key === 'early_bird' && hasEarlyBird) toUnlock.push(b.key);
          if (b.key === 'night_owl' && hasNightOwl) toUnlock.push(b.key);
          if (b.key === 'streak_7' && (profile?.streak_days || 0) >= 7) toUnlock.push(b.key);
          if (b.key === 'speed_demon' && completedCount >= 2) toUnlock.push(b.key);
          if (b.key === 'novel_master' && completedCount >= 3) toUnlock.push(b.key);
        }
      });

      if (toUnlock.length > 0) {
        for (const key of toUnlock) {
          const def = BADGE_DEFINITIONS.find((d) => d.key === key);
          if (def) {
            try {
              await supabase.from('user_badges').insert({
                user_id: user.id,
                badge_key: key,
                title: def.title,
                description: def.description,
                icon: def.icon
              });
            } catch {}
            unlockedKeysMap.set(key, new Date().toISOString());
            triggerConfetti();
            playSuccessChime();
          }
        }
      }

      const mappedList: MilestoneBadge[] = BADGE_DEFINITIONS.map((def) => {
        const isUnlocked = unlockedKeysMap.has(def.key);
        let curr = 0;
        if (def.key === 'first_exam' || def.key === 'exam_10') curr = completedCount;
        else if (def.key === 'quiz_master') curr = highScoringQuizzes.length;
        else if (def.key === 'streak_7') curr = profile?.streak_days || 0;
        else if (isUnlocked) curr = def.requirement;

        return {
          key: def.key,
          title: def.title,
          description: def.description,
          icon: def.icon,
          unlocked: isUnlocked,
          unlockedAt: unlockedKeysMap.get(def.key),
          progress: { current: Math.min(curr, def.requirement), total: def.requirement }
        };
      });

      setBadges(mappedList);
    } catch (err) {
      console.error('Badges load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.streak_days]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const renderIcon = (iconName: string, unlocked: boolean) => {
    const cls = `w-5 h-5 ${unlocked ? 'text-amber-500' : 'text-muted-foreground/40'}`;
    switch (iconName) {
      case 'Trophy': return <Trophy className={cls} />;
      case 'Star': return <Star className={cls} />;
      case 'Target': return <Target className={cls} />;
      case 'Zap': return <Zap className={cls} />;
      case 'Flame': return <Flame className={cls} />;
      case 'ShieldCheck': return <ShieldCheck className={cls} />;
      case 'Sunrise': return <Sunrise className={cls} />;
      case 'Moon': return <Moon className={cls} />;
      case 'Sparkles': return <Sparkles className={cls} />;
      default: return <Award className={cls} />;
    }
  };

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Milestone Badges & Achievements
            </CardTitle>
            <CardDescription className="text-xs">
              Earn exclusive badges like Early Bird and Quiz Master as you practice CBT exams
            </CardDescription>
          </div>
          <span className="border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold px-2.5 py-1 rounded-full text-xs">
            {badges.filter((b) => b.unlocked).length} / {BADGE_DEFINITIONS.length} Unlocked
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Evaluating achievement milestones...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.key}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                  badge.unlocked
                    ? 'bg-amber-500/5 border-amber-500/30 shadow-xs hover:border-amber-500/60'
                    : 'bg-muted/20 border-border/50 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${badge.unlocked ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-muted/40'}`}>
                  {renderIcon(badge.icon, badge.unlocked)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-foreground truncate">{badge.title}</h4>
                    {badge.unlocked ? (
                      <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Earned</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium">Locked</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{badge.description}</p>
                  {!badge.unlocked && badge.progress && badge.progress.total > 1 && (
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Progress:</span>
                      <span className="font-mono font-bold text-foreground">{badge.progress.current} / {badge.progress.total}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
