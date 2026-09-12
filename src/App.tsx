import { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { syncWithSupabase } from './lib/sync';
import { initSyncQueueListeners } from './lib/syncQueue';
import { AppLayout } from './components/layout/AppLayout';
import { lazyWithRetry } from './lib/lazyWithRetry';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Lazy-loaded pages with automated retry and chunk-mismatch auto-recovery
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'), 'ResetPassword');
const NotFound = lazyWithRetry(() => import('./pages/NotFound'), 'NotFound');
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'Dashboard');
const CBTCenter = lazyWithRetry(() => import('./pages/CBTCenter'), 'CBTCenter');
const CBTExam = lazyWithRetry(() => import('./pages/CBTExam'), 'CBTExam');
const Results = lazyWithRetry(() => import('./pages/Results'), 'Results');
const Admin = lazyWithRetry(() => import('./pages/Admin'), 'Admin');
const Pricing = lazyWithRetry(() => import('./pages/Pricing'), 'Pricing');
const Help = lazyWithRetry(() => import('./pages/Help'), 'Help');
const Features = lazyWithRetry(() => import('./pages/Features'), 'Features');
const Profile = lazyWithRetry(() => import('./pages/Profile'), 'Profile');
const Terms = lazyWithRetry(() => import('./pages/Terms'), 'Terms');
const Privacy = lazyWithRetry(() => import('./pages/Privacy'), 'Privacy');
const AcceptableUse = lazyWithRetry(() => import('./pages/AcceptableUse'), 'AcceptableUse');
const PracticeSetup = lazyWithRetry(() => import('./pages/PracticeSetup'), 'PracticeSetup');
const PracticeSession = lazyWithRetry(() => import('./pages/PracticeSession'), 'PracticeSession');
const CareerGuide = lazyWithRetry(() => import('./pages/CareerGuide'), 'CareerGuide');
const Flashcards = lazyWithRetry(() => import('./pages/Flashcards'), 'Flashcards');
const Library = lazyWithRetry(() => import('./pages/Library'), 'Library');
const WeeklyMocks = lazyWithRetry(() => import('./pages/WeeklyMocks'), 'WeeklyMocks');
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard'), 'Leaderboard');
const StudyPlan = lazyWithRetry(() => import('./pages/StudyPlan'), 'StudyPlan');
const ProtectedRoute = lazyWithRetry(() => import('./components/ProtectedRoute'), 'ProtectedRoute');
const WeaknessDrill = lazyWithRetry(() => import('./pages/WeaknessDrill'), 'WeaknessDrill');
const Support = lazyWithRetry(() => import('./pages/Support'), 'Support');
const Tournaments = lazyWithRetry(() => import('./pages/Tournaments'), 'Tournaments');
const TournamentArena = lazyWithRetry(() => import('./pages/TournamentArena'), 'TournamentArena');
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'), 'Onboarding');
const JambNovelHub = lazyWithRetry(() => import('./pages/JambNovelHub').then(m => ({ default: m.JambNovelHub })), 'JambNovelHub');
const CourseEligibilityChecker = lazyWithRetry(() => import('./pages/CourseEligibilityChecker').then(m => ({ default: m.CourseEligibilityChecker })), 'CourseEligibilityChecker');
const OfflinePackManager = lazyWithRetry(() => import('./pages/OfflinePackManager').then(m => ({ default: m.OfflinePackManager })), 'OfflinePackManager');
const EducationalJourneyMapPage = lazyWithRetry(() => import('./pages/EducationalJourneyMapPage'), 'EducationalJourneyMapPage');
const AdaptiveLearningPathPage = lazyWithRetry(() => import('./pages/AdaptiveLearningPathPage'), 'AdaptiveLearningPathPage');
const PeerStudyRoomPage = lazyWithRetry(() => import('./pages/PeerStudyRoomPage'), 'PeerStudyRoomPage');
const Referrals = lazyWithRetry(() => import('./pages/Referrals'), 'Referrals');
const Scholarship = lazyWithRetry(() => import('./pages/Scholarship'), 'Scholarship');
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { WhatsAppWidget } from './components/WhatsAppWidget';
import { GlobalSearch } from './components/GlobalSearch';
import { GlobalShortcutsHandler } from './components/GlobalShortcutsHandler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';

function AppContent() {
  const { loading } = useAuth();
  
  useEffect(() => {
    // Initialize automatic sync listeners for network reconnection & IndexedDB sync queue
    const cleanupSync = initSyncQueueListeners();

    let lastSyncTime = 0;
    const handleOnline = () => {
      const now = Date.now();
      if (now - lastSyncTime < 6000) return;
      lastSyncTime = now;
      console.log('App is online. Triggering background sync...');
      syncWithSupabase();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      cleanupSync();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (loading) return null;

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background text-primary"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/features" element={<Features />} />
          <Route path="/scholarresortadmin@benedict" element={<Admin />} />
          
          {/* Locked Premium Features */}
          <Route element={<ProtectedRoute />}>
            
            {/* Pages with standard navigation (Sidebar & Mobile Bottom Bar) */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cbt" element={<CBTCenter />} />
              <Route path="/cbt-center" element={<CBTCenter />} />
              <Route path="/cbt-exam" element={<CBTCenter />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/plan" element={<StudyPlan />} />
              <Route path="/practice" element={<PracticeSetup />} />
              <Route path="/career-guide" element={<CareerGuide />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/library" element={<Library />} />
              <Route path="/novel-hub" element={<JambNovelHub />} />
              <Route path="/journey-map" element={<EducationalJourneyMapPage />} />
              <Route path="/my-learning" element={<EducationalJourneyMapPage />} />
              <Route path="/adaptive-path" element={<AdaptiveLearningPathPage />} />
              <Route path="/study-rooms" element={<PeerStudyRoomPage />} />
              <Route path="/eligibility-checker" element={<CourseEligibilityChecker />} />
              <Route path="/offline-packs" element={<OfflinePackManager />} />
              <Route path="/mocks" element={<WeeklyMocks />} />
              <Route path="/weakness" element={<WeaknessDrill />} />
              <Route path="/weakness-practice" element={<WeaknessDrill />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/support" element={<Support />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/challenges" element={<Tournaments />} />
              <Route path="/analytics" element={<Leaderboard />} />
              <Route path="/bookmarks" element={<Library />} />
              <Route path="/history" element={<CBTCenter />} />
              <Route path="/ai-tutor" element={<WeaknessDrill />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/scholarship" element={<Scholarship />} />
            </Route>

            {/* Fullscreen / Immersive Pages (No Navigation) */}
            <Route path="/exam" element={<CBTExam />} />
            <Route path="/cbt/full-mock" element={<CBTExam defaultMode="full_mock" />} />
            <Route path="/cbt/past-questions" element={<CBTExam defaultMode="past_questions" />} />
            <Route path="/cbt/ai-mock" element={<CBTExam defaultMode="ai_generated_mock" />} />
            <Route path="/practice/session" element={<PracticeSession />} />
            <Route path="/tournaments/:id" element={<TournamentArena />} />
            <Route path="/results" element={<Results />} />
            
          </Route>
          
          {/* Placeholder Routes */}
          <Route path="/faq" element={<Help />} />
          <Route path="/help" element={<Help />} />
          <Route path="/contact" element={<Help />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/acceptable-use" element={<AcceptableUse />} />
          
          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

import { MaintenanceGuard } from './components/MaintenanceGuard';
import { InterruptedExamPrompt } from './components/InterruptedExamPrompt';
import { AiQuotaStatusModal } from './components/AiQuotaStatusModal';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <ErrorBoundary>
          <AuthProvider>
            <MaintenanceGuard>
              <Toaster richColors position="top-right" />
              <AppContent />
              <InterruptedExamPrompt />
              <WhatsAppWidget />
              <GlobalSearch />
              <GlobalShortcutsHandler />
              <InstallPrompt />
              <OfflineIndicator />
              <AiQuotaStatusModal />
            </MaintenanceGuard>
          </AuthProvider>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App;
