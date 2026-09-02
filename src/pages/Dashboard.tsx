import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentStats } from '@/hooks/useStudentStats';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { SingleDeviceNotice } from '@/components/dashboard/SingleDeviceNotice';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { AIRecommendations } from '@/components/AIRecommendations';
import { LeaderboardPreview } from '@/components/dashboard/LeaderboardPreview';
import { TournamentPreview } from '@/components/dashboard/TournamentPreview';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { WeeklyChallenge } from '@/components/dashboard/WeeklyChallenge';
import { JambScorePredictorCard } from '@/components/dashboard/JambScorePredictorCard';
import { DailyStudyTip } from '@/components/dashboard/DailyStudyTip';
import { DailyGoalTracker } from '@/components/dashboard/DailyGoalTracker';
import { StudyStreakCalendar } from '@/components/dashboard/StudyStreakCalendar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DashboardSkeleton } from '@/components/dashboard/skeletons/DashboardSkeleton';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';
import { motion } from 'framer-motion';
import { BookOpen, BarChart2, Trophy, Clock, Zap } from 'lucide-react';
import { DailyFiveQuestionDrill } from "@/components/dashboard/DailyFiveQuestionDrill";
import { CbtHubGrid } from '@/components/dashboard/CbtHubGrid';

type DashboardView = 'practice' | 'progress' | 'community';

export default function Dashboard() {
  usePerfMonitoring('Dashboard');
  const { profile, loading } = useAuth();
  const { examsTaken, averageScore, streak, history, statsLoading } = useStudentStats();
  const stats = { examsTaken, averageScore, streak, history };
  const [activeView, setActiveView] = useState<DashboardView>('practice');

  if (statsLoading || loading || !profile) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 overflow-x-hidden w-full">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between w-full max-w-full">
        <h1 className="text-xl font-display font-bold text-foreground truncate">Student Dashboard</h1>
        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          <NotificationsMenu />
        </div>
      </header>

      <DailyFiveQuestionDrill userId={profile.id} />
      
      <div className="container max-w-7xl mx-auto p-3 sm:p-4 space-y-6 mt-2 sm:mt-4 w-full max-w-full min-w-0">
        
        {/* Real-time Platform Announcements Banner */}
        <AnnouncementBanner />

        {/* Single Device Protection Information UI */}
        <SingleDeviceNotice />
        
        {/* Hero Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="min-w-0 w-full">
          <WelcomeHero profile={profile} stats={stats} />
        </motion.div>

        {/* Scholars Resort CBT Practice & Exam Modules */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="min-w-0 w-full">
          <CbtHubGrid />
        </motion.div>

        {/* Daily High-Yield Study Tip */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="min-w-0 w-full">
          <DailyStudyTip />
        </motion.div>

        {/* Clean Dashboard View Selector */}
        <div className="flex items-center gap-2 border-b border-border/70 pb-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveView('practice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeView === 'practice'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Practice & Goals
          </button>
          <button
            onClick={() => setActiveView('progress')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeView === 'progress'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Score & Analytics
          </button>
          <button
            onClick={() => setActiveView('community')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeView === 'community'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trophy className="w-4 h-4" /> Challenges & Leaderboards
          </button>
        </div>

        {/* View Content */}
        {activeView === 'practice' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
            <div className="lg:col-span-8 space-y-6 min-w-0 w-full">
              <DailyGoalTracker />
              <StudyStreakCalendar />
              <div className="space-y-3">
                <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" /> Recommended Next Actions
                </h2>
                <AIRecommendations profileId={profile.id} examsData={stats.history} />
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6 min-w-0 w-full">
              <JambScorePredictorCard history={stats.history} />
              <WeeklyChallenge />
            </div>
          </div>
        )}

        {activeView === 'progress' && (
          <div className="space-y-6 w-full">
            <StatsOverview stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                <JambScorePredictorCard history={stats.history} />
              </div>
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-3">
                  <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Study Guidance
                  </h2>
                  <AIRecommendations profileId={profile.id} examsData={stats.history} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'community' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
            <div className="lg:col-span-7 space-y-6">
              <TournamentPreview />
              <WeeklyChallenge />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <LeaderboardPreview />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

