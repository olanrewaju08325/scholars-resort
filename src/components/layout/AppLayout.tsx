import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, PlayCircle, Trophy, BookOpen, CalendarDays, Search, WifiOff, Download, Timer, GraduationCap, HardDrive, LogOut, User, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { StudentLogoutDialog } from '@/components/StudentLogoutDialog';
import { useState, useEffect } from 'react';
import { useSync } from '@/hooks/useSync';

export const AppLayout = () => {
  const { profile, user } = useAuth();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useSync();

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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const studentNavItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard' },
    { label: 'Study Plan', icon: CalendarDays, path: '/plan' },
    { label: 'CBT Center', icon: Timer, path: '/cbt' },
    { label: 'JAMB Novel Hub', icon: BookOpen, path: '/novel-hub' },
    { label: 'Course Eligibility', icon: GraduationCap, path: '/eligibility-checker' },
    { label: 'Offline Packs', icon: HardDrive, path: '/offline-packs' },
    { label: 'Practice', icon: PlayCircle, path: '/practice' },
    { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
    { label: 'Library', icon: BookOpen, path: '/library' }
  ];

  const guardianNavItems = [
    { label: 'Guardian Portal', icon: Users, path: '/guardian' },
    { label: 'JAMB Novel Hub', icon: BookOpen, path: '/novel-hub' },
    { label: 'Course Eligibility', icon: GraduationCap, path: '/eligibility-checker' },
    { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
    { label: 'Library', icon: BookOpen, path: '/library' }
  ];

  const navItems = profile?.role === 'guardian' ? guardianNavItems : studentNavItems;
  const mobileNavItems = profile?.role === 'guardian' ? guardianNavItems : studentNavItems.slice(0, 5);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-[72px] md:pb-0">
      <CommandPalette />
      
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col sticky top-0 h-screen z-40">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 text-xl font-bold font-display text-primary">
            <img src="/scholar.jpg" alt="Scholars Resort" className="w-8 h-8 rounded-lg object-cover border border-primary/20 shadow-sm" />
            <span>Scholars Resort</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                isActive(item.path) 
                  ? 'bg-primary text-primary-foreground shadow-premium shadow-primary/20' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" /> {item.label}
            </Link>
          ))}
          
          <button 
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="w-full mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 border border-border/50 bg-background/50 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5" />
              <span>Search</span>
            </div>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </nav>

        <div className="p-4 border-t border-border bg-card">
           <div className="flex items-center justify-between gap-2 px-2 mb-3">
             <NotificationBell />
             <div className="flex items-center gap-1">
               <ThemeToggle />
               <button
                 onClick={() => setShowLogoutDialog(true)}
                 title="Student Account & Log Out"
                 aria-label="Student Account and Logout"
                 className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
               >
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
           </div>

           <button 
             onClick={() => setShowLogoutDialog(true)} 
             className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-muted transition-colors group"
           >
             <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase shadow-sm">
               {profile?.full_name?.substring(0,2) || 'ST'}
             </div>
             <div className="flex flex-col overflow-hidden flex-1">
               <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{profile?.full_name || 'Scholar Student'}</span>
               <span className="text-[11px] text-muted-foreground truncate">{user?.email}</span>
             </div>
             <LogOut className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive transition-colors shrink-0" />
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto overflow-y-auto relative">
        {/* Mobile Header Bar */}
        <div className="md:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary text-sm font-display">
            <img src="/scholar.jpg" alt="Scholars Resort" className="w-6 h-6 rounded-md object-cover" />
            <span>Scholars Resort</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase"
              aria-label="Account and Logout"
            >
              {profile?.full_name?.substring(0,2) || 'ST'}
            </button>
          </div>
        </div>
        {isOffline && (
          <div className="w-full bg-destructive text-destructive-foreground text-center py-2 text-sm font-medium flex items-center justify-center gap-2 z-50 sticky top-0">
            <WifiOff className="w-4 h-4" /> You are currently offline. Some features may be unavailable.
          </div>
        )}
        
        {deferredPrompt && (
          <div className="md:hidden m-4 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
            <div className="text-sm">
              <p className="font-bold text-primary">Install App</p>
              <p className="text-muted-foreground text-xs">For a better, faster experience</p>
            </div>
            <button onClick={handleInstallClick} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <Download className="w-4 h-4" /> Install
            </button>
          </div>
        )}

        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-card border-t border-border z-50 flex items-center justify-around px-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
        {mobileNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className="flex flex-col items-center justify-center w-16 h-full gap-1"
            >
              <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all duration-300 ${
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}>
                <item.icon className={`h-5 w-5 transition-transform duration-300 ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      
      {/* Student Account & Logout Modal */}
      <StudentLogoutDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} />
    </div>
  );
};
