import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, Star, Target, Zap, Flame, BookOpen, ShieldCheck, 
  BrainCircuit, Sunrise, Moon, Sparkles, CheckCircle2, Lock 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { 
  evaluateStudentAchievements, 
  type AchievementBadge 
} from '@/services/studentAchievementsService';

export const StudentAchievementsWidget: React.FC = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementBadge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const loadAchievements = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await evaluateStudentAchievements(user.id);
      setAchievements(data);
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const renderIcon = (iconName: string, unlocked: boolean) => {
    const cls = `w-5 h-5 ${unlocked ? 'text-amber-500' : 'text-muted-foreground/40'}`;
    switch (iconName) {
      case 'Flame': return <Flame className={cls} />;
      case 'BrainCircuit': return <BrainCircuit className={cls} />;
      case 'Target': return <Target className={cls} />;
      case 'BookOpen': return <BookOpen className={cls} />;
      case 'Trophy': return <Trophy className={cls} />;
      case 'Star': return <Star className={cls} />;
      case 'Zap': return <Zap className={cls} />;
      case 'Sunrise': return <Sunrise className={cls} />;
      case 'Moon': return <Moon className={cls} />;
      default: return <Sparkles className={cls} />;
    }
  };

  const filteredAchievements = achievements.filter(a => {
    if (activeCategory === 'all') return true;
    return a.category === activeCategory;
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-bold px-2 py-0.5">
                <Trophy className="w-3 h-3 mr-1" /> Student Milestones
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold font-display mt-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Student Achievements & Badges
            </CardTitle>
            <CardDescription className="text-xs">
              Track your UTME preparation milestones like Streak Master, Topic Expert & Speed Demon
            </CardDescription>
          </div>

          <Badge className="bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-full text-xs shrink-0 self-start sm:self-auto flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>{unlockedCount} / {totalCount} Badges Unlocked</span>
          </Badge>
        </div>

        {/* Category Tabs */}
        <div className="mt-4">
          <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-lg w-full flex flex-wrap gap-1">
              <TabsTrigger value="all" className="text-xs font-semibold px-3 py-1">All Badges</TabsTrigger>
              <TabsTrigger value="streak" className="text-xs font-semibold px-3 py-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" /> Streaks
              </TabsTrigger>
              <TabsTrigger value="mastery" className="text-xs font-semibold px-3 py-1 flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-500" /> Topic Expert
              </TabsTrigger>
              <TabsTrigger value="exam" className="text-xs font-semibold px-3 py-1 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-500" /> Exam Milestones
              </TabsTrigger>
              <TabsTrigger value="special" className="text-xs font-semibold px-3 py-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-500" /> Special
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Evaluating student milestones...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(2,minmax(0,1fr))] gap-3 min-w-0">
            {filteredAchievements.map((badge) => (
              <div
                key={badge.key}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  badge.unlocked
                    ? 'bg-amber-500/5 border-amber-500/30 shadow-xs hover:border-amber-500/60'
                    : 'bg-muted/20 border-border/50 opacity-75'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${badge.unlocked ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-muted/40'}`}>
                  {renderIcon(badge.icon, badge.unlocked)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-foreground truncate">{badge.title}</h4>
                    {badge.unlocked ? (
                      <span className="bg-amber-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                        Earned (+{badge.xpReward} XP)
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                    {badge.description}
                  </p>

                  {!badge.unlocked && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Milestone Progress:</span>
                        <span className="font-mono font-bold text-foreground">
                          {badge.progress.current} / {badge.progress.total}
                        </span>
                      </div>
                      <Progress 
                        value={Math.round((badge.progress.current / badge.progress.total) * 100)} 
                        className="h-1.5 bg-muted/60"
                      />
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
