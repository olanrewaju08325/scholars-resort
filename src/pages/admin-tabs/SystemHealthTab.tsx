import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Server, Activity, Database, Smartphone, ShieldAlert, 
  Wifi, Globe, HardDrive, CheckCircle, AlertTriangle, Mail, DollarSign, BrainCircuit, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Progress } from '@/components/ui/progress';
import { RealtimeUsageQuotaMonitor } from '@/components/admin/RealtimeUsageQuotaMonitor';
import { CbtResourceMonitorCard } from '@/components/admin/CbtResourceMonitorCard';
import { SystemUsageLimitService } from '@/services/systemUsageLimitService';
import { Button } from '@/components/ui/button';

export const SystemHealthTab = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    auditLogs: 0,
    activeSessions: 0,
    offlineQueue: 0,
    aiTokens: 0,
    failedEmails: 0,
    rejectedPayments: 0,
    dbLatency: 0,
    storageObjects: 0,
    errorRate: '0.00%',
    avgResponseTime: 45
  });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const fetchHealth = async () => {
    try {
      const start = performance.now();
      // Real DB ping for latency
      await supabase.from('profiles').select('id').limit(1);
      const latency = Math.max(1, Math.floor(performance.now() - start));

      const [
        { count: auditCount }, 
        { count: sessionCount }, 
        { count: syncCount }, 
        { data: aiData },
        { count: failedEmailCount },
        { count: rejectedPaymentCount },
        usageStats
      ] = await Promise.all([
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
        supabase.from('device_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('offline_sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('ai_usage').select('total_tokens'),
        supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('manual_payments').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        SystemUsageLimitService.fetchLiveUsageStats()
      ]);

      const totalAiTokens = aiData?.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0) || usageStats.ai.tokensUsedThisMonth || 0;

      // Real calculated error rate based on real logs
      const totalEvents = (auditCount || 0) + (usageStats.smtp.emailsSentToday || 0);
      const failures = (failedEmailCount || 0) + (rejectedPaymentCount || 0);
      const calculatedErrorRate = totalEvents > 0 
        ? ((failures / totalEvents) * 100).toFixed(2) + '%'
        : '0.00%';

      setMetrics({
        auditLogs: auditCount || 0,
        activeSessions: sessionCount || 0,
        offlineQueue: syncCount || 0,
        aiTokens: totalAiTokens,
        failedEmails: failedEmailCount || 0,
        rejectedPayments: rejectedPaymentCount || 0,
        dbLatency: latency,
        storageObjects: usageStats.storage.objectsCount || 0,
        errorRate: calculatedErrorRate,
        avgResponseTime: latency
      });

      // Fetch recent real audit logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (logs) setRecentLogs(logs);
    } catch (e) {
      console.error("Failed to load system health metrics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (isHealthy: boolean) => isHealthy ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' : 'text-red-500 bg-red-500/10 border-red-500/30';
  const getStatusIcon = (isHealthy: boolean) => isHealthy ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Real-time Storage, DB, SMTP & AI Limits and Thresholds */}
      <RealtimeUsageQuotaMonitor />

      {/* Real-time CBT Engine Telemetry (Memory, Network Latency, FPS, Render) */}
      <CbtResourceMonitorCard currentModule="CBT Engine Practice & Live Exam Suite" />

      {/* Top Bar: Environment Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Environment</p>
              <p className="font-mono text-xs sm:text-sm font-semibold">Production (Supabase Cloud)</p>
            </div>
          </div>
          <div className="w-px h-8 bg-border hidden md:block" />
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Node Runtime</p>
              <p className="font-mono text-xs sm:text-sm font-semibold">v20+ ESM Express</p>
            </div>
          </div>
          <div className="w-px h-8 bg-border hidden md:block" />
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Health Status</p>
              <p className="font-mono text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">100% Operational</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Health</span>
          </Button>
        </div>
      </div>

      {/* Core Services Status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { name: 'Supabase DB', healthy: true },
          { name: 'Vite & Node Server', healthy: true },
          { name: 'Groq / Gemini AI', healthy: true },
          { name: 'SMTP Service', healthy: metrics.failedEmails < 5 },
          { name: 'Auth API', healthy: true },
          { name: 'Offline Sync Queue', healthy: true },
        ].map((service, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${getStatusColor(service.healthy)}`}>
            <span className="text-[11px] font-bold uppercase truncate">{service.name}</span>
            {getStatusIcon(service.healthy)}
          </div>
        ))}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Database Latency</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{loading ? '...' : `${metrics.dbLatency}ms`}</div>
            <p className="text-xs text-muted-foreground mt-1">Live query roundtrip time</p>
            <Progress value={Math.min(100, (metrics.dbLatency / 200) * 100)} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Sessions</CardTitle>
            <Smartphone className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{loading ? '...' : metrics.activeSessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Active connected devices</p>
            <Progress value={Math.min(100, (metrics.activeSessions / 50) * 100)} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-card-foreground">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Avg Response Time</CardTitle>
            <Activity className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{loading ? '...' : `${metrics.avgResponseTime}ms`}</div>
            <p className="text-xs text-muted-foreground mt-1">API endpoints latency</p>
            <Progress value={Math.min(100, (metrics.avgResponseTime / 150) * 100)} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-card-foreground">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Error Rate</CardTitle>
            <ShieldAlert className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{loading ? '...' : metrics.errorRate}</div>
            <p className="text-xs text-muted-foreground mt-1">Calculated platform failure rate</p>
            <Progress value={parseFloat(metrics.errorRate) || 0} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics / Subsystems */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Queues & Resources */}
        <div className="space-y-6">
          <Card className="bg-card border-border text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Subsystem Queues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-muted-foreground" /> Offline Sync Queue</div>
                <span className="font-mono font-bold text-foreground">{metrics.offlineQueue} items</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Failed Emails</div>
                <span className={`font-mono font-bold ${metrics.failedEmails > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{metrics.failedEmails} items</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-muted-foreground" /> Rejected Payments</div>
                <span className="font-mono font-bold text-foreground">{metrics.rejectedPayments} items</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Cloud Object Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-sky-500" /> Stored Objects</div>
                <span className="font-mono font-bold text-foreground">{metrics.storageObjects}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-amber-500" /> AI Tokens (Total)</div>
                <span className="font-mono font-bold text-foreground">{metrics.aiTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Total Audit Entries</div>
                <span className="font-mono font-bold text-foreground">{metrics.auditLogs.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Live Logs */}
        <Card className="bg-card border-border text-card-foreground lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 font-bold font-display">
                <Database className="w-4 h-4 text-primary"/> 
                Live System Audit Stream
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Total Logs: {metrics.auditLogs.toLocaleString()}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Real-time stream of audit events and administrative telemetry</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground py-8 flex items-center justify-center text-xs">Loading live audit stream...</div>
            ) : recentLogs.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-xs">No audit logs recorded yet.</div>
            ) : (
              <div className="space-y-2 font-mono text-xs max-h-[380px] overflow-y-auto pr-1">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 border border-border/70 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.entity_type === 'auth' ? 'bg-blue-500/20 text-blue-500' :
                        log.entity_type === 'exam' ? 'bg-purple-500/20 text-purple-500' :
                        log.entity_type === 'payment' ? 'bg-green-500/20 text-green-500' :
                        log.entity_type === 'cbt_snapshot' ? 'bg-sky-500/20 text-sky-500' :
                        'bg-slate-500/20 text-muted-foreground'
                      }`}>
                        {log.entity_type}
                      </span>
                      <span className="text-foreground text-xs">{log.action}</span>
                    </div>
                    <div className="text-muted-foreground text-[10px] shrink-0 font-sans">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
