import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  BrainCircuit, Sparkles, Sliders, ShieldCheck, 
  Save, RefreshCw, Cpu, Zap, CheckCircle2, Lock 
} from 'lucide-react';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

export const AiMockConfigTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [templateName, setTemplateName] = useState('2025 Standard JAMB UTME Prediction Mock');
  const [description, setDescription] = useState('Official 4-subject UTME mock dynamically balanced across historical past questions and AI weak-point synthesis.');
  
  // Hybrid composition
  const [dbPercent, setDbPercent] = useState(70);
  const [aiPercent, setAiPercent] = useState(30);

  // Difficulty distribution
  const [easyPercent, setEasyPercent] = useState(20);
  const [mediumPercent, setMediumPercent] = useState(50);
  const [hardPercent, setHardPercent] = useState(30);

  // Model & provider settings
  const [aiProvider, setAiProvider] = useState<'groq' | 'gemini'>('groq');
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(0.3);

  // Behavioral & guardrails
  const [enableWeaknessTargeting, setEnableWeaknessTargeting] = useState(true);
  const [maxTokenSpend, setMaxTokenSpend] = useState(5000);
  const [isLockedForStudents, setIsLockedForStudents] = useState(false);

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/ai-mock-config');
      const data = await res.json();
      if (data && data.success && data.config) {
        const c = data.config;
        if (c.templateName) setTemplateName(c.templateName);
        if (c.description) setDescription(c.description);
        if (c.hybridRatio) {
          setDbPercent(c.hybridRatio.databasePastQsPercent ?? 70);
          setAiPercent(c.hybridRatio.aiSyntheticQsPercent ?? 30);
        }
        if (c.difficultyDistribution) {
          setEasyPercent(c.difficultyDistribution.easyPercent ?? 20);
          setMediumPercent(c.difficultyDistribution.mediumPercent ?? 50);
          setHardPercent(c.difficultyDistribution.hardPercent ?? 30);
        }
        if (c.aiProvider) setAiProvider(c.aiProvider);
        if (c.aiModel) setAiModel(c.aiModel);
        if (typeof c.temperature === 'number') setTemperature(c.temperature);
        if (typeof c.enableWeaknessTargeting === 'boolean') setEnableWeaknessTargeting(c.enableWeaknessTargeting);
        if (c.maxTokenSpendPerSession) setMaxTokenSpend(c.maxTokenSpendPerSession);
        if (typeof c.isLockedForStudents === 'boolean') setIsLockedForStudents(c.isLockedForStudents);
        if (c.updatedAt) setLastSavedTime(c.updatedAt);
      }
    } catch (err: any) {
      toast.error('Failed to load AI Mock configuration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleHybridRatioChange = (val: number) => {
    setDbPercent(val);
    setAiPercent(100 - val);
  };

  const handleSaveConfig = async () => {
    // Validate difficulty total
    const diffSum = Number(easyPercent) + Number(mediumPercent) + Number(hardPercent);
    if (diffSum !== 100) {
      toast.error(`Difficulty percentages must sum to 100% (currently ${diffSum}%).`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        templateName,
        description,
        hybridRatio: {
          databasePastQsPercent: dbPercent,
          aiSyntheticQsPercent: aiPercent
        },
        difficultyDistribution: {
          easyPercent: Number(easyPercent),
          mediumPercent: Number(mediumPercent),
          hardPercent: Number(hardPercent)
        },
        aiProvider,
        aiModel,
        temperature,
        enableWeaknessTargeting,
        maxTokenSpendPerSession: Number(maxTokenSpend),
        isLockedForStudents
      };

      const res = await authFetch('/api/admin/ai-mock-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data && data.success) {
        toast.success('AI Mock Exam Engine Configuration saved & synchronized live!');
        if (data.config?.updatedAt) setLastSavedTime(data.config.updatedAt);
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch (err: any) {
      toast.error('Error saving config: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-500" />
            AI-Generated Mock Exam Configurator & Engine Control
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure how dynamic 180-Question JAMB UTME mock exams are synthesized for students. Balance past question database ratios, AI provider models, and difficulty distributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={loading || saving}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
          </Button>

          <Button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Publish Preset'}
          </Button>
        </div>
      </div>

      {lastSavedTime && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Active Configuration Last Saved: {new Date(lastSavedTime).toLocaleString()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Preset & Engine Parameters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Preset Information */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Sliders className="w-4 h-4 text-indigo-500" /> Exam Preset Metadata
              </CardTitle>
              <CardDescription className="text-xs">
                Set public title and student-facing description for the active AI Mock preset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Preset Title</Label>
                <Input
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="text-xs h-9 mt-1"
                  placeholder="e.g. 2025 Standard UTME Prediction Mock"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Description</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="text-xs h-9 mt-1"
                  placeholder="Describe academic composition..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Question Hybrid Composition */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-500" /> Question Source Hybrid Ratio
                </span>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                  {dbPercent}% Database / {aiPercent}% AI Synthetic
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Adjust the ratio of authentic database past questions to AI-synthesized weak-point questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Authentic DB Past Qs ({dbPercent}%)</span>
                  <span>AI Synthetic Qs ({aiPercent}%)</span>
                </div>
                <input
                  type="range"
                  value={dbPercent}
                  onChange={e => handleHybridRatioChange(Number(e.target.value))}
                  min={10}
                  max={90}
                  step={5}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Recommended safe baseline: 70% Real Database Past Questions + 30% AI Synthetic Questions to preserve authentic JAMB paper structure while targeting weak points.
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Difficulty Distribution */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" /> Difficulty Distribution Balance
                </span>
                <Badge variant="outline" className={easyPercent + mediumPercent + hardPercent === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-red-50 text-red-700 border-red-300"}>
                  Total: {easyPercent + mediumPercent + hardPercent}%
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Configure percentage distribution across question difficulty tiers for generated papers (Must total 100%).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Easy Tier (%)</Label>
                <Input
                  type="number"
                  value={easyPercent}
                  onChange={e => setEasyPercent(Number(e.target.value))}
                  className="text-xs h-9 mt-1"
                  min={0}
                  max={100}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Medium Tier (%)</Label>
                <Input
                  type="number"
                  value={mediumPercent}
                  onChange={e => setMediumPercent(Number(e.target.value))}
                  className="text-xs h-9 mt-1"
                  min={0}
                  max={100}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-purple-600 dark:text-purple-400">Hard / High-Order (%)</Label>
                <Input
                  type="number"
                  value={hardPercent}
                  onChange={e => setHardPercent(Number(e.target.value))}
                  className="text-xs h-9 mt-1"
                  min={0}
                  max={100}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: AI Provider & Guardrails */}
        <div className="space-y-6">
          {/* Card 4: AI Model Selection */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Zap className="w-4 h-4 text-indigo-500" /> AI Provider & Model Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Primary AI Provider</Label>
                <select
                  value={aiProvider}
                  onChange={e => setAiProvider(e.target.value as any)}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-border bg-background text-foreground mt-1"
                >
                  <option value="groq">Groq AI (Ultra Fast)</option>
                  <option value="gemini">Google Gemini AI</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Model Variant</Label>
                <Input
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="text-xs h-9 mt-1 font-mono"
                  placeholder="e.g. llama-3.3-70b-versatile"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Temperature (Sampling Creativity)</span>
                  <span className="font-mono text-indigo-500">{temperature}</span>
                </div>
                <input
                  type="range"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Behavioral Features & Quota Guardrails */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-amber-500" /> Quota Guardrails & Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold block">Student Weakness Weighting</Label>
                  <span className="text-[10px] text-muted-foreground">Allocates 60% of test questions to low-accuracy topics</span>
                </div>
                <Switch
                  checked={enableWeaknessTargeting}
                  onCheckedChange={setEnableWeaknessTargeting}
                />
              </div>

              <div>
                <Label className="font-bold">Max Token Spend Limit Per Session</Label>
                <Input
                  type="number"
                  value={maxTokenSpend}
                  onChange={e => setMaxTokenSpend(Number(e.target.value))}
                  className="text-xs h-9 mt-1 font-mono"
                  placeholder="e.g. 5000"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">Prevents excessive API token depletion.</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <Label className="font-bold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-red-500" /> Lock Preset for Students
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Forces all AI Mocks to use this exact admin setup</span>
                </div>
                <Switch
                  checked={isLockedForStudents}
                  onCheckedChange={setIsLockedForStudents}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
