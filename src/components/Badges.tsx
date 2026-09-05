import React, { useEffect, useState } from 'react';
import { Award, Trophy, Zap, Target, Star, ShieldCheck, Flame, BookOpen, Sparkles, Sunrise, Moon, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface MilestoneBadge {
  key: string;
  title: string;
  description: string;
  icon: string;
  category?: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: { current: number; total: number };
}

export const Badges: React.FC = () => {
  const { user, profile } = useAuth();
  const [badges, setBadges] = useState<MilestoneBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 1. Fetch Authoritative Badge Definitions from admin_settings (gamification_badges_config) or badges table
      let rawDefinitions: any[] = [];
      try {
        const { data: settingData } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'gamification_badges_config')
          .maybeSingle();

        if (settingData?.setting_value && Array.isArray(settingData.setting_value) && settingData.setting_value.length > 0) {
          rawDefinitions = settingData.setting_value.map((b: any) => ({
            key: b.badge_key || b.id || b.requirement_type,
            title: b.name || b.title,
            description: b.description,
            icon: b.icon || 'Award',
            category: b.category || 'Milestone',
            requirement: b.xp_threshold || 1
          }));
        }
      } catch (err) {
        console.warn('Could not fetch gamification_badges_config from admin_settings:', err);
      }

      if (rawDefinitions.length === 0) {
        try {
          const { data: dbBadges } = await supabase.from('badges').select('*');
          if (dbBadges && dbBadges.length > 0) {
            rawDefinitions = dbBadges.map((b: any) => ({
              key: b.requirement_type || b.id,
              title: b.name,
              description: b.description,
              icon: b.icon || 'Award',
              category: 'General',
              requirement: 1
            }));
          }
        } catch (err) {
          console.warn('Could not fetch badges from badges table:', err);
        }
      }

      // 2. Fetch user's unlocked achievements from Supabase user_badges (using valid student_id column)
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const achRes = await safeSupabaseQuery<any[]>(
        supabase.from('user_badges').select('badge_id, earned_at').eq('student_id', user.id),
        { contextName: 'Badges.fetchBadges.user_badges', fallbackValue: [] }
      );
      const unlockedData = achRes.data || [];

      // Also merge with local earned badges
      const localEarned = JSON.parse(localStorage.getItem(`scholars_earned_badges_${user.id}`) || '[]');

      // 3. Fetch completed exam sessions for progress
      const sessRes = await safeSupabaseQuery<any[]>(
        supabase.from('exam_sessions').select('score, total_questions, started_at, status').eq('user_id', user.id).eq('status', 'completed'),
        { contextName: 'Badges.fetchBadges.exam_sessions', fallbackValue: [] }
      );
      const allSessions = sessRes.data || [];
      const completedCount = allSessions.length;

      const unlockedKeysMap = new Map<string, string>();
      localEarned.forEach((k: string) => unlockedKeysMap.set(k, new Date().toISOString()));

      if (unlockedData) {
        unlockedData.forEach((item: any) => {
          if (item.badge_id) unlockedKeysMap.set(item.badge_id, item.earned_at || new Date().toISOString());
        });
      }

      const mappedList: MilestoneBadge[] = rawDefinitions.map((def) => {
        const isUnlocked = unlockedKeysMap.has(def.key);
        let curr = 0;
        if (def.key === 'first_exam' || def.key === 'exam_10' || def.key === 'exam_50') curr = completedCount;
        else if (def.key.startsWith('streak_')) curr = profile?.streak_days || 0;
        else if (isUnlocked) curr = def.requirement;

        return {
          key: def.key,
          title: def.title,
          description: def.description,
          icon: def.icon,
          category: def.category,
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
      case 'Shield': return <Shield className={cls} />;
      case 'Sunrise': return <Sunrise className={cls} />;
      case 'Moon': return <Moon className={cls} />;
      case 'Sparkles': return <Sparkles className={cls} />;
      case 'BookOpen': return <BookOpen className={cls} />;
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
              Authoritative achievements configured by the academic board
            </CardDescription>
          </div>
          <span className="border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold px-2.5 py-1 rounded-full text-xs">
            {badges.filter((b) => b.unlocked).length} / {badges.length} Unlocked
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Evaluating achievement milestones...</div>
        ) : badges.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No achievement badges have been configured yet.
          </div>
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
                  {badge.category && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {badge.category}
                    </span>
                  )}
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
