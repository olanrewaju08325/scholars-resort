import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  Home, PlayCircle, Trophy, BookOpen, CalendarDays, Search, WifiOff, Download, 
  Timer, GraduationCap, HardDrive, LogOut, Users, ShieldAlert, CloudUpload, 
  RefreshCw, MapPin, GitMerge, Video, Menu, X, Compass, Zap, HelpCircle, 
  Layers, Swords, Sparkles, User, ChevronRight, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { StudentLogoutDialog } from '@/components/StudentLogoutDialog';
import { useState, useEffect } from 'react';
import { useSync } from '@/hooks/useSync';
import { getPendingQueueCount, processSyncQueue } from '@/lib/syncQueue';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export const AppLayout = () => {
  const { profile, user } = useAuth();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useSync();

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [drawerOpen]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check pending sync queue items count
    const checkPendingQueue = async () => {
      const count = await getPendingQueueCount();
      setPendingSyncCount(count);
    };

    checkPendingQueue();
    const interval = setInterval(checkPendingQueue, 4000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [drawerOpen]);

  const handleManualSync = async () => {
    if (isOffline) {
      toast.warning('You are currently offline. Connect to internet to sync pending records.');
      return;
    }
    setIsSyncingPending(true);
    toast.info('Syncing offline data to Cloud...');
    await processSyncQueue();
    const newCount = await getPendingQueueCount();
    setPendingSyncCount(newCount);
    setIsSyncingPending(false);
    if (newCount === 0) {
      toast.success('All offline records successfully synced to Supabase!');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const triggerSearch = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  const AUTHORIZED_ADMIN_EMAILS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isAdmin = profile?.role === 'admin' || AUTHORIZED_ADMIN_EMAILS.includes(userEmail);

  // Structured Navigation Groups
  const studentNavGroups = [
    {
      groupTitle: 'LEARN',
      items: [
        { label: 'Dashboard', icon: Home, path: '/dashboard' },
        { label: 'My Learning', icon: MapPin, path: '/journey-map' },
        { label: 'Study Plan', icon: CalendarDays, path: '/plan' },
        { label: 'CBT Practice', icon: Timer, path: '/cbt' },
      ]
    },
    {
      groupTitle: 'PRACTICE',
      items: [
        { label: 'Practice', icon: PlayCircle, path: '/practice' },
        { label: 'Weakness Practice', icon: Zap, path: '/weakness' },
        { label: 'Flashcards', icon: Layers, path: '/flashcards' },
        { label: 'Mock Exams', icon: Sparkles, path: '/mocks' },
      ]
    },
    {
      groupTitle: 'RESOURCES',
      items: [
        { label: 'JAMB Materials', icon: HardDrive, path: '/offline-packs' },
        { label: 'Novel Hub', icon: BookOpen, path: '/novel-hub' },
        { label: 'Resource Library', icon: BookOpen, path: '/library' },
        { label: 'Career & Courses', icon: Compass, path: '/career-guide' },
      ]
    },
    {
      groupTitle: 'COMMUNITY',
      items: [
        { label: 'Study Rooms', icon: Video, path: '/study-rooms' },
        { label: 'Challenges', icon: Swords, path: '/tournaments' },
        { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
      ]
    },
    {
      groupTitle: 'ACCOUNT',
      items: [
        { label: 'Profile', icon: User, path: '/profile' },
        { label: 'Support', icon: HelpCircle, path: '/support' },
      ]
    }
  ];

  const activeNavGroups = studentNavGroups;

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <CommandPalette />
      
      {/* ========================================================================= */}
      {/* Desktop Sidebar (Persistent)                                              */}
      {/* ========================================================================= */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col sticky top-0 h-screen z-40">
        <div className="p-5 pb-3 space-y-3">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold font-display text-primary">
            <img src="/scholar.jpg" alt="Scholars Resort" className="w-8 h-8 rounded-lg object-cover border border-primary/20 shadow-sm" />
            <span className="truncate">Scholars Resort</span>
          </Link>

          {/* Sync Pending Badge (Desktop) */}
          {pendingSyncCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncingPending}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all shadow-sm group"
              title="Click to process pending offline sync queue"
            >
              <div className="flex items-center gap-2">
                <CloudUpload className={`w-3.5 h-3.5 ${isSyncingPending ? 'animate-bounce' : 'text-amber-500'}`} />
                <span>Sync Pending ({pendingSyncCount})</span>
              </div>
              <RefreshCw className={`w-3 h-3 ${isSyncingPending ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
            </button>
          )}

          {/* Quick Search trigger */}
          <button 
            onClick={triggerSearch}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border/60 bg-muted/30 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span>Quick Search...</span>
            </div>
            <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[9px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
        
        {/* Navigation Sections */}
        <nav className="flex-1 px-3 space-y-4 overflow-y-auto custom-scrollbar pb-4">
          {isAdmin && (
            <div className="mb-2">
              <Link 
                to="/scholarresortadmin@benedict" 
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isActive('/scholarresortadmin@benedict')
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                    : 'bg-red-500/5 text-red-500/90 hover:bg-red-500/10 border-red-500/20'
                }`}
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                <span className="truncate">Admin Command Center</span>
              </Link>
            </div>
          )}

          {activeNavGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {group.groupTitle}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        active 
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card & Logout Footer (Desktop) */}
        <div className="p-3 border-t border-border bg-card">
          <div className="flex items-center justify-between gap-1 mb-2 px-1">
            <NotificationBell />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={() => setShowLogoutDialog(true)}
                title="Student Account & Log Out"
                aria-label="Student Account and Logout"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button 
            onClick={() => setShowLogoutDialog(true)} 
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left hover:bg-muted transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase shadow-xs shrink-0">
              {profile?.full_name?.substring(0,2) || 'ST'}
            </div>
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{profile?.full_name || 'Scholar Student'}</span>
              <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
            </div>
            <LogOut className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive transition-colors shrink-0" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* Compact Mobile Header (Sticky)                                            */}
      {/* ========================================================================= */}
      <div className="md:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-3 py-2 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1 text-foreground hover:bg-muted active:bg-muted/80 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <Link to="/" className="flex items-center gap-2 font-bold text-primary text-sm font-display truncate">
            <img src="/scholar.jpg" alt="Scholars Resort" className="w-6 h-6 rounded-md object-cover border border-primary/20 shrink-0" />
            <span className="truncate">Scholars Resort</span>
          </Link>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Search Icon Button */}
          <button
            onClick={triggerSearch}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Search (⌘K)"
            aria-label="Quick Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Pending Sync Icon */}
          {pendingSyncCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncingPending}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold"
              title="Click to sync offline changes"
            >
              <CloudUpload className={`w-3 h-3 ${isSyncingPending ? 'animate-bounce' : 'text-amber-500'}`} />
              <span>{pendingSyncCount}</span>
            </button>
          )}

          <NotificationBell />
          <ThemeToggle />

          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[11px] uppercase ml-0.5 shrink-0"
            aria-label="Account and Logout"
          >
            {profile?.full_name?.substring(0,2) || 'ST'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Mobile Slide-Over Drawer Navigation Menu                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Slide-over Drawer Panel */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative w-[85%] max-w-[320px] bg-card border-r border-border h-full flex flex-col shadow-2xl z-10 overflow-hidden"
            >
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <Link to="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5 font-bold text-primary text-base font-display">
                  <img src="/scholar.jpg" alt="Scholars Resort" className="w-7 h-7 rounded-lg object-cover border border-primary/20 shadow-xs" />
                  <span>Scholars Resort</span>
                </Link>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close navigation drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Quick Card */}
              <div className="p-3.5 mx-3 mt-3 rounded-2xl bg-muted/40 border border-border/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs uppercase shadow-xs shrink-0">
                    {profile?.full_name?.substring(0,2) || 'ST'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{profile?.full_name || 'Scholar Student'}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{user?.email}</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-primary mt-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {isAdmin ? 'Administrator' : 'UTME Candidate'}
                    </span>
                  </div>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 transition-colors shrink-0"
                  title="View Profile"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Pending Sync Alert inside Drawer */}
              {pendingSyncCount > 0 && (
                <div className="mx-3 mt-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncingPending}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CloudUpload className={`w-4 h-4 ${isSyncingPending ? 'animate-bounce' : 'text-amber-500'}`} />
                      <span>Sync Pending ({pendingSyncCount})</span>
                    </div>
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPending ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}

              {/* Drawer Navigation Links */}
              <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-scrollbar">
                {/* Search Shortcut in drawer */}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    triggerSearch();
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground bg-muted/40 hover:bg-muted border border-border/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>Search all resources & topics</span>
                  </div>
                  <span className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">⌘K</span>
                </button>

                {isAdmin && (
                  <div>
                    <Link 
                      to="/scholarresortadmin@benedict" 
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        isActive('/scholarresortadmin@benedict')
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          : 'bg-red-500/5 text-red-500/90 hover:bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate">Admin Command Center</span>
                    </Link>
                  </div>
                )}

                {activeNavGroups.map((group) => (
                  <div key={group.groupTitle} className="space-y-1">
                    <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {group.groupTitle}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.path);
                        return (
                          <Link 
                            key={item.path}
                            to={item.path} 
                            onClick={() => setDrawerOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                              active 
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80'
                            }`}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Drawer Bottom Footer */}
              <div className="p-3 border-t border-border bg-card space-y-2">
                {deferredPrompt && (
                  <button 
                    onClick={() => {
                      handleInstallClick();
                      setDrawerOpen(false);
                    }} 
                    className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Install Scholars App
                  </button>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <span className="text-[11px] text-muted-foreground font-medium">Theme</span>
                  </div>

                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      setShowLogoutDialog(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Main Content Area                                                         */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto overflow-y-auto relative">
        {isOffline && (
          <div className="w-full bg-destructive text-destructive-foreground text-center py-2 text-sm font-medium flex items-center justify-center gap-2 z-50 sticky top-0">
            <WifiOff className="w-4 h-4" /> You are currently offline. Some features may be unavailable.
          </div>
        )}
        
        {deferredPrompt && !drawerOpen && (
          <div className="md:hidden m-3 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
            <div className="text-xs">
              <p className="font-bold text-primary">Install Scholars Resort App</p>
              <p className="text-muted-foreground text-[11px]">Faster offline access and instant notifications</p>
            </div>
            <button onClick={handleInstallClick} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs">
              <Download className="w-3.5 h-3.5" /> Install
            </button>
          </div>
        )}

        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
      
      {/* Student Account & Logout Modal */}
      <StudentLogoutDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} />

      {/* ========================================================================= */}
      {/* Mobile Bottom Navigation Bar (Persistent on Mobile)                       */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around py-1.5 px-1 shadow-lg">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link
          to="/cbt"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isActive('/cbt') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Timer className="w-5 h-5" />
          <span>CBT</span>
        </Link>
        <Link
          to="/practice"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isActive('/practice') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PlayCircle className="w-5 h-5" />
          <span>Practice</span>
        </Link>
        <Link
          to="/plan"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isActive('/plan') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span>Study Plan</span>
        </Link>
        <Link
          to="/weakness"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isActive('/weakness') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span>AI Tutor</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all text-muted-foreground hover:text-foreground`}
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};

