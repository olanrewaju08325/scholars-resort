import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useStudentStats } from '@/hooks/useStudentStats';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { DailyMission } from '@/components/dashboard/DailyMission';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { AIRecommendations } from '@/components/AIRecommendations';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { LeaderboardPreview } from '@/components/dashboard/LeaderboardPreview';
import { TournamentPreview } from '@/components/dashboard/TournamentPreview';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { Gamification } from '@/pages/dashboard-tabs/Gamification';
import { GuardianConnections } from '@/pages/dashboard-tabs/GuardianConnections';
import { WeeklyChallenge } from '@/components/dashboard/WeeklyChallenge';
import { StudyGoalTracker } from '@/components/dashboard/StudyGoalTracker';
import { JAMBCountdown } from '@/components/dashboard/JAMBCountdown';
import { XPProgressPanel } from '@/components/dashboard/XPProgressPanel';
import { BurnoutDetector } from '@/components/dashboard/BurnoutDetector';
import { PomodoroTimer } from '@/components/dashboard/PomodoroTimer';
import { PerformanceTrendChart } from '@/components/dashboard/PerformanceTrendChart';
import { SubjectMasteryRadarChart } from '@/components/SubjectMasteryRadarChart';
import { JambScorePredictorCard } from '@/components/dashboard/JambScorePredictorCard';
import { DailyStudyTip } from '@/components/dashboard/DailyStudyTip';
import { StudyStreakCalendar } from '@/components/dashboard/StudyStreakCalendar';
import { Badges } from '@/components/Badges';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { profile } = useAuth();
  const { examsTaken, averageScore, streak, history, loading: statsLoading } = useStudentStats();
  const stats = { examsTaken, averageScore, streak, history };

  const navigate = useNavigate();
  useEffect(() => {
    if (profile?.role === 'guardian') {
      navigate('/guardian');
    }
  }, [profile, navigate]);

  if (statsLoading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950/50 pb-20">
      {/* Top Navigation / Header Area */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-foreground">My Dashboard</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationsMenu />
        </div>
      </header>

      <div className="container max-w-7xl mx-auto p-4 space-y-6 mt-4">
        
        {/* Real-time Platform Announcements Banner */}
        <AnnouncementBanner />
        
        {/* Hero Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <WelcomeHero profile={profile} stats={stats} />
        </motion.div>

        {/* Daily High-Yield Study Tip Widget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}>
          <DailyStudyTip />
        </motion.div>

        {/* JAMB Score Predictor */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}>
          <JambScorePredictorCard history={stats.history} />
        </motion.div>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Column (Left) */}
          <div className="lg:col-span-8 space-y-6">
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <DailyMission />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <QuickActions />
            </motion.div>

            {/* Visual Study Streak Calendar Component */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
              <StudyStreakCalendar />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
               <StatsOverview stats={stats} />
            </motion.div>

            {/* Performance Trend Recharts Line Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
               <PerformanceTrendChart history={stats.history} />
            </motion.div>

            {/* Subject Mastery Radar Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
               <SubjectMasteryRadarChart data={[]} />
            </motion.div>

            {/* Milestone Badges & Achievements */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
               <Badges />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
               <h2 className="text-xl font-bold font-display mb-4">Study Insights</h2>
               <AIRecommendations profileId={profile?.id || ''} examsData={stats.history} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
               <ActivityHeatmap />
            </motion.div>

            {/* Existing Gamification Tab Ported In */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
               <Gamification />
            </motion.div>
          </div>

          {/* Sidebar Column (Right) */}
          <div className="lg:col-span-4 space-y-6">
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
               <JAMBCountdown />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
               <PomodoroTimer />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
               <StudyGoalTracker />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
               <TournamentPreview />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
               <WeeklyChallenge />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
               <XPProgressPanel />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
               <LeaderboardPreview />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }}>
               <BurnoutDetector />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.8 }}>
               <GuardianConnections />
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
