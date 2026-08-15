import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Activity, Users, Monitor, Smartphone, Globe, Clock, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export const TelemetryTab = () => {
  const [active15m, setActive15m] = useState(0);
  const [active24h, setActive24h] = useState(0);
  const [deviceData, setDeviceData] = useState<any[]>([]);
  const [pageData, setPageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  useEffect(() => {
    fetchTelemetry();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTelemetry = async () => {
    try {
      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000).toISOString();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000).toISOString();

      // Query active users (device_sessions)
      const { data: recentSessions, error: recentError } = await supabase
        .from('device_sessions')
        .select('id, user_id, last_active, device_info')
        .gte('last_active', twentyFourHoursAgo);

      if (!recentError && recentSessions) {
        // Active 24h
        const uniqueUsers24h = new Set(recentSessions.map(s => s.user_id));
        setActive24h(uniqueUsers24h.size);

        // Active 15m
        const active15 = recentSessions.filter(s => new Date(s.last_active) >= new Date(fifteenMinsAgo));
        const uniqueUsers15m = new Set(active15.map(s => s.user_id));
        setActive15m(uniqueUsers15m.size);

        // Device breakdown (from 24h data)
        let mobile = 0;
        let desktop = 0;
        recentSessions.forEach(s => {
           if (s.device_info?.userAgent?.toLowerCase().includes('mobile')) mobile++;
           else desktop++;
        });
        
        // Ensure some data shows for the chart even if 0
        if (mobile === 0 && desktop === 0) {
          desktop = 1; // Default fallback for chart rendering
        }
        
        setDeviceData([
          { name: 'Desktop', value: desktop },
          { name: 'Mobile', value: mobile }
        ]);
      }

      // Query page visits (simulated from activity_logs or a dedicated table)
      // Since we don't have a specific page_views table, we'll aggregate activity_logs action types
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('action')
        .gte('created_at', twentyFourHoursAgo);

      if (!logsError && logs) {
        const counts: Record<string, number> = {};
        logs.forEach(log => {
          counts[log.action] = (counts[log.action] || 0) + 1;
        });

        const sortedPages = Object.keys(counts)
          .map(k => ({ name: k.replace(/_/g, ' '), visits: counts[k] }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 5);
          
        setPageData(sortedPages);
      }

    } catch (err) {
      console.error("Telemetry fetch error", err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Platform Telemetry
          </h2>
          <p className="text-slate-400">Real-time platform usage and device intelligence.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); fetchTelemetry(); }} className="gap-2 border-slate-700 bg-slate-900">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      
      <div className="text-xs text-slate-500 text-right">
        Last updated: {lastRefreshed.toLocaleTimeString()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real-time Users */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <Activity className="w-5 h-5" /> Live Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="absolute -inset-4 bg-green-500/20 rounded-full blur-xl animate-pulse"></div>
                <div className="text-6xl font-black text-white relative z-10">{active15m}</div>
              </div>
              <p className="text-slate-400 mt-4 font-medium uppercase tracking-widest text-sm">Active in last 15 mins</p>
            </div>
            
            <div className="mt-8 border-t border-slate-800 pt-4 flex justify-between items-center text-sm">
              <span className="text-slate-400 flex items-center gap-2"><Clock className="w-4 h-4" /> 24h Unique Users</span>
              <span className="font-bold text-white">{active24h}</span>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-500">
              <Monitor className="w-5 h-5" /> Device Breakdown (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px'}}
                    itemStyle={{color: '#f8fafc'}}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-blue-500" /> Desktop 
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-purple-500" /> Mobile
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most Active Actions/Pages */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Top User Actions (24h)</CardTitle>
            <CardDescription className="text-slate-400">Most frequent activities performed by students.</CardDescription>
          </CardHeader>
          <CardContent>
            {pageData.length === 0 ? (
               <div className="text-center py-6 text-slate-500">Not enough data collected yet.</div>
            ) : (
              <div className="space-y-4">
                {pageData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-8 font-mono text-slate-500 text-right">{idx + 1}.</div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300 capitalize">{item.name}</span>
                        <span className="text-sm font-bold text-white">{item.visits}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(item.visits / pageData[0].visits) * 100}%` }}></div>
                      </div>
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
