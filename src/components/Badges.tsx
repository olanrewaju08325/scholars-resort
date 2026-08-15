import React, { useEffect, useState } from 'react';
import { Award, Trophy, Zap, Target, Star, ShieldCheck, Flame, BookOpen, Sparkles } from 'lucide-react';
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
  { key: 'exam_10', title: 'Exam Veteran', description: 'Completed 10 CBT Mock Exams', icon: 'Trophy', requirement: 10 },
  { key: 'exam_50', title: 'CBT Master', description: 'Completed 50 CBT Mock Exams', icon: 'ShieldCheck', requirement: 50 },
  { key: 'score_100', title: 'Perfect Score', description: 'Achieved 100% score in an exam session', icon: 'Star', requirement: 1 },
  { key: 'score_80', title: 'High Achiever', description: 'Scored 80% or above in an exam session', icon: 'Target', requirement: 1 },
  { key: 'streak_7', title: '7-Day Streak', description: 'Maintained a 7-day active study streak', icon: 'Flame', requirement: 7 },
  { key: 'speed_demon', title: 'Speed Demon', description: 'Answered 30+ questions in under 15 minutes', icon: 'Zap', requirement: 1 }
];

export const Badges: React.FC = () => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<MilestoneBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchBadges();
    }
  }, [user?.id]);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      // Fetch user's unlocked achievements from Supabase
      const { data: unlockedData, error: achErr } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user!.id);

      if (achErr) console.warn('Fetch achievements error:', achErr);

      // Fetch user stats & exam count for auto-unlock evaluation
      const { data: statsData } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      const { count: examCount } = await supabase
        .from('exam_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'completed');

      const { data: perfectExams } = await supabase
        .from('exam_sessions')
        .select('score')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gte('score', 100)
        .limit(1);

      const { data: highExams } = await supabase
        .from('exam_sessions')
        .select('score')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gte('score', 80)
        .limit(1);

      const unlockedKeysMap = new Map<string, string>();
      if (unlockedData) {
        unlockedData.forEach((item: any) => {
          unlockedKeysMap.set(item.badge_key, item.unlocked_at);
        });
      }

      const completedCount = examCount || 0;
      const hasPerfect = (perfectExams && perfectExams.length > 0) || false;
      const hasHigh = (highExams && highExams.length > 0) || false;

      // Auto-unlock new achievements
      const toUnlock: string[] = [];
      BADGE_DEFINITIONS.forEach((b) => {
        if (!unlockedKeysMap.has(b.key)) {
          if (b.key === 'first_exam' && completedCount >= 1) toUnlock.push(b.key);
          if (b.key === 'exam_10' && completedCount >= 10) toUnlock.push(b.key);
          if (b.key === 'exam_50' && completedCount >= 50) toUnlock.push(b.key);
          if (b.key === 'score_100' && hasPerfect) toUnlock.push(b.key);
          if (b.key === 'score_80' && hasHigh) toUnlock.push(b.key);
        }
      });

      if (toUnlock.length > 0) {
        for (const key of toUnlock) {
          const def = BADGE_DEFINITIONS.find((d) => d.key === key);
          if (def) {
            await supabase.from('achievements').insert({
              user_id: user!.id,
              badge_key: key,
              title: def.title,
              description: def.description,
              icon: def.icon
            });
            unlockedKeysMap.set(key, new Date().toISOString());
            triggerConfetti();
            playSuccessChime();
          }
        }
      }

      const mappedList: MilestoneBadge[] = BADGE_DEFINITIONS.map((def) => {
        const isUnlocked = unlockedKeysMap.has(def.key);
        let curr = 0;
        if (def.key.startsWith('exam_') || def.key === 'first_exam') curr = completedCount;

        return {
          key: def.key,
          title: def.title,
          description: def.description,
          icon: def.icon,
          unlocked: isUnlocked,
          unlockedAt: unlockedKeysMap.get(def.key),
          progress: { current: curr, total: def.requirement }
        };
      });

      setBadges(mappedList);
    } catch (err) {
      console.error('Badges load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderIcon = (iconName: string, unlocked: boolean) => {
    const cls = `w-6 h-6 ${unlocked ? 'text-amber-500 animate-pulse' : 'text-muted-foreground/40'}`;
    switch (iconName) {
      case 'Trophy': return <Trophy className={cls} />;
      case 'Star': return <Star className={cls} />;
      case 'Target': return <Target className={cls} />;
      case 'Zap': return <Zap className={cls} />;
      case 'Flame': return <Flame className={cls} />;
      case 'ShieldCheck': return <ShieldCheck className={cls} />;
      default: return <Award className={cls} />;
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Milestone Badges & Achievements
            </CardTitle>
            <CardDescription className="text-xs">
              Earn awards as you complete CBT mock exams and hit score milestones
            </CardDescription>
          </div>
          <span className="border border-amber-500/30 text-amber-600 bg-amber-500/10 font-semibold px-2 py-0.5 rounded text-xs">
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
                    : 'bg-muted/20 border-border/50 opacity-65'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${badge.unlocked ? 'bg-amber-500/15' : 'bg-muted/40'}`}>
                  {renderIcon(badge.icon, badge.unlocked)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-foreground truncate">{badge.title}</h4>
                    {badge.unlocked ? (
                      <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">Unlocked</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Locked</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                  {!badge.unlocked && badge.progress && (
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Progress:</span>
                      <span className="font-mono">{badge.progress.current} / {badge.progress.total}</span>
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
