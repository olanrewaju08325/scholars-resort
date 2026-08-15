import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Brain, Settings2, Save, Play, RefreshCw, Command, Cpu, Key, Zap, CheckCircle2, AlertCircle, BarChart3, ShieldCheck } from 'lucide-react';
import { callGroqAPI, getGroqApiKey } from '@/services/aiService';

export const AIPromptStudioTab = () => {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Currently editing prompt state
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [featureName, setFeatureName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelType, setModelType] = useState('llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(0.7);

  // Key Testing State
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok?: boolean; latency?: number; msg?: string }>({});

  // Test Playground Area
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testingPlayground, setTestingPlayground] = useState(false);

  // Stats
  const [totalTokens, setTotalTokens] = useState(0);
  const [groqTokens, setGroqTokens] = useState(0);
  const [featureUsage, setFeatureUsage] = useState<any[]>([]);

  const selectPrompt = useCallback((prompt: any) => {
    setSelectedPromptId(prompt.id);
    setFeatureName(prompt.feature_name);
    setSystemPrompt(prompt.system_prompt || '');
    setModelType(prompt.model || 'llama-3.3-70b-versatile');
    setTemperature(prompt.temperature || 0.7);
    setTestOutput('');
  }, []);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_ai_prompts')
      .select('*')
      .order('feature_name', { ascending: true });

    if (!error && data) {
      setPrompts(data);
      if (data.length > 0 && !selectedPromptId) {
        selectPrompt(data[0]);
      }
    }
    setLoading(false);
  }, [selectedPromptId, selectPrompt]);

  const fetchAIUsage = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ai_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (data) {
        let total = 0;
        let groq = 0;
        const byFeature: Record<string, { totalTokens: number; count: number }> = {};

        data.forEach(log => {
          const t = (log.prompt_tokens || 0) + (log.completion_tokens || 0);
          total += t;
          groq += t;

          const feat = log.feature || 'chat';
          if (!byFeature[feat]) byFeature[feat] = { totalTokens: 0, count: 0 };
          byFeature[feat].totalTokens += t;
          byFeature[feat].count += 1;
        });

        setTotalTokens(total);
        setGroqTokens(groq);

        const featureList = Object.keys(byFeature).map(k => ({
          feature: k.replace(/_/g, ' '),
          tokens: byFeature[k].totalTokens,
          requests: byFeature[k].count
        })).sort((a, b) => b.tokens - a.tokens);

        setFeatureUsage(featureList);
      }
    } catch (err) {
      console.error("AI usage fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
    fetchAIUsage();
  }, [fetchPrompts, fetchAIUsage]);

  const savePrompt = async () => {
    if (!selectedPromptId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_ai_prompts')
        .update({
          system_prompt: systemPrompt,
          model: modelType,
          temperature: temperature,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPromptId);

      if (error) throw error;
      toast.success("AI Prompt configuration saved!");
      fetchPrompts();
    } catch (err: any) {
      toast.error(`Failed to save prompt: ${err.message}`);
    }
    setSaving(false);
  };

  // Live Test Groq Key Direct
  const testGroqKey = async () => {
    setTestingGroq(true);
    setGroqStatus({});
    const startTime = Date.now();

    try {
      const key = await getGroqApiKey();
      if (!key) throw new Error("No Groq API Key found. Please save your Groq key in the AI Keys tab.");

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Respond with "Groq Engine Online"' }],
          max_tokens: 15
        })
      });

      const latency = Date.now() - startTime;
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || 'Groq Active';
      
      setGroqStatus({
        ok: true,
        latency,
        msg: content
      });
      toast.success(`Groq API key verified! Reply: "${content}" (${latency}ms)`);
    } catch (err: any) {
      setGroqStatus({ ok: false, msg: err.message });
      toast.error(`Groq Key Test Failed: ${err.message}`);
    }
    setTestingGroq(false);
  };

  const testPromptPlayground = async () => {
    if (!testInput.trim() || !systemPrompt.trim()) return;
    setTestingPlayground(true);
    setTestOutput('');

    try {
      const output = await callGroqAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testInput }
      ], modelType, temperature);

      setTestOutput(output);
      fetchAIUsage(); // Refresh usage analytics
    } catch (err: any) {
      toast.error(`Playground error: ${err.message}`);
      setTestOutput(`Error: ${err.message}`);
    }
    setTestingPlayground(false);
  };

  const createNewPrompt = async () => {
    const newName = window.prompt("Enter feature prompt ID (e.g. 'essay_grader'):");
    if (!newName) return;

    const formattedName = newName.toLowerCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('admin_ai_prompts').insert({
      feature_name: formattedName,
      system_prompt: "You are an expert AI tutor for Nigerian JAMB students...",
      model: "llama-3.3-70b-versatile",
      temperature: 0.7
    });

    if (error) {
      toast.error(`Failed to create: ${error.message}`);
    } else {
      toast.success("New AI Feature Prompt registered!");
      fetchPrompts();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> AI Feature Studio & Model Playground
          </h2>
          <p className="text-slate-400">Configure Groq system prompts, test model outputs live, and track token metrics.</p>
        </div>
        <Button onClick={createNewPrompt} className="bg-primary hover:bg-primary/90 shrink-0">
          <Command className="w-4 h-4 mr-2" /> Register AI Feature
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-slate-400 font-bold uppercase">Total Tokens Used</span>
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{totalTokens.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Across all platform queries</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-slate-400 font-bold uppercase">Groq Llama Tokens</span>
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{groqTokens.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Ultra-fast Groq Llama 3.3 70B</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-slate-400 font-bold uppercase">Active AI Provider</span>
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-base font-bold text-green-400 capitalize mt-1">Groq Engine</div>
            <p className="text-xs text-slate-500 mt-1">Direct High-Speed API</p>
          </CardContent>
        </Card>
      </div>

      {/* Live API Key Diagnostics Row */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="py-4 border-b border-slate-800">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Groq API Verification
          </CardTitle>
          <CardDescription className="text-slate-400">Test live connection to Groq API endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">Groq API Key Status</span>
              </div>
              {groqStatus.ok !== undefined && (
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${groqStatus.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {groqStatus.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {groqStatus.ok ? `Connected (${groqStatus.latency}ms)` : 'Failed'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Powers low-latency Llama 3.3 70B & 8B model requests for study plans, CBTs, and tutor chat.</p>
            <Button onClick={testGroqKey} disabled={testingGroq} size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white">
              {testingGroq ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {testingGroq ? 'Testing Groq Connection...' : 'Test Groq Connection Live'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Feature List */}
        <Card className="md:col-span-1 bg-slate-900 border-slate-800 text-slate-100 h-[600px] flex flex-col">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-base flex justify-between items-center">
              <span>AI Features</span>
              <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded">{prompts.length}</span>
            </CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-sm">Loading prompts...</div>
            ) : prompts.map(p => (
              <button
                key={p.id}
                onClick={() => selectPrompt(p)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  selectedPromptId === p.id 
                    ? 'bg-primary text-white font-semibold shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="capitalize">{p.feature_name.replace(/_/g, ' ')}</div>
                <div className="text-[10px] opacity-70 font-mono mt-0.5">{p.model || 'llama-3.3-70b-versatile'}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Editor & Testing Area */}
        {selectedPromptId ? (
          <div className="md:col-span-3 space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-800">
                <div>
                   <CardTitle className="capitalize text-lg">{featureName.replace(/_/g, ' ')}</CardTitle>
                   <CardDescription className="text-slate-400 font-mono text-xs">ID: {featureName}</CardDescription>
                </div>
                <Button onClick={savePrompt} disabled={saving} className="bg-green-600 hover:bg-green-700 h-9">
                  {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Configuration
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-slate-400" /> Primary Groq Model
                    </label>
                    <select 
                      value={modelType} 
                      onChange={(e) => setModelType(e.target.value)} 
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B (Recommended)</option>
                      <option value="llama-3.1-8b-instant">Groq Llama 3.1 8B (Fastest)</option>
                      <option value="mixtral-8x7b-32768">Groq Mixtral 8x7B</option>
                      <option value="gemma2-9b-it">Groq Gemma 2 9B</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temperature: {temperature}</label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05" 
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full mt-2 accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Strict / Factual (0.0)</span>
                      <span>Creative (1.0)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">System Instructions</label>
                  <textarea 
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-44 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm focus:ring-1 focus:ring-primary outline-none font-mono leading-relaxed"
                  />
                  <p className="text-xs text-slate-500">Instructions supplied to the Groq model as system context before processing student input.</p>
                </div>
              </CardContent>
            </Card>

            {/* Test Playground */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="py-3 border-b border-slate-800">
                 <CardTitle className="text-sm flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-400" /> Interactive Prompt Playground
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Input 
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Enter sample student prompt to test live response..."
                    className="bg-slate-950 border-slate-800 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && testPromptPlayground()}
                  />
                  <Button onClick={testPromptPlayground} disabled={testingPlayground || !testInput.trim()} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                     {testingPlayground ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
                
                {testOutput && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="text-xs text-slate-500 font-bold uppercase">Response Output</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{testOutput}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
           <div className="md:col-span-3 h-[600px] flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500">
             <Brain className="w-16 h-16 opacity-20 mb-4" />
             <p>Select an AI feature prompt to edit</p>
           </div>
        )}
      </div>

      {/* Token Usage by Feature Table */}
      {featureUsage.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Token Consumption by AI Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Requests</th>
                    <th className="px-4 py-3">Total Tokens Used</th>
                    <th className="px-4 py-3">Avg Tokens / Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {featureUsage.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-200 capitalize">{f.feature}</td>
                      <td className="px-4 py-3 text-slate-400">{f.requests}</td>
                      <td className="px-4 py-3 font-mono font-bold text-primary">{f.tokens.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{Math.round(f.tokens / f.requests).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
