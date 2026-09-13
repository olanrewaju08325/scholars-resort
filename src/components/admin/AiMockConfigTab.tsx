import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  BrainCircuit, Sliders, Cpu, 
  Target, Save, RefreshCw, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

export interface AiMockConfigState {
  presetName: string;
  databaseVsAiRatio: number; // e.g. 80 = 80% DB, 20% AI
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  aiProvider: 'groq' | 'gemini';
  enableWeaknessWeighting: boolean;
  maxTokensPerMock: number;
  allowCustomSubjectSelect: boolean;
  targetSubjectsCount: number;
  customPromptInstructions: string;
}

export const AiMockConfigTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AiMockConfigState>({
    presetName: 'Standard National JAMB UTME AI Mock',
    databaseVsAiRatio: 80,
    difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
    aiProvider: 'groq',
    enableWeaknessWeighting: true,
    maxTokensPerMock: 4000,
    allowCustomSubjectSelect: true,
    targetSubjectsCount: 4,
    customPromptInstructions: 'Generate authentic JAMB UTME past-question style options and comprehensive explanations based on official Nigerian secondary syllabus.'
  });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/ai-mock-config');
      const data = await res.json();
      if (data && data.success && data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/ai-mock-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();

      if (data && data.success) {
        toast.success('AI Mock Exam Engine configuration updated successfully!');
      } else {
        toast.error(data.error || 'Failed to update AI Mock configuration');
      }
    } catch (err: any) {
      toast.error('Save error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalDiffPct = config.difficultyDistribution.easy + config.difficultyDistribution.medium + config.difficultyDistribution.hard;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading JAMB AI Mock Engine Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800/40 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold font-display">JAMB AI Mock Exam Engine Configurator</h1>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-semibold text-xs">
              Admin Proctored
            </Badge>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl">
            Configure how the dynamic AI-Powered CBT Mock Exam generates questions, blends real database past papers with AI synthetic questions, weights student weaknesses, and enforces token caps.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 shrink-0"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving Config...' : 'Save AI Mock Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Preset & Hybrid Ratio */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Preset & Question Hybrid Ratio
            </CardTitle>
            <CardDescription className="text-xs">
              Define the public preset title and control the balance between authentic database questions and AI synthetic questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Active Mock Preset Name</Label>
              <Input
                value={config.presetName}
                onChange={(e) => setConfig({ ...config, presetName: e.target.value })}
                placeholder="e.g. National JAMB UTME Adaptive Grand Mock"
                className="text-xs bg-muted/40"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Question Mix Ratio</Label>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {config.databaseVsAiRatio}% Real Past Qs / {100 - config.databaseVsAiRatio}% AI Synthetic
                </span>
              </div>

              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={config.databaseVsAiRatio}
                onChange={(e) => setConfig({ ...config, databaseVsAiRatio: Number(e.target.value) })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />

              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>50% Synthetic AI</span>
                <span>80% Real Database (Default)</span>
                <span>100% Strict Past Qs</span>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Hybrid Calculation (180 Total Questions):
              </div>
              <p className="text-muted-foreground">
                • <strong>Maths/Science/Art Core (40 Qs each)</strong>: {Math.round((40 * config.databaseVsAiRatio) / 100)} Real + {40 - Math.round((40 * config.databaseVsAiRatio) / 100)} AI Generated<br />
                • <strong>Use of English (60 Qs)</strong>: {Math.round((60 * config.databaseVsAiRatio) / 100)} Real + {60 - Math.round((60 * config.databaseVsAiRatio) / 100)} AI Generated
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: AI Provider & Model Config */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" /> AI LLM Provider & Execution Engine
            </CardTitle>
            <CardDescription className="text-xs">
              Choose the primary LLM model responsible for generating weak-topic adaptive questions and detailed step-by-step explanations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Active LLM Provider</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, aiProvider: 'groq' })}
                  className={`p-3 rounded-xl border text-left transition-all text-xs space-y-1 ${
                    config.aiProvider === 'groq'
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-semibold shadow-xs'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Groq Llama 3.3 70B</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Ultra Fast</Badge>
                  </div>
                  <p className="text-[11px] opacity-80 font-normal">Sub-second latency, ideal for real-time exam streaming.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, aiProvider: 'gemini' })}
                  className={`p-3 rounded-xl border text-left transition-all text-xs space-y-1 ${
                    config.aiProvider === 'gemini'
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-semibold shadow-xs'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Google Gemini 2.5</span>
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">High Precision</Badge>
                  </div>
                  <p className="text-[11px] opacity-80 font-normal">Deep reasoning for complex Science & Literature passages.</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Max Token Guardrail Per Mock Generation</Label>
              <Input
                type="number"
                value={config.maxTokensPerMock}
                onChange={(e) => setConfig({ ...config, maxTokensPerMock: Number(e.target.value) || 4000 })}
                className="text-xs font-mono bg-muted/40"
              />
              <p className="text-[11px] text-muted-foreground">
                Prevents API token overconsumption. Standard UTME mock generation consumes ~2,500 prompt & completion tokens.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Student Weakness Weighting & Difficulty */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" /> Student Weakness Weighting & Difficulty Mix
            </CardTitle>
            <CardDescription className="text-xs">
              Enforce adaptive topic weighting based on historical accuracy and set difficulty tier targets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Adaptive Weakness Targeting</Label>
                <p className="text-[11px] text-muted-foreground">
                  Allocates 60% of test questions to topics where the student has historical accuracy below 65%.
                </p>
              </div>
              <Switch
                checked={config.enableWeaknessWeighting}
                onCheckedChange={(checked) => setConfig({ ...config, enableWeaknessWeighting: checked })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Difficulty Tier Split</Label>
                <span className={`text-xs font-mono font-bold ${totalDiffPct === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  Easy: {config.difficultyDistribution.easy}% | Med: {config.difficultyDistribution.medium}% | Hard: {config.difficultyDistribution.hard}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Easy %</span>
                  <Input
                    type="number"
                    value={config.difficultyDistribution.easy}
                    onChange={(e) => setConfig({
                      ...config,
                      difficultyDistribution: { ...config.difficultyDistribution, easy: Number(e.target.value) || 0 }
                    })}
                    className="text-xs font-mono bg-muted/40"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Medium %</span>
                  <Input
                    type="number"
                    value={config.difficultyDistribution.medium}
                    onChange={(e) => setConfig({
                      ...config,
                      difficultyDistribution: { ...config.difficultyDistribution, medium: Number(e.target.value) || 0 }
                    })}
                    className="text-xs font-mono bg-muted/40"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Hard %</span>
                  <Input
                    type="number"
                    value={config.difficultyDistribution.hard}
                    onChange={(e) => setConfig({
                      ...config,
                      difficultyDistribution: { ...config.difficultyDistribution, hard: Number(e.target.value) || 0 }
                    })}
                    className="text-xs font-mono bg-muted/40"
                  />
                </div>
              </div>

              {totalDiffPct !== 100 && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Difficulty percentages total {totalDiffPct}%. Adjust so they sum up to 100%.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Custom System Prompt Instructions */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-500" /> JAMB Syllabus System Prompt & Guidance
            </CardTitle>
            <CardDescription className="text-xs">
              Customize the instructions passed to the AI model when generating synthetic UTME questions and explanations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">AI System Prompt Instructions</Label>
              <Textarea
                rows={5}
                value={config.customPromptInstructions}
                onChange={(e) => setConfig({ ...config, customPromptInstructions: e.target.value })}
                className="text-xs font-mono bg-muted/40 leading-relaxed"
                placeholder="Enter prompt instructions for AI mock generation..."
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Directs the AI to maintain strict JAMB UTME style formatting (4 options A-D, clear stem, non-ambiguous correct answer, and detailed step-by-step resolution).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
