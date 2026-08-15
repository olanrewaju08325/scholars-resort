import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { syncWithSupabase } from './lib/sync';
import { AppLayout } from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Lazy-loaded pages
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CBTCenter = lazy(() => import('./pages/CBTCenter'));
const CBTExam = lazy(() => import('./pages/CBTExam'));
const Results = lazy(() => import('./pages/Results'));
const Admin = lazy(() => import('./pages/Admin'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Help = lazy(() => import('./pages/Help'));
const Features = lazy(() => import('./pages/Features'));
const Profile = lazy(() => import('./pages/Profile'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AcceptableUse = lazy(() => import('./pages/AcceptableUse'));
const PracticeSetup = lazy(() => import('./pages/PracticeSetup'));
const PracticeSession = lazy(() => import('./pages/PracticeSession'));
const GuardianPortal = lazy(() => import('./pages/GuardianPortal'));
const GuardianLanding = lazy(() => import('./pages/GuardianLanding'));
const GuardianConnect = lazy(() => import('./pages/GuardianConnect'));
const CareerGuide = lazy(() => import('./pages/CareerGuide'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Library = lazy(() => import('./pages/Library'));
const WeeklyMocks = lazy(() => import('./pages/WeeklyMocks'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const StudyPlan = lazy(() => import('./pages/StudyPlan'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const WeaknessDrill = lazy(() => import('./pages/WeaknessDrill'));
const Support = lazy(() => import('./pages/Support'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentArena = lazy(() => import('./pages/TournamentArena'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { WhatsAppWidget } from './components/WhatsAppWidget';
import { GlobalSearch } from './components/GlobalSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';

function AppContent() {
  const { loading } = useAuth();
  
  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online. Triggering background sync...');
      syncWithSupabase();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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
          <Route path="/guardian-info" element={<GuardianLanding />} />
          <Route path="/guardian-connect" element={<GuardianConnect />} />
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
              <Route path="/profile" element={<Profile />} />
              <Route path="/plan" element={<StudyPlan />} />
              <Route path="/practice" element={<PracticeSetup />} />
              <Route path="/guardian" element={<GuardianPortal />} />
              <Route path="/career-guide" element={<CareerGuide />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/library" element={<Library />} />
              <Route path="/mocks" element={<WeeklyMocks />} />
              <Route path="/weakness" element={<WeaknessDrill />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/support" element={<Support />} />
              <Route path="/tournaments" element={<Tournaments />} />
            </Route>

            {/* Fullscreen / Immersive Pages (No Navigation) */}
            <Route path="/exam" element={<CBTExam />} />
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

function App() {
  return (
    <ThemeProvider>
      <Router>
        <ErrorBoundary>
          <AuthProvider>
            <MaintenanceGuard>
              <Toaster richColors position="top-right" />
              <AppContent />
              <WhatsAppWidget />
              <GlobalSearch />
              <InstallPrompt />
              <OfflineIndicator />
            </MaintenanceGuard>
          </AuthProvider>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App;
