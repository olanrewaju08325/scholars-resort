import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Target, CalendarDays, Zap, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateLevel } from '@/lib/gamification';

interface WelcomeHeroProps {
  profile: any;
  stats?: any;
}

export const WelcomeHero = ({ profile, stats: _stats }: WelcomeHeroProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const name = profile?.full_name?.split(' ')[0] || 'Scholar';
  const levelInfo = calculateLevel(profile?.xp || 0);
  const streakDays = profile?.streak_days || 0;
  
  // Exam date for countdown
  const examDate = profile?.exam_date ? new Date(profile.exam_date) : new Date('2027-04-19');
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-xl border border-primary-foreground/10 opacity-100">
      <div className="relative z-10 p-6 sm:p-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-4 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/15 text-xs font-bold tracking-wider text-primary-foreground border border-primary-foreground/20">
              <span className="text-sm">{levelInfo.icon}</span>
              <span>Level {levelInfo.level}: {levelInfo.title}</span>
            </div>

            {streakDays > 0 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-bold">
                <Flame className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span>{streakDays} Day Streak</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-400 text-slate-950 text-xs font-mono font-bold">
              <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span>{(profile?.xp || 0).toLocaleString()} XP</span>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-primary-foreground">
            {getGreeting()}, {name}!
          </h1>
          
          <p className="text-base sm:text-lg text-primary-foreground/90 leading-relaxed max-w-md font-medium">
            Consistency is the key to excellence. You are {daysLeft} days away from your target. Let's make today count.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-extrabold shadow-md transition-transform hover:scale-105">
              <Link to="/cbt">Start CBT Mock Exam</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 font-bold">
              <Link to="/plan">View Study Plan</Link>
            </Button>
          </div>
        </div>

        {/* Floating Stat Cards - Mobile Friendly Flex Grid */}
        <div className="grid grid-cols-3 gap-3 self-stretch lg:self-auto w-full lg:w-auto">
          <Card className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground min-w-[100px] shadow-md opacity-100">
            <CardContent className="p-3 sm:p-5 flex flex-col items-center justify-center text-center h-full">
              <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground mb-1.5" />
              <div className="text-xl sm:text-3xl font-bold font-display">{daysLeft}</div>
              <div className="text-[10px] sm:text-[11px] text-primary-foreground/80 uppercase font-bold tracking-wider mt-1">Days to JAMB</div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground min-w-[100px] shadow-md opacity-100">
            <CardContent className="p-3 sm:p-5 flex flex-col items-center justify-center text-center h-full">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground mb-1.5" />
              <div className="text-xl sm:text-3xl font-bold font-display">{profile?.target_score || 300}</div>
              <div className="text-[10px] sm:text-[11px] text-primary-foreground/80 uppercase font-bold tracking-wider mt-1">Target Score</div>
            </CardContent>
          </Card>

          <Card className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground min-w-[100px] shadow-md opacity-100">
            <CardContent className="p-3 sm:p-5 flex flex-col items-center justify-center text-center h-full">
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground mb-1.5" />
              <div className="text-xl sm:text-3xl font-bold font-display font-mono">{(profile?.xp || 0).toLocaleString()}</div>
              <div className="text-[10px] sm:text-[11px] text-primary-foreground/80 uppercase font-bold tracking-wider mt-1">XP Points</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

