import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Zap, Star, Lock, Award, CheckCircle2, ChevronRight, Sparkles, BookOpen, Target, ShieldCheck, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calculateLevel, LEVEL_TIERS, type LevelTier } from '@/lib/gamification';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const ICONS: Record<string, any> = {
  'Trophy': Trophy,
  'Flame': Flame,
  'Zap': Zap,
  'Star': Star,
  'BookOpen': BookOpen,
  'Target': Target,
  'ShieldCheck': ShieldCheck,
  'Award': Award
};

export const Gamification = () => {
  const { profile } = useAuth();
  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState<Set<string>>(new Set());
  const [userXP, setUserXP] = useState<number>(profile?.xp || 0);
  const [loading, setLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'exam' | 'streak' | 'mastery'>('all');

  const fetchGamificationData = useCallback(async () => {
    const isUUID = (id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!profile?.id || !isUUID(profile.id)) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch user XP from profile
      const { data: userData } = await supabase.from('profiles').select('xp, streak_days').eq('id', profile.id).maybeSingle();
      if (userData?.xp !== undefined) {
        setUserXP(userData.xp);
      }

      // 2. Fetch badges earned by user from user_badges (using valid student_id column)
      const userBadgesRes = await supabase.from('user_badges').select('badge_id, earned_at').eq('student_id', profile.id);
      const earnedSet = new Set<string>();

      // Check local storage for resilience
      const localBadges = JSON.parse(localStorage.getItem(`scholars_earned_badges_${profile.id}`) || '[]');
      localBadges.forEach((k: string) => earnedSet.add(k));

      // Fetch badge definitions to map badge UUID to requirement key
      try {
        const { data: dbBadges } = await supabase.from('badges').select('id, requirement_type');
        if (userBadgesRes.data) {
          userBadgesRes.data.forEach((ub: any) => {
            if (ub.badge_id) earnedSet.add(ub.badge_id);
            const matching = dbBadges?.find(b => b.id === ub.badge_id);
            if (matching?.requirement_type) earnedSet.add(matching.requirement_type);
          });
        }
      } catch (e) {
        if (userBadgesRes.data) {
          userBadgesRes.data.forEach((ub: any) => earnedSet.add(ub.badge_id));
        }
      }

      setEarnedBadgeKeys(earnedSet);
    } catch (e) {
      console.error('Gamification fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchGamificationData();

    // Listen for live XP events
    const handleXpUpdate = (e: any) => {
      if (e.detail?.xp !== undefined) {
        setUserXP(e.detail.xp);
        fetchGamificationData();
      }
    };
    window.addEventListener('user_xp_updated', handleXpUpdate);
    return () => window.removeEventListener('user_xp_updated', handleXpUpdate);
  }, [profile, fetchGamificationData]);

  const levelInfo = calculateLevel(userXP);

  // Full badge catalog with categories
  const BADGES_LIST = [
    {
      key: 'first_exam',
      category: 'exam',
      name: 'First Steps',
      description: 'Completed your first official CBT Mock Exam simulation',
      icon: 'Trophy',
      reward: '+100 XP'
    },
    {
      key: 'score_80',
      category: 'exam',
      name: 'High Achiever',
      description: 'Scored 80% or higher in a full CBT simulation',
      icon: 'Target',
      reward: '+100 XP'
    },
    {
      key: 'high_scorer',
      category: 'exam',
      name: 'Score Elite (90%+)',
      description: 'Achieved an outstanding 90%+ score on a CBT exam',
      icon: 'Star',
      reward: '+100 XP'
    },
    {
      key: 'flawless',
      category: 'exam',
      name: 'Flawless 100%',
      description: 'Achieved a perfect 100% score on any CBT exam',
      icon: 'Star',
      reward: '+100 XP'
    },
    {
      key: 'speed_demon',
      category: 'exam',
      name: 'Speed Demon',
      description: 'Completed CBT Exam with ≥70% score in less than half allotted time',
      icon: 'Zap',
      reward: '+100 XP'
    },
    {
      key: 'exam_10',
      category: 'exam',
      name: 'Tenacious Ten',
      description: 'Completed 10 full-length CBT Mock Exams',
      icon: 'ShieldCheck',
      reward: '+100 XP'
    },
    {
      key: 'exam_50',
      category: 'exam',
      name: 'Centurion Scholar',
      description: 'Completed 50 CBT Mock Exams across your target subjects',
      icon: 'Trophy',
      reward: '+100 XP'
    },
    {
      key: 'streak_3',
      category: 'streak',
      name: 'Ignited Spark',
      description: 'Maintained a 3-day active study streak',
      icon: 'Flame',
      reward: '+100 XP'
    },
    {
      key: 'streak_7',
      category: 'streak',
      name: '7-Day Scholar',
      description: 'Maintained a 7-day unbroken study streak',
      icon: 'Flame',
      reward: '+100 XP'
    },
    {
      key: 'streak_14',
      category: 'streak',
      name: 'Unstoppable Habit',
      description: 'Maintained a 14-day consecutive daily study marathon',
      icon: 'Flame',
      reward: '+100 XP'
    },
    {
      key: 'streak_30',
      category: 'streak',
      name: 'Monthly Legend',
      description: 'Maintained an incredible 30-day daily study streak',
      icon: 'Flame',
      reward: '+100 XP'
    },
    {
      key: 'early_bird',
      category: 'mastery',
      name: 'Early Bird',
      description: 'Completed a study drill or mock exam before 8:00 AM',
      icon: 'Sparkles',
      reward: '+100 XP'
    },
    {
      key: 'night_owl',
      category: 'mastery',
      name: 'Night Owl',
      description: 'Completed a study drill or exam after 9:00 PM',
      icon: 'Sparkles',
      reward: '+100 XP'
    },
    {
      key: 'quiz_master',
      category: 'mastery',
      name: 'Quiz Master',
      description: 'Scored 80% or higher in 5 or more practice drills',
      icon: 'Award',
      reward: '+100 XP'
    },
    {
      key: 'novel_master',
      category: 'mastery',
      name: 'Novel Maestro',
      description: 'Practiced questions from The Life Changer literature novel',
      icon: 'BookOpen',
      reward: '+100 XP'
    }
  ];

  const filteredBadges = BADGES_LIST.filter(b => {
    if (badgeFilter === 'all') return true;
    return b.category === badgeFilter;
  });

  const earnedCount = BADGES_LIST.filter(b => earnedBadgeKeys.has(b.key)).length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Level Badge and Progress */}
      <Card className="bg-card border-border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Student Level & Rank System
              </div>
              <CardTitle className="font-display text-2xl sm:text-3xl flex items-center gap-2">
                Academic Journey
              </CardTitle>
              <CardDescription>
                Earn XP by finishing CBT mock exams, maintaining daily streaks, and unlocking achievement badges.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-2xl border border-border/80 shrink-0">
              <div className="text-3xl">{levelInfo.icon}</div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Current Rank</div>
                <div className="font-bold text-foreground text-sm">Level {levelInfo.level}: {levelInfo.title}</div>
                <div className="text-xs font-mono font-bold text-primary">{userXP.toLocaleString()} Total XP</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Active Level Progress Hero */}
          <div className={`p-6 rounded-2xl bg-gradient-to-br ${levelInfo.color} text-white shadow-lg relative overflow-hidden`}>
            <div className="relative z-10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase font-semibold tracking-wider text-white/80">Level {levelInfo.level} Distinction</div>
                  <h2 className="text-2xl sm:text-3xl font-black font-display flex items-center gap-2">
                    {levelInfo.title}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-mono font-black">{levelInfo.progressPercentage}%</span>
                  <div className="text-xs text-white/80 font-medium">To Next Tier</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-black/30 backdrop-blur-md rounded-full h-3 overflow-hidden p-0.5 border border-white/20">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-1000 shadow-md"
                    style={{ width: `${levelInfo.progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/90 font-mono">
                  <span>{userXP.toLocaleString()} XP</span>
                  {levelInfo.nextTier ? (
                    <span>{levelInfo.nextTier.minXp.toLocaleString()} XP ({levelInfo.xpRequiredForNext.toLocaleString()} needed for Level {levelInfo.nextTier.level})</span>
                  ) : (
                    <span>Max Level Reached!</span>
                  )}
                </div>
              </div>

              {/* Active Perks Box */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 text-xs sm:text-sm text-white/95 flex items-start gap-2.5">
                <Award className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Active Perks:</span> {levelInfo.perks}
                  {levelInfo.nextTier && (
                    <div className="text-white/80 text-xs mt-1">
                      <span className="font-semibold text-yellow-200">Next Unlock at Level {levelInfo.nextTier.level}:</span> {levelInfo.nextTier.perks}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Level Roadmap / Progression Path */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                <Trophy className="w-4 h-4 text-amber-500" /> Rank & Level Progression Roadmap
              </h3>
              <span className="text-xs text-muted-foreground font-medium">8 Total Tiers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {LEVEL_TIERS.map((tier) => {
                const isCurrent = tier.level === levelInfo.level;
                const isUnlocked = userXP >= tier.minXp;
                
                return (
                  <div
                    key={tier.level}
                    className={`relative p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/30'
                        : isUnlocked
                        ? 'bg-card border-border shadow-xs'
                        : 'bg-muted/20 border-border/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{tier.icon}</span>
                        {isCurrent ? (
                          <Badge className="bg-primary text-white text-[10px] font-bold">Current</Badge>
                        ) : isUnlocked ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40 bg-emerald-500/10">Unlocked</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-foreground">Level {tier.level}</div>
                      <div className="font-semibold text-xs text-primary mb-1">{tier.title}</div>
                      <div className="text-[11px] font-mono text-muted-foreground mb-2">
                        {tier.minXp.toLocaleString()}{tier.maxXp === Infinity ? '+ XP' : ` - ${tier.maxXp.toLocaleString()} XP`}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground/90 border-t border-border/60 pt-2 line-clamp-2">
                      {tier.perks}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges Section with Category Tabs */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                  <Star className="w-4 h-4 text-yellow-500" /> Milestone Badges & Achievements
                </h3>
                <p className="text-xs text-muted-foreground">Unlock badges by completing milestones (+100 XP per badge unlocked)</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
                  {earnedCount} / {BADGES_LIST.length} Unlocked
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setBadgeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  badgeFilter === 'all' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                All Badges ({BADGES_LIST.length})
              </button>
              <button
                onClick={() => setBadgeFilter('exam')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  badgeFilter === 'exam' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                CBT Exams ({BADGES_LIST.filter(b => b.category === 'exam').length})
              </button>
              <button
                onClick={() => setBadgeFilter('streak')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  badgeFilter === 'streak' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Daily Streaks ({BADGES_LIST.filter(b => b.category === 'streak').length})
              </button>
              <button
                onClick={() => setBadgeFilter('mastery')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  badgeFilter === 'mastery' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Study Mastery ({BADGES_LIST.filter(b => b.category === 'mastery').length})
              </button>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredBadges.map((badge) => {
                const isEarned = earnedBadgeKeys.has(badge.key);
                const IconComponent = ICONS[badge.icon] || Trophy;

                return (
                  <div
                    key={badge.key}
                    className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 relative overflow-hidden ${
                      isEarned
                        ? 'bg-amber-500/5 border-amber-500/30 shadow-sm hover:border-amber-500/60'
                        : 'bg-muted/30 border-border/60 opacity-70 grayscale hover:grayscale-0'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        isEarned
                          ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 ring-2 ring-amber-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className="font-bold text-xs text-foreground truncate">{badge.name}</h4>
                        {isEarned ? (
                          <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            Earned
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0 font-medium">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-2">
                        {badge.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono border-t border-border/40 pt-1.5">
                        <span>Reward:</span>
                        <span className="text-primary font-bold">{badge.reward}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* XP Earnings Guide / Breakdown */}
          <div className="bg-muted/30 rounded-2xl p-5 border border-border">
            <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
              <Zap className="w-4 h-4 text-yellow-500" /> How to Earn XP Fast
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-card p-3 rounded-xl border border-border/70 space-y-1">
                <div className="font-bold text-foreground">CBT Mock Exams</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">+150 to +450 XP</div>
                <p className="text-muted-foreground text-[11px]">Base + accuracy bonus + speed bonuses</p>
              </div>

              <div className="bg-card p-3 rounded-xl border border-border/70 space-y-1">
                <div className="font-bold text-foreground">Daily Study Streaks</div>
                <div className="text-orange-500 font-mono font-bold">+50 to +1,000 XP</div>
                <p className="text-muted-foreground text-[11px]">Multiplier per day + milestone bonuses</p>
              </div>

              <div className="bg-card p-3 rounded-xl border border-border/70 space-y-1">
                <div className="font-bold text-foreground">Practice Drills</div>
                <div className="text-blue-500 font-mono font-bold">+30 to +70 XP</div>
                <p className="text-muted-foreground text-[11px]">Subject drills & custom practice sessions</p>
              </div>

              <div className="bg-card p-3 rounded-xl border border-border/70 space-y-1">
                <div className="font-bold text-foreground">Achievement Badges</div>
                <div className="text-purple-500 font-mono font-bold">+100 XP Each</div>
                <p className="text-muted-foreground text-[11px]">Earned on unlocking new study milestones</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
