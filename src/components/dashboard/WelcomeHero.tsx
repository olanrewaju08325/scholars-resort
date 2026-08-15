import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Sparkles, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  
  // Fake exam date for countdown, real one would come from profile
  const examDate = profile?.exam_date ? new Date(profile.exam_date) : new Date('2027-04-19');
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 to-purple-900 text-white shadow-xl">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl mix-blend-overlay pointer-events-none" />
      
      <div className="relative z-10 p-8 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>Premium Student</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight">
            {getGreeting()}, {name}!
          </h1>
          
          <p className="text-lg text-white/80 leading-relaxed max-w-md">
            Consistency is the key to excellence. You are {daysLeft} days away from your target. Let's make today count.
          </p>

          <div className="pt-4 flex flex-wrap gap-4">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold shadow-lg transition-transform hover:scale-105">
              <Link to="/cbt">Start Practice Exam</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/plan">View Study Plan</Link>
            </Button>
          </div>
        </div>

        {/* Floating Stat Cards */}
        <div className="flex gap-4 self-stretch md:self-auto w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <Card className="bg-black/20 backdrop-blur-md border-white/10 text-white min-w-[140px] shadow-2xl">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <CalendarDays className="w-8 h-8 text-blue-300 mb-3" />
              <div className="text-3xl font-bold font-display">{daysLeft}</div>
              <div className="text-xs text-white/70 uppercase tracking-wider mt-1">Days to JAMB</div>
            </CardContent>
          </Card>
          
          <Card className="bg-black/20 backdrop-blur-md border-white/10 text-white min-w-[140px] shadow-2xl">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <Target className="w-8 h-8 text-green-300 mb-3" />
              <div className="text-3xl font-bold font-display">{profile?.target_score || 300}</div>
              <div className="text-xs text-white/70 uppercase tracking-wider mt-1">Target Score</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
