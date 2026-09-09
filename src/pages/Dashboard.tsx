import { useAuth } from '@/context/AuthContext';
import { useStudentStats } from '@/hooks/useStudentStats';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { AIRecommendations } from '@/components/AIRecommendations';
import { WeeklyChallenge } from '@/components/dashboard/WeeklyChallenge';
import { JambScorePredictorCard } from '@/components/dashboard/JambScorePredictorCard';
import { DailyStudyTip } from '@/components/dashboard/DailyStudyTip';
import { DailyGoalTracker } from '@/components/dashboard/DailyGoalTracker';
import { StudyStreakCalendar } from '@/components/dashboard/StudyStreakCalendar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { DashboardSkeleton } from '@/components/dashboard/skeletons/DashboardSkeleton';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';
import { motion } from 'framer-motion';
import { Flame, Zap } from 'lucide-react';
import { DailyFiveQuestionDrill } from '@/components/dashboard/DailyFiveQuestionDrill';
import { CbtHubGrid } from '@/components/dashboard/CbtHubGrid';
import { UserSubjectsQuickGrid } from '@/components/dashboard/UserSubjectsQuickGrid';
import { MistakeBankQuickCard } from '@/components/dashboard/MistakeBankQuickCard';
import { PeerStudyRoomWidget } from '@/components/dashboard/PeerStudyRoomWidget';

export default function Dashboard() {
  usePerfMonitoring('Dashboard');
  const { profile, loading } = useAuth();
  const { examsTaken, averageScore, streak, history, statsLoading } = useStudentStats();
  const stats = { examsTaken, averageScore, streak, history };

  if (statsLoading || loading || !profile) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 overflow-x-hidden w-full">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center justify-between w-full max-w-full">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="text-base sm:text-lg font-display font-bold text-foreground truncate">
              Student Dashboard
            </h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              JAMB / UTME Preparation Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {profile.streak_days != null && profile.streak_days > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>{profile.streak_days}d</span>
            </div>
          )}
          <ThemeToggle />
          <NotificationsMenu />
        </div>
      </header>

      <div className="container max-w-7xl mx-auto p-3 sm:p-5 space-y-6 mt-1 w-full max-w-full min-w-0">
        
        {/* Real-time Platform Announcements Banner */}
        <AnnouncementBanner />

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.3 }} 
          className="min-w-0 w-full"
        >
          <WelcomeHero profile={profile} stats={stats} />
        </motion.div>

        {/* 4 UTME Registered Subjects Quick Launcher */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.3, delay: 0.05 }} 
          className="min-w-0 w-full"
        >
          <UserSubjectsQuickGrid />
        </motion.div>

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0 items-start">
          
          {/* ===================================================================== */}
          {/* Main Action Column (Left on desktop: 8 cols)                         */}
          {/* ===================================================================== */}
          <div className="lg:col-span-8 space-y-6 min-w-0 w-full">
            
            {/* Today's 5-Question Daily Streak Drill */}
            <DailyFiveQuestionDrill userId={profile.id} />

            {/* Practice & Exam Modules (Categorized) */}
            <CbtHubGrid />

            {/* Mistake Bank (Correction Center) */}
            <MistakeBankQuickCard />

            {/* AI Recommended Practice */}
            <div className="space-y-3 pt-2">
              <h2 className="text-lg sm:text-xl font-bold font-display text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span>Recommended Study Steps</span>
              </h2>
              <AIRecommendations profileId={profile.id} examsData={stats.history} />
            </div>
          </div>

          {/* ===================================================================== */}
          {/* Progress & Sidebar Column (Right on desktop: 4 cols)                  */}
          {/* ===================================================================== */}
          <div className="lg:col-span-4 space-y-6 min-w-0 w-full">
            
            {/* Projected Score Predictor */}
            <JambScorePredictorCard history={stats.history} />

            {/* Daily Question Target Tracker */}
            <DailyGoalTracker />

            {/* 7-Day Streak Calendar */}
            <StudyStreakCalendar />

            {/* High-Yield Daily Study Tip */}
            <DailyStudyTip />

            {/* Live Peer Study Rooms */}
            <PeerStudyRoomWidget />

            {/* Weekly Challenge */}
            <WeeklyChallenge />
          </div>
        </div>

      </div>
    </div>
  );
}
