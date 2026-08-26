import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, Users, Zap, BookOpen, TrendingUp, Calendar, Trophy, ArrowUpRight, ArrowDownRight, Server, Database, AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { toast } from 'sonner';
import { DashboardOverview } from '@/components/admin/DashboardOverview';
import { OrphanedEntriesScanner } from '@/components/admin/OrphanedEntriesScanner';
import { QuickStats } from '@/components/admin/QuickStats';
import { GroqLiveQuotaWidget } from '@/components/GroqLiveQuotaWidget';
import { FlowValidatorStatusWidget } from '@/components/admin/FlowValidatorStatusWidget';
import { FlowValidatorTestCoverageCard } from '@/components/admin/FlowValidatorTestCoverageCard';
import { FlowValidatorHistoricalChart } from '@/components/admin/FlowValidatorHistoricalChart';
import { CbtResourceMonitorCard } from '@/components/admin/CbtResourceMonitorCard';
import { RealtimeUsageQuotaMonitor } from '@/components/admin/RealtimeUsageQuotaMonitor';
import { CbtSessionSnapshotViewer } from '@/components/admin/CbtSessionSnapshotViewer';
import { getSubjectQuestionCountsAggregation } from '@/utils/subjectUtils';

export const DashboardTab = () => {
  const [stats, setStats] = useState({
    students: 0,
    studentGrowth: 0,
    revenue: 0,
    revenueGrowth: 0,
    questions: 0,
    examsTaken: 0,
    tournamentsLive: 0,
    pendingPayments: 0,
    openTickets: 0
  });
  
  const [systemHealth, setSystemHealth] = useState({
    edgeFunctions: 'Healthy',
    database: 'Healthy',
    storage: '34%',
    smtp: 'Online'
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [liveUsers, setLiveUsers] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const fetchLiveUsers = async () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    const { data } = await supabase
      .from('device_sessions')
      .select('user_id')
      .gte('last_active', fifteenMinsAgo);
    
    if (data) {
      const uniqueUsers = new Set(data.map(d => d.user_id));
      setLiveUsers(uniqueUsers.size);
    }
  };

  const fetchDashboardData = async () => {
    try {
      fetchLiveUsers();

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      // Core Stats
      const [{ count: currentStudents }, { count: lastWeekStudents }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').lt('created_at', oneWeekAgo)
      ]);
      const stGrowth = lastWeekStudents && currentStudents ? ((currentStudents - lastWeekStudents) / lastWeekStudents) * 100 : 0;

      // Revenue
      const { data: allPayments } = await supabase.from('manual_payments').select('amount, created_at').eq('status', 'approved');
      const totalRev = allPayments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      
      const thisMonthRev = allPayments?.filter(p => new Date(p.created_at) > new Date(thirtyDaysAgo)).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const lastMonthRev = allPayments?.filter(p => {
        const d = new Date(p.created_at);
        return d <= new Date(thirtyDaysAgo) && d > new Date(sixtyDaysAgo);
      }).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      const revGrowth = lastMonthRev ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : (thisMonthRev > 0 ? 100 : 0);

      // Operational Telemetry
      const [
        aggResult,
        { count: examsCount },
        { count: tLiveCount },
        { count: pendingPayCount },
        { count: ticketsCount }
      ] = await Promise.all([
        getSubjectQuestionCountsAggregation(),
        supabase.from('exam_sessions').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('manual_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open')
      ]);

      setStats({
        students: currentStudents || 0,
        studentGrowth: stGrowth,
        revenue: totalRev,
        revenueGrowth: revGrowth,
        questions: aggResult.totalQuestions || 0,
        examsTaken: examsCount || 0,
        tournamentsLive: tLiveCount || 0,
        pendingPayments: pendingPayCount || 0,
        openTickets: ticketsCount || 0
      });

      // Chart Data
      const { data: recentProfiles } = await supabase.from('profiles').select('created_at').gte('created_at', oneWeekAgo);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const newChartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const daySignups = recentProfiles?.filter(p => p.created_at.startsWith(dateString)).length || 0;
        const dayRevenue = allPayments?.filter(p => p.created_at.startsWith(dateString)).reduce((sum, curr) => sum + Number(curr.amount), 0) || 0;
        newChartData.push({ name: days[d.getDay()], signups: daySignups, revenue: dayRevenue });
      }
      setChartData(newChartData);

      // System Logs
      const { data: logs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(6);
      if (logs) setRecentLogs(logs);

    } catch(e) {
      console.error("Dashboard failed", e);
      toast.error("Failed to load telemetry data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchLiveUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
           <h2 className="text-3xl font-bold font-display text-foreground">ScholarsOS Dashboard</h2>
           <p className="text-muted-foreground">System Telemetry & Platform Overview</p>
         </div>
         <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-xs">
           <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-sm font-medium border border-emerald-500/20">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             {liveUsers} Online Now
           </div>
         </div>
      </div>

      {/* Real-time System Storage, Database, SMTP & AI Quota Monitor & Limits */}
      <RealtimeUsageQuotaMonitor />

      {/* CBT Engine Browser Memory & Network Latency Resource Monitor */}
      <CbtResourceMonitorCard currentModule="CBT Engine Practice & Exam Suite" />

      {/* CBT Session Snapshot Inspector & Reproduction Player */}
      <CbtSessionSnapshotViewer />

      {/* Real-time FlowValidator Engine Status */}
      <FlowValidatorStatusWidget />

      {/* CBT Test Coverage Summary Card */}
      <FlowValidatorTestCoverageCard />

      {/* Historical Reliability Trend Chart (30-Day Recharts Engine) */}
      <FlowValidatorHistoricalChart />

      {/* Real-time QuickStats Repository Counters */}
      <QuickStats />

      {/* Groq Live Quota Real-Time Monitor */}
      <GroqLiveQuotaWidget />

      {/* Recharts Analytics Dashboard Overview */}
      <DashboardOverview />

      {/* Orphaned Entries Cleaner & Cron Audit */}
      <OrphanedEntriesScanner />

      {/* Top Metrics Row: Seamless single column on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100 hover:border-blue-500/50 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400">Total Revenue</CardTitle>
            <Activity className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono">{loading ? '...' : `₦${stats.revenue.toLocaleString()}`}</div>
            <p className={`text-xs flex items-center gap-1 mt-2 ${stats.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(stats.revenueGrowth).toFixed(1)}% MoM
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100 hover:border-blue-500/50 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400">Active Students</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono">{loading ? '...' : stats.students.toLocaleString()}</div>
            <p className={`text-xs flex items-center gap-1 mt-2 ${stats.studentGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.studentGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(stats.studentGrowth).toFixed(1)}% vs last week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100 hover:border-blue-500/50 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400">Platform Activity</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono">{loading ? '...' : stats.examsTaken.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-2">Total exams submitted</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100 hover:border-blue-500/50 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400">Live Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono">{loading ? '...' : stats.tournamentsLive}</div>
            <p className="text-xs text-yellow-400/80 mt-2 animate-pulse">Running right now</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Telemetry row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* System Health */}
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 col-span-1 text-slate-100">
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5 text-blue-400"/> System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
               <span className="flex items-center gap-2 text-sm"><ShieldCheck className="w-4 h-4 text-green-400"/> Database</span>
               <span className="text-sm font-mono text-green-400">{systemHealth.database}</span>
             </div>
             <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
               <span className="flex items-center gap-2 text-sm"><Zap className="w-4 h-4 text-green-400"/> Edge Functions</span>
               <span className="text-sm font-mono text-green-400">{systemHealth.edgeFunctions}</span>
             </div>
             <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
               <span className="flex items-center gap-2 text-sm"><Database className="w-4 h-4 text-blue-400"/> Storage Bucket</span>
               <span className="text-sm font-mono text-blue-400">{systemHealth.storage}</span>
             </div>
             <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
               <span className="flex items-center gap-2 text-sm"><Activity className="w-4 h-4 text-green-400"/> SMTP Relay</span>
               <span className="text-sm font-mono text-green-400">{systemHealth.smtp}</span>
             </div>
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 col-span-1 lg:col-span-2 text-slate-100">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Growth & Revenue</CardTitle>
            <CardDescription className="text-slate-400">7-day performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="signups" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSignups)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Admin Alerts */}
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-amber-500" /> Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             {stats.pendingPayments > 0 ? (
               <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex justify-between items-center">
                 <div>
                   <h4 className="font-medium text-amber-400">{stats.pendingPayments} Pending Payments</h4>
                   <p className="text-sm text-slate-400">Require manual verification</p>
                 </div>
                 <button className="px-3 py-1 bg-amber-500 text-slate-950 font-medium rounded-md text-sm">Verify</button>
               </div>
             ) : (
               <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-sm">No pending payments.</div>
             )}

             {stats.openTickets > 0 ? (
               <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex justify-between items-center">
                 <div>
                   <h4 className="font-medium text-blue-400">{stats.openTickets} Open Support Tickets</h4>
                   <p className="text-sm text-slate-400">Students waiting for a response</p>
                 </div>
                 <button className="px-3 py-1 bg-blue-500 text-white font-medium rounded-md text-sm">Resolve</button>
               </div>
             ) : (
               <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-sm">Inbox zero!</div>
             )}
          </CardContent>
        </Card>

        {/* Global Activity Feed */}
        <Card className="bg-slate-900/50 backdrop-blur-md border-slate-800 text-slate-100 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Live Telemetry Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-800">
               {recentLogs.length > 0 ? recentLogs.map((log) => (
                 <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                   <div className="flex flex-col">
                     <span className="text-sm font-medium">{log.action.replace(/_/g, ' ').toUpperCase()}</span>
                     <span className="text-xs text-slate-400">{log.profiles?.full_name || 'System'}</span>
                   </div>
                   <span className="text-xs text-slate-500 font-mono">
                     {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </span>
                 </div>
               )) : (
                 <div className="p-6 text-center text-slate-500 text-sm">No recent activity detected.</div>
               )}
             </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
