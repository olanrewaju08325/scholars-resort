import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, Users, BookOpen, FileQuestion, CreditCard, 
  Settings, Activity, ShieldAlert, LogOut, ChevronLeft, ChevronRight, 
  Search, Bell, Plus, MessageSquare, Menu, Sparkles, Trophy,
  BarChart, List, Shield, DatabaseBackup, Megaphone, Mail, DollarSign, Gift, Calendar, Network, Globe, Brain, Swords, Key, Trash2
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Sub-modules
import { DashboardTab } from './admin-tabs/DashboardTab';
import { StudentsTab } from './admin-tabs/StudentsTab';
import { QuestionBankTab } from './admin-tabs/QuestionBankTab';
import { PaymentsTab } from './admin-tabs/PaymentsTab';
import { SystemHealthTab } from './admin-tabs/SystemHealthTab';
import { SettingsTab } from './admin-tabs/SettingsTab';
import { SubjectsTab } from './admin-tabs/SubjectsTab';
import { SupportTab } from './admin-tabs/SupportTab';
import { AdminTournamentsTab } from './admin-tabs/AdminTournamentsTab';
import { AdminAITab } from './admin-tabs/AdminAITab';
import { AnalyticsTab } from './admin-tabs/AnalyticsTab';
import { LogsTab } from './admin-tabs/LogsTab';
import { BackupsTab } from './admin-tabs/BackupsTab';
import { AnnouncementsTab } from './admin-tabs/AnnouncementsTab';
import { BulkEmailTab } from './admin-tabs/BulkEmailTab';
import { RevenueReportingTab } from './admin-tabs/RevenueReportingTab';
import { StudentInsightsTab } from './admin-tabs/StudentInsightsTab';
import { ScholarshipTab } from './admin-tabs/ScholarshipTab';
import { ContentCalendarTab } from './admin-tabs/ContentCalendarTab';
import { ReferralTab } from './admin-tabs/ReferralTab';
import { TelemetryTab } from './admin-tabs/TelemetryTab';
import { AIPromptStudioTab } from './admin-tabs/AIPromptStudioTab';
import { SecurityTab } from './admin-tabs/SecurityTab';
import { WeeklyChallengesAdminTab } from './admin-tabs/WeeklyChallengesAdminTab';
import { ContentStudioTab } from './admin-tabs/ContentStudioTab';
import { PlatformHealthTab } from './admin-tabs/PlatformHealthTab';
import { AIKeysTab } from './admin-tabs/AIKeysTab';
import { AdminErrorBoundary } from '@/components/AdminErrorBoundary';
import { initAdminOfflineSync } from '@/services/offlineSyncService';
import { MaterialsTab } from './admin-tabs/MaterialsTab';
import { AdminLiteratureTab } from './admin-tabs/AdminLiteratureTab';
import { DatabaseDiagnosticsTab } from './admin-tabs/DatabaseDiagnosticsTab';
import { EnvironmentCleanupTab } from './admin-tabs/EnvironmentCleanupTab';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminNotificationSystem } from '@/components/admin/AdminNotificationSystem';
import { AdminThemeToggle } from '@/components/admin/AdminThemeToggle';
import { AdminSessionTimeout } from '@/components/admin/AdminSessionTimeout';

export default function Admin() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize offline sync queue listener
  useEffect(() => {
    initAdminOfflineSync();
  }, []);

  // Command Palette Simulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const AUTHORIZED_ADMIN_EMAILS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];
  const isAdmin = profile?.role === 'admin' || 
                  (profile?.email && AUTHORIZED_ADMIN_EMAILS.includes(profile.email.toLowerCase().trim())) || 
                  (user?.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase().trim()));

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">You require Enterprise Administrator privileges to access the Command Center.</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }


  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'bulk-email', label: 'Bulk Email', icon: Mail },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'scholarships', label: 'Scholarships', icon: Gift },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'referrals', label: 'Referrals', icon: Network },
    { id: 'telemetry', label: 'Platform Telemetry', icon: Globe },
    { id: 'ai-studio', label: 'AI Prompt Studio', icon: Brain },
    { id: 'ai-keys', label: 'AI Provider Keys', icon: Key },
    { id: 'weekly-challenges', label: 'Weekly Challenges', icon: Swords },
    { id: 'insights', label: 'Student Insights', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
    { id: 'security', label: 'Security', icon: ShieldAlert },
    { id: 'students', label: 'Users & Guardians', icon: Users },
    { id: 'materials', label: 'Library Resource Manager', icon: BookOpen },
    { id: 'literature', label: 'Literature & Novel Hub', icon: BookOpen },
    { id: 'subjects', label: 'Subjects & Topics', icon: BookOpen },
    { id: 'content-studio', label: 'Content Studio', icon: FileQuestion },
    { id: 'questions', label: 'Question Bank', icon: FileQuestion },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'payments', label: 'Admin Payments', icon: CreditCard },
    { id: 'support', label: 'Support Center', icon: MessageSquare },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'logs', label: 'Audit Logs', icon: List },
    { id: 'backups', label: 'Backups', icon: DatabaseBackup },
    { id: 'db-diagnostics', label: 'Database Diagnostic Suite', icon: Activity },
    { id: 'env-cleanup', label: 'Environment Cleanup', icon: Trash2 },
    { id: 'smtp-health', label: 'SMTP Health Check', icon: Mail },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'platform-health', label: 'Platform Monitor', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderModule = () => {
    switch(activeModule) {
      case 'dashboard': return <DashboardTab />;
      case 'announcements': return <AnnouncementsTab />;
      case 'bulk-email': return <BulkEmailTab />;
      case 'revenue': return <RevenueReportingTab />;
      case 'scholarships': return <ScholarshipTab />;
      case 'calendar': return <ContentCalendarTab />;
      case 'referrals': return <ReferralTab />;
      case 'telemetry': return <TelemetryTab />;
      case 'ai-studio': return <AIPromptStudioTab />;
      case 'ai-keys': return <AIKeysTab />;
      case 'weekly-challenges': return <WeeklyChallengesAdminTab />;
      case 'insights': return <StudentInsightsTab />;
      case 'analytics': return <AnalyticsTab />;
      case 'security': return <SecurityTab />;
      case 'students': return <StudentsTab />;
      case 'materials': return <MaterialsTab />;
      case 'literature': return <AdminLiteratureTab />;
      case 'subjects': return <SubjectsTab />;
      case 'content-studio': return <ContentStudioTab />;
      case 'questions': return <QuestionBankTab />;
      case 'payments': return <PaymentsTab />;
      case 'smtp-health': return <SettingsTab />;
      case 'health': return <SystemHealthTab />;
      case 'platform-health': return <PlatformHealthTab />;
      case 'support': return <SupportTab />;
      case 'settings': return <SettingsTab />;
      case 'tournaments': return <AdminTournamentsTab />;
      case 'ai': return <AdminAITab />;
      case 'logs': return <LogsTab />;
      case 'backups': return <BackupsTab />;
      case 'db-diagnostics': return <DatabaseDiagnosticsTab />;
      case 'env-cleanup': return <EnvironmentCleanupTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!isSidebarCollapsed && (
            <span className="font-display font-bold text-lg flex items-center gap-2 text-primary">
              <ShieldAlert className="w-5 h-5" /> Admin OS
            </span>
          )}
          {isSidebarCollapsed && <ShieldAlert className="w-6 h-6 text-primary mx-auto" />}
          <Button variant="ghost" size="icon" aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex">
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium
                ${activeModule === item.id 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
                ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}
              `}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 ${activeModule === item.id ? 'text-primary' : ''}`} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-border">
          <Button variant="ghost" onClick={signOut} className={`w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}>
            <LogOut className="w-5 h-5" />
            {!isSidebarCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 border-b border-border bg-card">
        <span className="font-display font-bold text-lg text-primary flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Admin OS
        </span>
        <Button variant="ghost" size="icon" aria-label="Toggle mobile menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu className="w-6 h-6" />
        </Button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full h-[calc(100vh-4rem)] bg-background z-50 overflow-y-auto border-b border-border">
          <nav className="p-4 space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveModule(item.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium
                  ${activeModule === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground bg-card border border-border'}
                `}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
            <Button variant="destructive" onClick={signOut} className="w-full mt-4 gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-muted/20">
        
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-background min-w-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                id="global-search"
                placeholder="Search anything... (Ctrl+K)" 
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="hidden lg:flex items-center gap-2 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Student Dashboard
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/guardian')}
              className="hidden lg:flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Users className="w-3.5 h-3.5" /> Guardian Portal
            </Button>
            <AdminSessionTimeout timeoutMinutes={15} warningSeconds={60} />
            <AdminThemeToggle />
            <AdminNotificationSystem onNavigate={(module) => setActiveModule(module)} />
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm uppercase ml-2 border border-primary/30" aria-label="User Profile">
              {profile?.full_name?.substring(0,2) || 'AD'}
            </div>
          </div>
        </header>
        
        {/* Module Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-w-0 w-full p-4 md:p-8">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <span>Admin</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium capitalize">{activeModule.replace('-', ' ')}</span>
          </div>
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-w-0 w-full">
            <AdminErrorBoundary key={activeModule} fallbackTitle={`Error rendering ${activeModule.replace('-', ' ')} module`}>
              {renderModule()}
            </AdminErrorBoundary>
          </div>
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
