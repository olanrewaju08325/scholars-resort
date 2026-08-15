import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, Flame, Zap, Trophy, Target, Star, ShieldCheck, Lock, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  iconName: string;
  category: 'streak' | 'xp' | 'accuracy' | 'duel';
  requiredValue: number;
}

const ALL_BADGES: BadgeItem[] = [
  { id: 'first_quiz', name: 'First Steps', description: 'Complete your first CBT practice quiz', iconName: 'Target', category: 'accuracy', requiredValue: 1 },
  { id: 'quiz_master', name: 'Quiz Master', description: 'Complete 10 CBT practice quizzes', iconName: 'Award', category: 'accuracy', requiredValue: 10 },
  { id: '7_day_streak', name: 'On Fire', description: 'Maintain a 7-day continuous study streak', iconName: 'Flame', category: 'streak', requiredValue: 7 },
  { id: '1k_club', name: '1,000 XP Club', description: 'Accumulate 1,000 total Experience Points', iconName: 'Zap', category: 'xp', requiredValue: 1000 },
  { id: 'accuracy_ace', name: 'UTME Sharp Shooter', description: 'Achieve 90%+ accuracy in any practice session', iconName: 'Star', category: 'accuracy', requiredValue: 90 },
  { id: 'duel_victor', name: '1v1 Duel Champion', description: 'Win your first 1v1 speed duel against a peer', iconName: 'Trophy', category: 'duel', requiredValue: 1 },
];

export const BadgesAndAchievements: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUserStats = async () => {
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setStats(data);
          setUnlockedBadges(data.badges_unlocked || []);
        } else {
          // Initialize user_stats if not present
          const initStats = {
            user_id: user.id,
            xp: profile?.xp || 0,
            streak_days: profile?.streak_days || 0,
            coins: profile?.coins || 0,
            level: Math.floor((profile?.xp || 0) / 500) + 1,
            badges_unlocked: ['first_quiz']
          };
          await supabase.from('user_stats').upsert(initStats);
          setStats(initStats);
          setUnlockedBadges(['first_quiz']);
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [user, profile]);

  const getBadgeIcon = (iconName: string, isUnlocked: boolean) => {
    const className = `w-6 h-6 ${isUnlocked ? 'text-amber-400' : 'text-slate-500'}`;
    switch (iconName) {
      case 'Flame': return <Flame className={className} />;
      case 'Zap': return <Zap className={className} />;
      case 'Trophy': return <Trophy className={className} />;
      case 'Star': return <Star className={className} />;
      case 'Target': return <Target className={className} />;
      default: return <Award className={className} />;
    }
  };

  const xpProgress = stats ? ((stats.xp % 500) / 500) * 100 : 0;

  return (
    <Card className="border-border bg-card shadow-xl overflow-hidden">
      <CardHeader className="bg-slate-900/50 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 font-display">
              <Award className="w-6 h-6 text-amber-400" />
              Badges & Achievements
            </CardTitle>
            <CardDescription>
              Earn XP, level up, and unlock UTME mastery badges as you practice
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Current Level</div>
              <div className="text-2xl font-black text-amber-400 flex items-center justify-end gap-1">
                <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400/30" />
                Level {stats.level || 1}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* XP Level Progress Bar */}
        {stats && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Level {stats.level} Progress</span>
              <span className="text-amber-400">{stats.xp || 0} / {stats.level * 500} XP</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, xpProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_BADGES.map((badge) => {
            const isUnlocked = unlockedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-xl border transition-all duration-200 flex items-start gap-3 relative ${
                  isUnlocked
                    ? 'bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-500/5'
                    : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                }`}
              >
                <div className={`p-3 rounded-xl shrink-0 ${isUnlocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {getBadgeIcon(badge.iconName, isUnlocked)}
                </div>
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                    {badge.name}
                    {isUnlocked ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{badge.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
