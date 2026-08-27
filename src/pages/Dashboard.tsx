import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useStudentStats } from '@/hooks/useStudentStats';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { SingleDeviceNotice } from '@/components/dashboard/SingleDeviceNotice';
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
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { DailyGoalTracker } from '@/components/dashboard/DailyGoalTracker';
import { SubjectMasteryRadarChart } from '@/components/SubjectMasteryRadarChart';
import { JambScorePredictorCard } from '@/components/dashboard/JambScorePredictorCard';
import { DailyStudyTip } from '@/components/dashboard/DailyStudyTip';
import { DailyStudyPlannerWidget } from '@/components/dashboard/DailyStudyPlannerWidget';
import { StudentAchievementsWidget } from '@/components/dashboard/StudentAchievementsWidget';
import { PeerStudyRoomWidget } from '@/components/dashboard/PeerStudyRoomWidget';
import { EducationalJourneyMap } from '@/components/journey/EducationalJourneyMap';
import { AdaptiveLearningPathWidget } from '@/components/learningpath/AdaptiveLearningPathWidget';
import { StudyStreakCalendar } from '@/components/dashboard/StudyStreakCalendar';
import { Badges } from '@/components/Badges';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MotivationEngine } from '@/components/dashboard/MotivationEngine';
import { DashboardSkeleton } from '@/components/dashboard/skeletons/DashboardSkeleton';
import { usePerfMonitoring } from '@/hooks/usePerfMonitoring';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, BarChart2, Clock, Trophy, Layers } from 'lucide-react';
import { DailyFiveQuestionDrill } from "@/components/dashboard/DailyFiveQuestionDrill";

type MobileTab = 'all' | 'practice' | 'analytics' | 'tools' | 'social';

export default function Dashboard() {
  usePerfMonitoring('Dashboard');
  const { profile, loading } = useAuth();
  const { examsTaken, averageScore, streak, history, statsLoading } = useStudentStats();
  const stats = { examsTaken, averageScore, streak, history };
  const [mobileTab, setMobileTab] = useState<MobileTab>('all');

  const navigate = useNavigate();
  useEffect(() => {
    if (profile?.role === 'guardian') {
      navigate('/guardian');
    }
  }, [profile, navigate]);

  if (statsLoading || loading || !profile) {
    return <DashboardSkeleton />;
  }

  const showPractice = mobileTab === 'all' || mobileTab === 'practice';
  const showAnalytics = mobileTab === 'all' || mobileTab === 'analytics';
  const showTools = mobileTab === 'all' || mobileTab === 'tools';
  const showSocial = mobileTab === 'all' || mobileTab === 'social';

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 overflow-x-hidden w-full">
      {/* Top Navigation / Header Area */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between w-full max-w-full">
        <h1 className="text-xl font-display font-bold text-foreground truncate">My Dashboard</h1>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="min-w-0 w-full">
          <WelcomeHero profile={profile} stats={stats} />
        </motion.div>

        {/* Daily High-Yield Study Tip Widget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }} className="min-w-0 w-full">
          <DailyStudyTip />
        </motion.div>

        {/* JAMB Score Predictor */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} className="min-w-0 w-full">
          <JambScorePredictorCard history={stats.history} />
        </motion.div>

        {/* Mobile View Filter Tabs - Ensures 100% feature access with easy mobile navigation */}
        <div className="flex lg:hidden overflow-x-auto no-scrollbar gap-2 p-1 bg-muted/60 rounded-xl border border-border w-full max-w-full">
          <button
            onClick={() => setMobileTab('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              mobileTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> All Modules
          </button>
          <button
            onClick={() => setMobileTab('practice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              mobileTab === 'practice'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Practice & Journey
          </button>
          <button
            onClick={() => setMobileTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              mobileTab === 'analytics'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Analytics & Mastery
          </button>
          <button
            onClick={() => setMobileTab('tools')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              mobileTab === 'tools'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Goals & Timers
          </button>
          <button
            onClick={() => setMobileTab('social')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              mobileTab === 'social'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Quests & Community
          </button>
        </div>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
          
          {/* Main Column (Left) */}
          <div className="lg:col-span-8 space-y-6 min-w-0 w-full max-w-full">
            
            {showPractice && (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="min-w-0 w-full">
                  <DailyMission />
                </motion.div>

                {/* Daily Study Planner Component */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.11 }} className="min-w-0 w-full">
                  <DailyStudyPlannerWidget />
                </motion.div>

                {/* Daily Practice Goal Tracker Component */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="min-w-0 w-full">
                  <DailyGoalTracker />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="min-w-0 w-full">
                  <QuickActions />
                </motion.div>

                {/* Visual Study Streak Calendar Component */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }} className="min-w-0 w-full">
                  <StudyStreakCalendar />
                </motion.div>

                {/* Educational Journey Map */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.27 }} className="min-w-0 w-full">
                  <EducationalJourneyMap />
                </motion.div>

                {/* Peer Study Room Live Widget */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }} className="min-w-0 w-full">
                  <PeerStudyRoomWidget />
                </motion.div>

                {/* Adaptive Learning Path Generator */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.29 }} className="min-w-0 w-full">
                  <AdaptiveLearningPathWidget />
                </motion.div>
              </>
            )}
            
            {showAnalytics && (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="min-w-0 w-full">
                  <StatsOverview stats={stats} />
                </motion.div>

                {/* Dashboard Performance Trends & Score Improvement Widget */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.23 }} className="min-w-0 w-full">
                  <DashboardWidget history={stats.history} studentName={profile?.full_name} />
                </motion.div>

                {/* Performance Trend Recharts Line Chart */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="min-w-0 w-full">
                  <PerformanceTrendChart history={stats.history} />
                </motion.div>

                {/* Subject Mastery Radar Chart */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="min-w-0 w-full">
                  <SubjectMasteryRadarChart data={[]} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="min-w-0 w-full">
                  <h2 className="text-xl font-bold font-display mb-4">Study Insights</h2>
                  <AIRecommendations profileId={profile?.id || ''} examsData={stats.history} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="min-w-0 w-full">
                  <ActivityHeatmap />
                </motion.div>
              </>
            )}

            {showSocial && (
              <>
                {/* Milestone Badges & Achievements */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="min-w-0 w-full">
                  <Badges />
                </motion.div>

                {/* Comprehensive Student Achievements Widget */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }} className="min-w-0 w-full">
                  <StudentAchievementsWidget />
                </motion.div>

                {/* Existing Gamification Tab Ported In */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="min-w-0 w-full">
                  <Gamification />
                </motion.div>
              </>
            )}
          </div>

          {/* Sidebar Column (Right on Desktop, or contextual on Mobile) */}
          <div className="lg:col-span-4 space-y-6 min-w-0 w-full max-w-full">
            
            {showSocial && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="min-w-0 w-full">
                <MotivationEngine />
              </motion.div>
            )}

            {showTools && (
              <>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="min-w-0 w-full">
                  <JAMBCountdown />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="min-w-0 w-full">
                  <PomodoroTimer />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="min-w-0 w-full">
                  <StudyGoalTracker />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="min-w-0 w-full">
                  <BurnoutDetector />
                </motion.div>
              </>
            )}

            {showSocial && (
              <>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="min-w-0 w-full">
                  <TournamentPreview />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="min-w-0 w-full">
                  <WeeklyChallenge />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="min-w-0 w-full">
                  <XPProgressPanel />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="min-w-0 w-full">
                  <LeaderboardPreview />
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.8 }} className="min-w-0 w-full">
                  <GuardianConnections />
                </motion.div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
