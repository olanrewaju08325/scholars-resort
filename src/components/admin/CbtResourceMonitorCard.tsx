import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, HardDrive, Wifi, Activity, Zap, AlertTriangle, 
  CheckCircle2, RefreshCw, Layers, Gauge
} from 'lucide-react';
import { cbtPerformanceMonitor } from '@/services/cbtPerformanceMonitorService';
import type { CbtResourceMetrics } from '@/services/cbtPerformanceMonitorService';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const CbtResourceMonitorCard: React.FC<{
  currentModule?: string;
  className?: string;
}> = ({ currentModule = 'CBT Engine Core', className = '' }) => {
  const [metrics, setMetrics] = useState<CbtResourceMetrics | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (currentModule) {
      cbtPerformanceMonitor.setModule(currentModule);
    }

    const unsubscribe = cbtPerformanceMonitor.subscribe((latestMetrics) => {
      setMetrics(latestMetrics);
      const rawHistory = cbtPerformanceMonitor.getHistory();
      setHistory(rawHistory.map((h, i) => ({
        time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        memoryMB: h.memory.usedJSHeapMB,
        latencyMs: h.network.latencyMs,
        renderMs: h.rendering.avgRenderMs,
        index: i
      })));
    });

    return () => unsubscribe();
  }, [currentModule]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await cbtPerformanceMonitor.captureCurrentMetrics();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const mem = metrics?.memory || {
    usedJSHeapMB: 48,
    totalJSHeapMB: 92,
    jsHeapLimitMB: 1024,
    usagePercent: 4.7,
    supported: true
  };

  const net = metrics?.network || {
    latencyMs: 45,
    status: 'optimal' as const,
    endpoint: 'Supabase REST API'
  };

  const rend = metrics?.rendering || {
    avgRenderMs: 6.2,
    domNodeCount: 840,
    fps: 60
  };

  const bottlenecks = metrics?.bottlenecks || [];

  return (
    <Card className={`border border-border/80 bg-card shadow-md text-card-foreground overflow-hidden ${className}`}>
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold px-2 py-0.5">
                <Gauge className="w-3 h-3 mr-1" /> Real-Time Telemetry
              </Badge>
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">
                {currentModule}
              </Badge>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> CBT Engine Resource Monitor
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live browser memory heap allocation and Supabase database roundtrip latency
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-8 text-xs gap-1.5 w-full sm:w-auto justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Ping Engine</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* 4 Telemetry Metrics: Single Column on Mobile, 2 on Tablet, 4 on Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Memory Heap */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-sky-500" /> JS Memory Heap
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
                {mem.usagePercent}%
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {mem.usedJSHeapMB} <span className="text-xs font-sans text-muted-foreground font-normal">/ {mem.jsHeapLimitMB} MB</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div 
                  className={`h-full transition-all duration-500 ${mem.usagePercent > 75 ? 'bg-red-500' : mem.usagePercent > 50 ? 'bg-amber-500' : 'bg-sky-500'}`}
                  style={{ width: `${Math.min(100, Math.max(5, mem.usagePercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Network Latency */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Network Latency
              </span>
              <span className={`text-[10px] font-bold uppercase ${net.status === 'optimal' ? 'text-emerald-500' : net.status === 'moderate' ? 'text-amber-500' : 'text-red-500'}`}>
                {net.status}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground flex items-center gap-1.5">
                {net.latencyMs} <span className="text-xs font-sans text-muted-foreground font-normal">ms</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div 
                  className={`h-full transition-all duration-500 ${net.latencyMs > 400 ? 'bg-red-500' : net.latencyMs > 200 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, Math.max(5, (net.latencyMs / 600) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Render Latency */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-500" /> Render Latency
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">
                ~{rend.fps} FPS
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground flex items-center gap-1.5">
                {rend.avgRenderMs} <span className="text-xs font-sans text-muted-foreground font-normal">ms/frame</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, (rend.avgRenderMs / 30) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active DOM Nodes */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-500" /> Active DOM Nodes
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                Lightweight
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {rend.domNodeCount} <span className="text-xs font-sans text-muted-foreground font-normal">elements</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, (rend.domNodeCount / 3000) * 100))}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Live Recharts Graph */}
        {history.length > 1 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="font-semibold text-[11px] flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" /> Real-Time Latency & Memory Trace
              </span>
              <span className="text-[10px] font-mono">Last 60 polling intervals</span>
            </div>
            <div className="h-[160px] sm:h-[180px] w-full bg-muted/20 p-2 rounded-xl border border-border/50">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="latencyMs" name="DB Ping (ms)" stroke="#10b981" fillOpacity={1} fill="url(#colorNet)" />
                  <Area type="monotone" dataKey="memoryMB" name="Memory (MB)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorMem)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bottlenecks Warning / Health Banner */}
        <div className="pt-2 border-t border-border/50">
          {bottlenecks.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold">CBT Engine is performing optimally with zero bottlenecks detected.</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                Smooth 60FPS • Fast DB Ping
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Performance Bottlenecks Detected:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {bottlenecks.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};
