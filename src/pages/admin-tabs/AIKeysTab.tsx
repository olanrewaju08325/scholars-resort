import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Key, ShieldCheck, RefreshCw, Zap, Activity, CheckCircle2, XCircle, 
  AlertTriangle, Server, Clock, Terminal, Cpu, Search, Wifi
} from 'lucide-react';
import { fetchGroqTelemetry, type GroqTelemetryData, type GroqLogEntry } from '@/services/groqTelemetryService';

export const AIKeysTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok?: boolean; msg?: string } | null>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<GroqTelemetryData | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(3000); // 3 seconds default
  const [logFilter, setLogFilter] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const [limits, setLimits] = useState({
    monthly_token_limit: 5000000,
  });

  const [usage, setUsage] = useState({
    groqTokens: 0,
    totalCalls: 0
  });

  const fetchKeysAndUsage = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Keys from system_configs table
      let foundKey = '';
      try {
        const { data: sysData } = await supabase
          .from('system_configs')
          .select('config_value')
          .eq('config_key', 'groq_settings')
          .maybeSingle();

        if (sysData?.config_value?.apiKey || sysData?.config_value?.groq) {
          foundKey = sysData.config_value.apiKey || sysData.config_value.groq;
        }
      } catch (_) {}

      // Fallback to admin_settings
      if (!foundKey) {
        const { data: keyData } = await supabase
          .from('admin_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['ai_api_keys', 'api_keys']);

        if (keyData) {
          for (const row of keyData) {
            const k = row.setting_value?.groq || row.setting_value?.groq_key || row.setting_value?.groq_api_key;
            if (k) {
              foundKey = k;
              break;
            }
          }
        }
      }

      if (foundKey) {
        setGroqKey(foundKey);
      } else {
        const local = localStorage.getItem('groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || '';
        setGroqKey(local);
      }

      // 2. Fetch AI Token limits
      const { data: limitData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'ai_limits')
        .maybeSingle();

      if (limitData?.setting_value?.monthly_token_limit) {
        setLimits({ monthly_token_limit: limitData.setting_value.monthly_token_limit });
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
      // 1. Save to system_configs table
      try {
        await supabase.from('system_configs').upsert({
          config_key: 'groq_settings',
          config_value: {
            apiKey: groqKey.trim(),
            defaultModel: 'llama-3.3-70b-versatile',
            monthlyTokenLimit: limits.monthly_token_limit
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' });
      } catch (_) {}

      // 2. Save to admin_settings table for backward compatibility
      const { error: keyErr } = await supabase.from('admin_settings').upsert({
        setting_key: 'ai_api_keys',
        setting_value: { groq: groqKey.trim() },
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      if (keyErr) throw keyErr;

      const { error: limitErr } = await supabase.from('admin_settings').upsert({
        setting_key: 'ai_limits',
        setting_value: limits,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      if (limitErr) throw limitErr;

      // 3. Post to API route for immediate runtime server cache update
      fetch('/api/admin/system-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groq: {
            apiKey: groqKey.trim(),
            defaultModel: 'llama-3.3-70b-versatile',
            monthlyTokenLimit: limits.monthly_token_limit
          }
        })
      }).catch(() => {});

      localStorage.setItem('groq_api_key', groqKey.trim());
      toast.success("Groq API Key and Token Limits saved successfully to system_configs table!");
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
      let workingModel = 'llama-3.3-70b-versatile';

      try {
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${trimmedKey}` }
        });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const ids: string[] = (modelsData?.data || []).map((m: any) => m.id);
          if (ids.includes('llama-3.3-70b-versatile')) workingModel = 'llama-3.3-70b-versatile';
          else if (ids.includes('llama-3.1-8b-instant')) workingModel = 'llama-3.1-8b-instant';
          else if (ids.includes('mixtral-8x7b-32768')) workingModel = 'mixtral-8x7b-32768';
          else if (ids.length > 0) workingModel = ids[0];
        }
      } catch {}

      const testModels = [workingModel, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'].filter((m, i, arr) => arr.indexOf(m) === i);
      let reply = '';
      let successModel = '';

      for (const m of testModels) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${trimmedKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [{ role: 'user', content: 'Say "Groq API Connected!" in 3 words.' }],
              max_tokens: 20
            })
          });

          if (res.ok) {
            const data = await res.json();
            reply = data?.choices?.[0]?.message?.content || 'Connected';
            successModel = m;
            break;
          }
        } catch {}
      }

      if (!reply) {
        throw new Error('Groq key rejected. Please check your API key format.');
      }

      toast.success(`Groq API Verified (${successModel})! Reply: "${reply}"`);
      setGroqStatus({ ok: true, msg: `Verified with ${successModel}: "${reply}"` });
      loadTelemetryData();
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
        
        {/* Groq Key Configuration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Zap className="w-5 h-5 text-orange-400" /> Groq API Configuration
            </CardTitle>
            <CardDescription>Primary production key for Student & Admin AI modules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-300">Groq API Key (gsk_...)</label>
                {groqStatus && (
                  <span className={`text-xs flex items-center gap-1 ${groqStatus.ok ? 'text-green-500' : 'text-red-500'}`}>
                    {groqStatus.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {groqStatus.ok ? 'Verified' : 'Error'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  type="password" 
                  value={groqKey} 
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="bg-slate-950 font-mono text-sm"
                />
                <Button variant="secondary" onClick={testGroqKey} disabled={testingGroq}>
                  {testingGroq ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test Key'}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-sm font-medium text-slate-300">Monthly AI Token Quota Limit</label>
              <Input 
                type="number" 
                value={limits.monthly_token_limit} 
                onChange={e => setLimits({ monthly_token_limit: Number(e.target.value) })}
                placeholder="5000000"
                className="bg-slate-950 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Default: 5,000,000 tokens / month</p>
            </div>

            <Button onClick={handleSaveKeys} disabled={saving} className="w-full gap-2">
              <ShieldCheck className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings to Database'}
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
                  className="bg-slate-950 border border-slate-800 rounded text-[11px] font-mono px-2 py-1 text-slate-300"
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
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input 
                type="text" 
                placeholder="Filter logs by model/status..." 
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-950"
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

