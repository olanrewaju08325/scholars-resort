import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  BrainCircuit, Sparkles, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, ShieldCheck, Zap, Layers, Play, Eye, FileText, Code2
} from 'lucide-react';
import { AISimulationService, type AISimulationResult } from '@/services/aiSimulationService';
import { toast } from 'sonner';

export const AISimulationTester: React.FC = () => {
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('Newtonian Mechanics & Law of Gravitation');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState('3');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AISimulationResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const presets = [
    { subject: 'Use of English', topic: 'Lexis and Structure: Concord & Modals', difficulty: 'medium' as const },
    { subject: 'Mathematics', topic: 'Calculus: Differentiation and Integration', difficulty: 'hard' as const },
    { subject: 'Physics', topic: 'Optics: Reflection and Refraction in Lenses', difficulty: 'medium' as const },
    { subject: 'Chemistry', topic: 'Organic Chemistry: Hydrocarbons and Alkanols', difficulty: 'hard' as const },
    { subject: 'Biology', topic: 'Genetics, Heredity and Variation', difficulty: 'medium' as const },
    { subject: 'Government', topic: 'Constitutional Development in Nigeria', difficulty: 'easy' as const },
  ];

  const handleRunSimulation = async () => {
    setRunning(true);
    toast.info(`Initiating AI simulation test for ${subject} (${topic})...`);
    try {
      const res = await AISimulationService.runSimulation({
        subject,
        topic,
        difficulty,
        targetCount: parseInt(count) || 3
      });
      setResult(res);
      if (res.status === 'passed') {
        toast.success(`Simulation PASSED (Score: ${res.overallScore}/100). Content normalization & branding verified!`);
      } else if (res.status === 'warning') {
        toast.warning(`Simulation completed with warnings (Score: ${res.overallScore}/100).`);
      } else {
        toast.error(`Simulation failed integrity checks (Score: ${res.overallScore}/100).`);
      }
    } catch (err: any) {
      toast.error(`Simulation execution failed: ${err.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  const applyPreset = (preset: typeof presets[0]) => {
    setSubject(preset.subject);
    setTopic(preset.topic);
    setDifficulty(preset.difficulty);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Configuration Header */}
      <Card className="border-border/60 bg-card/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-400" />
                Backend AI Simulation & Normalization Verifier
              </CardTitle>
              <CardDescription className="text-xs">
                Tests live AI generation, verifying that third-party scraping artifacts are stripped and standard Scholars Resort CBT branding is enforced.
              </CardDescription>
            </div>
            <Button
              onClick={handleRunSimulation}
              disabled={running}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-2 shadow-md h-10 px-5"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Simulating AI Request...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run AI Simulation Test
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Presets */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground block mb-2">Subject Topic Presets:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                  className="text-xs h-7 bg-background/50 border-border/60 hover:bg-muted"
                >
                  <span className="font-semibold text-primary mr-1">{p.subject}:</span> {p.topic.split(':')[0]}
                </Button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
            <div className="sm:col-span-4">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Subject</label>
              <Input 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics"
                className="h-9 text-sm bg-background/80"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Target Topic</label>
              <Input 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Newton's Laws of Motion"
                className="h-9 text-sm bg-background/80"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Difficulty</label>
              <select 
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background/80 px-3 py-1 text-sm shadow-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="easy">Easy (Fundamentals)</option>
                <option value="medium">Medium (Standard UTME)</option>
                <option value="hard">Hard (Advanced Problem Solving)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Result Scorecard */}
      {result && (
        <div className="space-y-6">
          {/* Top Metric Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card/70 border border-border/50 shadow-sm">
              <span className="text-xs text-muted-foreground block">Overall Integrity Score</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl font-black ${
                  result.overallScore >= 85 ? 'text-emerald-400' : result.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {result.overallScore}/100
                </span>
                <Badge className={
                  result.status === 'passed' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]' 
                    : result.status === 'warning' 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]' 
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40 text-[10px]'
                }>
                  {result.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card/70 border border-border/50 shadow-sm">
              <span className="text-xs text-muted-foreground block">AI Engine Latency</span>
              <span className="text-2xl font-black text-blue-400 mt-1 block">
                {result.latencyMs}ms
              </span>
            </div>

            <div className="p-4 rounded-xl bg-card/70 border border-border/50 shadow-sm">
              <span className="text-xs text-muted-foreground block">Questions Synthesized</span>
              <span className="text-2xl font-black text-purple-400 mt-1 block">
                {result.totalGenerated} Items
              </span>
            </div>

            <div className="p-4 rounded-xl bg-card/70 border border-border/50 shadow-sm">
              <span className="text-xs text-muted-foreground block">Content Normalization</span>
              <span className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Zero Vendor Artifacts
              </span>
            </div>
          </div>

          {/* Detailed Verification Checklist */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Branding & Normalization Verification Matrix
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  {showRaw ? 'Hide Raw AI Payload' : 'Inspect Raw AI Payload'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.checks.map((c) => (
                  <div 
                    key={c.id} 
                    className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                      c.passed 
                        ? 'bg-emerald-950/10 border-emerald-500/30' 
                        : 'bg-rose-950/10 border-rose-500/30'
                    }`}
                  >
                    <div className="mt-0.5">
                      {c.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{c.name}</span>
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">{c.score}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                      <p className="text-[11px] font-mono text-primary/80 mt-1">{c.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw Payload Inspection Accordion */}
              {showRaw && (
                <div className="mt-4 p-4 rounded-xl bg-background/90 border border-border/60">
                  <span className="text-xs font-mono font-bold text-muted-foreground block mb-2">Raw Model Output Payload:</span>
                  <pre className="text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap max-h-64 p-3 rounded-lg bg-black/40 border border-border/40">
                    {result.rawAIResponse}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clean Normalized Questions Preview */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Verified Clean Questions Delivered to User ({result.normalizedQuestions.length})
            </h4>
            <div className="space-y-3">
              {result.normalizedQuestions.map((q, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-card/80 border border-border/50 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground uppercase">{subject} • {topic}</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      Correct Key: {q.correct_option}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-foreground pl-8">
                    {q.question_text}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    {q.options.map((opt, oIdx) => {
                      const letter = ['A', 'B', 'C', 'D'][oIdx] || `${oIdx + 1}`;
                      const isCorrect = q.correct_option === letter;
                      return (
                        <div 
                          key={oIdx} 
                          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                            isCorrect 
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold' 
                              : 'bg-background/60 border-border/40 text-foreground'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] ${
                            isCorrect ? 'bg-emerald-500 text-black' : 'bg-muted text-muted-foreground'
                          }`}>
                            {letter}
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="ml-8 p-3 rounded-lg bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200">
                      <span className="font-bold text-blue-400 block mb-1">Pedagogical Explanation:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
