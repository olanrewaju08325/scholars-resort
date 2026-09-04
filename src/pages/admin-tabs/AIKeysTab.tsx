import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';
import { 
  Key, ShieldCheck, RefreshCw, Zap, Activity, CheckCircle2, XCircle, 
  AlertTriangle, Server, Clock, Terminal, Cpu, Search, Wifi, Eye, EyeOff, Users, Sliders
} from 'lucide-react';
import { fetchGroqTelemetry, type GroqTelemetryData, type GroqLogEntry } from '@/services/groqTelemetryService';

interface AILimitsConfig {
  monthly_token_limit: number;
  student_daily_free_limit: number;
  student_daily_pro_limit: number;
  student_daily_token_limit: number;
}

export const AIKeysTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok?: boolean; msg?: string } | null>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<GroqTelemetryData | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(3000); // 3 seconds default
  const [logFilter, setLogFilter] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const [limits, setLimits] = useState<AILimitsConfig>({
    monthly_token_limit: 5000000,
    student_daily_free_limit: 10,
    student_daily_pro_limit: 100,
    student_daily_token_limit: 25000
  });

  const [usage, setUsage] = useState({
    groqTokens: 0,
    totalCalls: 0
  });

  const fetchKeysAndUsage = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Keys from authoritative admin_settings table
      let foundKey = '';
      const { data: keyData } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['ai_api_keys', 'api_keys', 'system_config']);

      if (keyData) {
        for (const row of keyData) {
          const k = row.setting_value?.groq || row.setting_value?.groq_key || row.setting_value?.groq_api_key || row.setting_value?.apiKey || row.setting_value?.groq?.apiKey;
          if (typeof k === 'string' && k.trim().length > 10) {
            foundKey = k.trim();
            break;
          }
        }
      }

      if (foundKey) {
        setGroqKey(foundKey);
      } else {
        const local = localStorage.getItem('groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || '';
        setGroqKey(local);
      }

      // 2. Fetch AI limits
      const { data: limitData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'ai_limits')
        .maybeSingle();

      if (limitData?.setting_value) {
        setLimits({
          monthly_token_limit: Number(limitData.setting_value.monthly_token_limit) || 5000000,
          student_daily_free_limit: Number(limitData.setting_value.student_daily_free_limit) || 10,
          student_daily_pro_limit: Number(limitData.setting_value.student_daily_pro_limit) || 100,
          student_daily_token_limit: Number(limitData.setting_value.student_daily_token_limit) || 25000
        });
      } else {
        const savedLimits = localStorage.getItem('ai_limits');
        if (savedLimits) {
          try {
            setLimits(JSON.parse(savedLimits));
          } catch (_) {}
        }
      }

      // 3. Fetch Token Usage from ai_usage table
      const { data: logs } = await supabase
        .from('ai_usage')
        .select('prompt_tokens, completion_tokens');

      if (logs) {
        let gTokens = 0;
        logs.forEach(log => {
          gTokens += (log.prompt_tokens || 0) + (log.completion_tokens || 0);
        });

        setUsage({
          groqTokens: gTokens,
          totalCalls: logs.length
        });
      }

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  // Poll server-side telemetry
  const loadTelemetryData = useCallback(async () => {
    const data = await fetchGroqTelemetry(groqKey);
    if (data) {
      setTelemetry(data);
      setLastRefreshedAt(new Date().toLocaleTimeString());
      if (data.totals.totalTokens > 0) {
        setUsage(prev => ({
          groqTokens: Math.max(prev.groqTokens, data.totals.totalTokens),
          totalCalls: Math.max(prev.totalCalls, data.totals.totalRequests)
        }));
      }
    }
  }, [groqKey]);

  useEffect(() => {
    fetchKeysAndUsage();
  }, [fetchKeysAndUsage]);

  useEffect(() => {
    loadTelemetryData();
    if (autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadTelemetryData();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [loadTelemetryData, autoRefreshInterval]);

  const handleSaveKeys = async () => {
    setSaving(true);
    try {
      const cleanKey = groqKey.trim();

      // 1. Save to authoritative admin_settings table
      await supabase.from('admin_settings').upsert([
        {
          setting_key: 'ai_api_keys',
          setting_value: { groq: cleanKey, default_model: 'llama-3.3-70b-versatile' },
          updated_at: new Date().toISOString()
        },
        {
          setting_key: 'ai_limits',
          setting_value: limits,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'setting_key' });

      // 2. Also save to platform_config for platform-wide persistence
      await supabase.from('platform_config').upsert([
        {
          key: 'ai_limits',
          value: limits,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'key' }).catch(() => {});

      // 3. Save to localStorage for client caching
      if (cleanKey) {
        localStorage.setItem('groq_api_key', cleanKey);
      }
      localStorage.setItem('ai_limits', JSON.stringify(limits));

      // 4. Post to API route for immediate runtime server cache update
      authFetch('/api/admin/system-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groq: {
            apiKey: cleanKey,
            defaultModel: 'llama-3.3-70b-versatile',
            monthlyTokenLimit: limits.monthly_token_limit
          }
        })
      }).catch(() => {});

      toast.success("Groq API Key and Student Usage Limits saved successfully to Supabase!");
      loadTelemetryData();
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message);
    }
    setSaving(false);
  };

  const testGroqKey = async () => {
    if (!groqKey || groqKey.trim().length < 10) {
      toast.error("Please enter a valid Groq API Key first.");
      return;
    }

    setTestingGroq(true);
    try {
      const trimmedKey = groqKey.trim();
      const { testGroqConnection } = await import('@/services/systemConfigService');
      const result = await testGroqConnection(trimmedKey);

      if (result.ok) {
        toast.success(result.message || 'Groq API Key verified successfully!');
        setGroqStatus({ ok: true, msg: result.message || 'Verified successfully' });
        loadTelemetryData();
      } else {
        throw new Error(result.message || 'Groq key rejected. Please check your key.');
      }
    } catch (err: any) {
      toast.error(`Groq Test Failed: ${err.message}`);
      setGroqStatus({ ok: false, msg: err.message });
    }
    setTestingGroq(false);
  };

  const usagePercent = Math.min(100, (usage.groqTokens / (limits.monthly_token_limit || 1)) * 100);

  const filteredLogs = (telemetry?.logs || []).filter(l => {
    if (!logFilter) return true;
    const term = logFilter.toLowerCase();
    return l.model.toLowerCase().includes(term) || l.source.toLowerCase().includes(term) || l.status.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" /> AI Key & Real-Time Usage Monitor
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Official server-side telemetry tracking actual Groq API token consumption and live rate limits.
          </p>
        </div>

        {/* Real-time Status Badge */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">Live Telemetry</span>
          {lastRefreshedAt && <span className="text-slate-500 text-[10px]">({lastRefreshedAt})</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Groq Key Configuration & Student Daily Usage Limits */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Zap className="w-5 h-5 text-amber-500" /> Groq API & Student Quotas
            </CardTitle>
            <CardDescription>Configure primary AI credentials and per-student daily query limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Groq API Key Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" />
                  Groq API Key
                </label>
                {groqStatus && (
                  <span className={`text-xs font-medium flex items-center gap-1 px-2 py-0.5 rounded ${groqStatus.ok ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                    {groqStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {groqStatus.ok ? 'Verified Active' : 'Invalid Key'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={showKey ? 'text' : 'password'} 
                    value={groqKey} 
                    onChange={e => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="bg-background text-foreground border-input font-mono text-sm pr-10 shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  onClick={testGroqKey} 
                  disabled={testingGroq || !groqKey.trim()}
                  className="gap-1.5 font-medium shrink-0"
                >
                  {testingGroq ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
                  Test Key
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Official Groq Cloud API key starting with <code className="text-foreground font-mono font-semibold">gsk_</code>. Provides real-time inference for all student questions.
              </p>
            </div>

            {/* Student Daily Usage Limits */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Student Daily Usage Limits</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Free Tier Limit */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Free Tier Daily AI Limit</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Queries / day</span>
                  </label>
                  <Input 
                    type="number" 
                    min={1}
                    max={100}
                    value={limits.student_daily_free_limit} 
                    onChange={e => setLimits(prev => ({ ...prev, student_daily_free_limit: Math.max(1, Number(e.target.value)) }))}
                    className="bg-background text-foreground border-input font-mono text-sm shadow-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 10 queries/student/day</p>
                </div>

                {/* Pro Tier Limit */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Pro Tier Daily AI Limit</span>
                    <span className="text-[11px] text-primary font-normal">Queries / day</span>
                  </label>
                  <Input 
                    type="number" 
                    min={10}
                    max={1000}
                    value={limits.student_daily_pro_limit} 
                    onChange={e => setLimits(prev => ({ ...prev, student_daily_pro_limit: Math.max(10, Number(e.target.value)) }))}
                    className="bg-background text-foreground border-input font-mono text-sm shadow-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 100 queries/student/day</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Student Daily Token Cap */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Student Daily Token Cap</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Tokens / day</span>
                  </label>
                  <Input 
                    type="number" 
                    min={1000}
                    step={1000}
                    value={limits.student_daily_token_limit} 
                    onChange={e => setLimits(prev => ({ ...prev, student_daily_token_limit: Math.max(1000, Number(e.target.value)) }))}
                    className="bg-background text-foreground border-input font-mono text-sm shadow-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 25,000 tokens/day/user</p>
                </div>

                {/* Global Monthly Token Budget */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Platform Monthly Token Budget</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Total tokens</span>
                  </label>
                  <Input 
                    type="number" 
                    min={100000}
                    step={500000}
                    value={limits.monthly_token_limit} 
                    onChange={e => setLimits(prev => ({ ...prev, monthly_token_limit: Math.max(100000, Number(e.target.value)) }))}
                    className="bg-background text-foreground border-input font-mono text-sm shadow-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 5,000,000 tokens/month</p>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveKeys} disabled={saving} className="w-full gap-2 font-medium">
              <ShieldCheck className="w-4 h-4" /> {saving ? 'Saving to Supabase...' : 'Save Configuration to Supabase'}
            </Button>
          </CardContent>
        </Card>

        {/* Quota & Server Rate Limit Telemetry */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Live Quota & Server Headers</CardTitle>
              <div className="flex items-center gap-2">
                <select 
                  value={autoRefreshInterval} 
                  onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                  className="bg-background border border-input rounded text-[11px] font-mono px-2 py-1 text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                >
                  <option value={3000}>Refresh: 3s</option>
                  <option value={5000}>Refresh: 5s</option>
                  <option value={10000}>Refresh: 10s</option>
                  <option value={0}>Manual Only</option>
                </select>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={loadTelemetryData}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <CardDescription>Actual Groq API rate-limit headers directly from server response.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Monthly Quota Consumption</span>
                <span className="text-xs font-mono font-bold text-primary">{usagePercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 75 ? 'bg-amber-500' : 'bg-primary'}`} 
                  style={{ width: `${usagePercent}%` }} 
                />
              </div>
              <div className="flex justify-between items-center mt-2 text-xs font-mono text-slate-400">
                <span>{usage.groqTokens.toLocaleString()} used</span>
                <span>{limits.monthly_token_limit.toLocaleString()} max</span>
              </div>
            </div>

            {telemetry?.quota?.remainingTokens ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-xs text-emerald-400 font-bold uppercase">
                  <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Groq Server Response Telemetry</span>
                  <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">Verified API Headers</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Remaining Tokens:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {isNaN(Number(telemetry.quota.remainingTokens)) ? telemetry.quota.remainingTokens : Number(telemetry.quota.remainingTokens).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Quota Limit (Per Min):</span>
                    <span className="text-slate-200 font-bold text-sm">
                      {isNaN(Number(telemetry.quota.limitTokens)) ? telemetry.quota.limitTokens : Number(telemetry.quota.limitTokens).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Remaining Requests:</span>
                    <span className="text-amber-400 font-bold text-sm">{telemetry.quota.remainingRequests || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Reset Window:</span>
                    <span className="text-blue-400 font-bold text-sm">{telemetry.quota.resetTokens || '1m'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 flex items-center justify-between">
                <span>Groq API headers will populate on next live API call.</span>
                <Button size="sm" variant="outline" onClick={testGroqKey} className="h-6 text-[11px]">
                  Probe Headers Now
                </Button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase">Prompt Tokens</div>
                <div className="text-base font-bold font-mono text-cyan-400">
                  {(telemetry?.totals?.totalPromptTokens || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase">Completion Tokens</div>
                <div className="text-base font-bold font-mono text-purple-400">
                  {(telemetry?.totals?.totalCompletionTokens || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase">Avg Latency</div>
                <div className="text-base font-bold font-mono text-emerald-400">
                  {telemetry?.totals?.avgLatencyMs || 0}ms
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Model Usage Distribution */}
      {telemetry?.modelUsage && telemetry.modelUsage.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> Token Consumption by Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {telemetry.modelUsage.map((m, idx) => {
              const pct = Math.round((m.totalTokens / (telemetry.totals.totalTokens || 1)) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-semibold text-slate-200">{m.model}</span>
                    <span className="text-slate-400">{m.totalTokens.toLocaleString()} tokens ({m.calls} calls)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-primary h-full transition-all" style={{ width: `${Math.max(5, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Real-time Server Log Stream Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="w-4 h-4 text-emerald-400" /> Live Groq Server API Logs ({filteredLogs.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time log stream captured from actual Groq completion calls.
              </CardDescription>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Filter logs by model/status..." 
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                className="pl-8 h-8 text-xs bg-background text-foreground border-input shadow-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">
              No server log entries captured yet. Execute a chat or test key to stream logs.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Model</th>
                    <th className="p-2.5">Prompt</th>
                    <th className="p-2.5">Completion</th>
                    <th className="p-2.5">Total</th>
                    <th className="p-2.5">Latency</th>
                    <th className="p-2.5">Source</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredLogs.slice(0, 30).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-2.5 font-bold text-slate-200">
                        {log.model}
                      </td>
                      <td className="p-2.5 text-cyan-400">
                        {log.promptTokens}
                      </td>
                      <td className="p-2.5 text-purple-400">
                        {log.completionTokens}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-400">
                        {log.totalTokens}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        {log.latencyMs}ms
                      </td>
                      <td className="p-2.5 text-[10px] uppercase text-slate-400">
                        {log.source === 'server_proxy' ? 'Server Proxy' : 'Client Direct'}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

