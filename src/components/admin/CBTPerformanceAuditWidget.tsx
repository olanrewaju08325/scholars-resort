import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Zap, AlertTriangle, RefreshCw, Trash2, CheckCircle2, Server, Cpu } from 'lucide-react';
import { CBTPerformanceAuditService, type PerformanceMetricLog, type CategoryPerformanceSummary } from '@/services/cbtPerformanceAuditService';
import { toast } from 'sonner';

export const CBTPerformanceAuditWidget: React.FC = () => {
  const [logs, setLogs] = useState<PerformanceMetricLog[]>([]);
  const [summaries, setSummaries] = useState<CategoryPerformanceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshData = () => {
    setLoading(true);
    const currentLogs = CBTPerformanceAuditService.getLogs();
    const currentSummaries = CBTPerformanceAuditService.getCategorySummaries();
    setLogs(currentLogs);
    setSummaries(currentSummaries);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('scholars:cbt-perf-update', handleUpdate);
    return () => window.removeEventListener('scholars:cbt-perf-update', handleUpdate);
  }, []);

  const handleClear = () => {
    CBTPerformanceAuditService.clearLogs();
    refreshData();
    toast.success('Cleared CBT performance audit logs');
  };

  const totalLogs = logs.length;
  const slowLogs = logs.filter(l => l.isSlow);
  const avgLatency = totalLogs > 0 ? Math.round(logs.reduce((acc, curr) => acc + curr.apiLatencyMs, 0) / totalLogs) : 0;
  const avgRender = totalLogs > 0 ? Math.round(logs.reduce((acc, curr) => acc + curr.uiRenderTimeMs, 0) / totalLogs) : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
              CBT Engine Performance & Latency Audit
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Logs real-time CBT question render speeds and API network response times per question category.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshData} disabled={loading} className="h-8 text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {totalLogs > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Server className="w-3.5 h-3.5 text-blue-500" /> Avg API Latency
            </div>
            <div className="text-xl font-bold mt-1 text-foreground">
              {avgLatency} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Supabase / Engine query</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Cpu className="w-3.5 h-3.5 text-purple-500" /> Avg UI Render
            </div>
            <div className="text-xl font-bold mt-1 text-foreground">
              {avgRender} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">DOM Mount & Formatting</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Audited Requests
            </div>
            <div className="text-xl font-bold mt-1 text-foreground">{totalLogs}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Total sessions sampled</div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Slow Categories
            </div>
            <div className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">
              {slowLogs.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Exceeded speed budget</div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" /> Question Category Delay Highlights
          </h4>

          {summaries.length === 0 ? (
            <div className="p-6 text-center border border-dashed rounded-xl border-border bg-muted/10">
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">No Performance Bottlenecks Detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a CBT Exam or Practice Session to record live render speeds and API latencies.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Category / Subject</th>
                      <th className="p-3">Sample Count</th>
                      <th className="p-3">Avg API Latency</th>
                      <th className="p-3">Avg UI Render</th>
                      <th className="p-3">Total Time</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summaries.map((cat, idx) => (
                      <tr key={idx} className={cat.status === 'High Delay / Action Needed' ? 'bg-red-500/5 dark:bg-red-950/20' : 'hover:bg-muted/20'}>
                        <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                          {cat.status === 'High Delay / Action Needed' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                          {cat.category}
                        </td>
                        <td className="p-3 text-muted-foreground">{cat.totalLogs} logs</td>
                        <td className="p-3 font-mono">{cat.avgApiLatencyMs} ms</td>
                        <td className="p-3 font-mono">{cat.avgUiRenderMs} ms</td>
                        <td className="p-3 font-mono font-bold text-foreground">{cat.avgTotalTimeMs} ms</td>
                        <td className="p-3">
                          <Badge
                            variant={cat.status === 'High Delay / Action Needed' ? 'destructive' : cat.status === 'Acceptable' ? 'secondary' : 'default'}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {cat.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Live Recent Metric Stream */}
        {logs.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Latency Log Stream
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {logs.slice(0, 8).map((log) => (
                <div key={log.id} className="p-2.5 rounded-lg border border-border/70 bg-background flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Badge variant={log.isSlow ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                      {log.mode}
                    </Badge>
                    <span className="font-semibold text-foreground truncate">{log.category}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">({log.deviceType})</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                    <span className="text-muted-foreground">API: {log.apiLatencyMs}ms</span>
                    <span className="text-muted-foreground">UI: {log.uiRenderTimeMs}ms</span>
                    <span className={`font-bold ${log.isSlow ? 'text-red-500' : 'text-emerald-500'}`}>
                      {log.totalTimeMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
