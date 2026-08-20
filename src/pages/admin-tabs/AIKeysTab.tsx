import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Key, ShieldCheck, RefreshCw, Zap, Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export const AIKeysTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok?: boolean; msg?: string } | null>(null);

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
      // 1. Fetch Keys from admin_settings
      const { data: keyData } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['ai_api_keys', 'api_keys']);

      let foundKey = '';
      if (keyData) {
        for (const row of keyData) {
          const k = row.setting_value?.groq || row.setting_value?.groq_key || row.setting_value?.groq_api_key;
          if (k) {
            foundKey = k;
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

  useEffect(() => {
    fetchKeysAndUsage();
  }, [fetchKeysAndUsage]);


  const handleSaveKeys = async () => {
    setSaving(true);
    try {
      // Save Keys
      const { error: keyErr } = await supabase.from('admin_settings').upsert({
        setting_key: 'ai_api_keys',
        setting_value: { groq: groqKey },
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      if (keyErr) throw keyErr;

      // Save Limits
      const { error: limitErr } = await supabase.from('admin_settings').upsert({
        setting_key: 'ai_limits',
        setting_value: limits,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      if (limitErr) throw limitErr;

      localStorage.setItem('groq_api_key', groqKey);
      toast.success("Groq API Key and Token Limits saved successfully to database!");
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
      let workingModel = 'openai/gpt-oss-120b';

      // 1. First probe available models on this key
      try {
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${trimmedKey}` }
        });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const ids: string[] = (modelsData?.data || []).map((m: any) => m.id);
          if (ids.includes('openai/gpt-oss-120b')) workingModel = 'openai/gpt-oss-120b';
          else if (ids.includes('openai/gpt-oss-20b')) workingModel = 'openai/gpt-oss-20b';
          else if (ids.includes('groq/compound')) workingModel = 'groq/compound';
          else if (ids.includes('groq/compound-mini')) workingModel = 'groq/compound-mini';
          else if (ids.length > 0) workingModel = ids[0];
        }
      } catch {}

      // 2. Perform test completion
      const testModels = [workingModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'groq/compound-mini'].filter((m, i, arr) => arr.indexOf(m) === i);
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
    } catch (err: any) {
      toast.error(`Groq Test Failed: ${err.message}`);
      setGroqStatus({ ok: false, msg: err.message });
    }
    setTestingGroq(false);
  };

  const usagePercent = Math.min(100, (usage.groqTokens / (limits.monthly_token_limit || 1)) * 100);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Key className="w-6 h-6 text-primary" /> AI Key & Quota Management
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Groq is configured as the official ultra-fast AI inference provider for Scholars Resort.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Groq Key Configuration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Zap className="w-5 h-5 text-orange-400" /> Groq API Configuration
            </CardTitle>
            <CardDescription>Primary key used across all Student and Admin AI modules.</CardDescription>
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
              <label className="text-sm font-medium text-slate-300">Monthly AI Token Limit</label>
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

        {/* Real-time Usage & Quota Monitor */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Token Quota Monitor</CardTitle>
            <CardDescription>Live telemetry on platform-wide Groq API calls.</CardDescription>
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

            {usagePercent >= 80 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <p className="font-bold">Token Quota Warning</p>
                  <p>You have consumed {usagePercent.toFixed(1)}% of your monthly limit. Increase limit above to prevent study plan generation interruptions.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Total AI Calls</div>
                <div className="text-2xl font-bold font-mono text-white">{usage.totalCalls}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Active AI Model</div>
                <div className="text-xs font-mono font-bold text-green-400">Llama 3.3 70B</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border border-border">
              All AI services (Study Plan, Tutor Chat, CBT Generation, Weekly Challenges) automatically route through Groq for fast execution.
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
};
