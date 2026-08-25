import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles, Wand2, BookOpen, CheckCircle, AlertTriangle, Loader2,
  Copy, FileText, BrainCircuit, ClipboardList, RefreshCw, Key, Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { callGroqAPI } from '@/services/aiService';
import { aiRateLimiter } from '@/services/aiRateLimiter';
import type { AIQuotaStatus } from '@/services/aiRateLimiter';
import { AISimulationTester } from '@/components/admin/AISimulationTester';
import { AIBrandingAuditTester } from '@/components/admin/AIBrandingAuditTester';

type AITool = 'generate_question' | 'explain' | 'validate' | 'flashcards' | 'lesson_notes' | 'quiz' | 'admin_assistant';

const TOOLS: { id: AITool; label: string; icon: any; description: string; placeholder: string }[] = [
  {
    id: 'generate_question',
    label: 'Generate Question',
    icon: BrainCircuit,
    description: 'Generate a JAMB-style MCQ question from a topic.',
    placeholder: 'Enter topic e.g. "Newton\'s Laws of Motion, Mechanics"'
  },
  {
    id: 'explain',
    label: 'Explain Concept',
    icon: BookOpen,
    description: 'Get a clear, student-friendly explanation of any JAMB concept.',
    placeholder: 'Enter the concept e.g. "Photoelectric Effect"'
  },
  {
    id: 'validate',
    label: 'Validate & Correct',
    icon: CheckCircle,
    description: 'Paste a question to check for errors, duplicate options, or wrong answers.',
    placeholder: 'Paste your question text here...'
  },
  {
    id: 'flashcards',
    label: 'Generate Flashcards',
    icon: ClipboardList,
    description: 'Generate a set of study flashcards for a topic.',
    placeholder: 'Enter topic e.g. "Organic Chemistry: Alkanes"'
  },
  {
    id: 'lesson_notes',
    label: 'Lesson Notes',
    icon: FileText,
    description: 'Generate comprehensive lesson notes for any JAMB topic.',
    placeholder: 'Enter topic e.g. "Electromagnetic Induction"'
  },
  {
    id: 'quiz',
    label: 'Quick Quiz Pack',
    icon: Sparkles,
    description: 'Generate a 5-question quiz pack on any topic.',
    placeholder: 'Enter topic e.g. "Cell Biology"'
  },
  {
    id: 'admin_assistant',
    label: 'OS Assistant',
    icon: Wand2,
    description: 'Ask the AI to analyze data, draft emails, create study plans, or predict difficult questions.',
    placeholder: 'e.g. Draft a warning email to students with < 30% attendance...'
  }
];

const buildPrompt = (toolId: AITool, difficulty: string, input: string): string => {
  switch (toolId) {
    case 'generate_question':
      return `Generate a JAMB-style multiple-choice question for Nigerian secondary school students on the topic: "${input}". Difficulty: ${difficulty}. Format as JSON: {"question": "", "options": ["A: ...", "B: ...", "C: ...", "D: ..."], "correct_answer": "A", "explanation": ""}`;
    case 'explain':
      return `Explain this JAMB concept clearly and concisely for a Nigerian secondary school student preparing for UTME: "${input}". Use simple language, an analogy, and a key formula if applicable.`;
    case 'validate':
      return `You are a JAMB question quality checker. Review this question for: spelling errors, grammatical errors, ambiguous options, duplicate options, incorrect answers, and JAMB syllabus alignment. Provide a detailed report and suggest corrections:\n\n${input}`;
    case 'flashcards':
      return `Generate 8 study flashcards for JAMB topic: "${input}". Format as a numbered list where each item has FRONT: (question/term) and BACK: (answer/definition).`;
    case 'lesson_notes':
      return `Generate comprehensive lesson notes for JAMB topic: "${input}". Include: learning objectives, key definitions, core concepts with examples, common exam question patterns, and 3 practice questions with answers.`;
    case 'quiz':
      return `Generate a 5-question JAMB-style quiz pack on topic: "${input}". Difficulty: ${difficulty}. Format as JSON array: [{"question": "", "options": ["A: ...", "B: ...", "C: ...", "D: ..."], "correct_answer": "A", "explanation": ""}]`;
    case 'admin_assistant':
      return `You are the AI Admin Assistant for Scholars Resort. Use your analytical and generative capabilities to assist the platform administrator with their request. Request: "${input}". Provide a professional, structured, and highly detailed response suitable for an enterprise OS.`;
    default:
      return input;
  }
};

export const AdminAITab = () => {
  const [activeView, setActiveView] = useState<'tools' | 'branding_audit' | 'simulation'>('branding_audit');
  const [activeTool, setActiveTool] = useState<AITool>('generate_question');
  const [input, setInput] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // AI Monitoring & API Key state
  const [quotaStatus, setQuotaStatus] = useState<AIQuotaStatus | null>(null);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [updatingKey, setUpdatingKey] = useState(false);

  useEffect(() => {
    loadQuota();
  }, []);

  const loadQuota = async () => {
    const status = await aiRateLimiter.getQuotaStatus();
    setQuotaStatus(status);
  };

  const handleUpdateKey = async () => {
    if (!newKeyInput.trim()) {
      toast.error('Please enter a valid Groq/Gemini API Key.');
      return;
    }
    setUpdatingKey(true);
    try {
      const updated = await aiRateLimiter.updateKeyAndResetQuota(newKeyInput.trim(), 'gemini', 100000);
      setQuotaStatus(updated);
      setNewKeyInput('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdatingKey(false);
    }
  };

  const currentTool = TOOLS.find(t => t.id === activeTool)!;

  const handleRun = async () => {
    if (!input.trim()) {
      toast.error('Please enter a topic or question.');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const prompt = buildPrompt(activeTool, difficulty, input);
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setResult(content || 'No response from AI.');
      await aiRateLimiter.recordTokenUsage(650);
      await loadQuota();
      toast.success('Generated successfully via AI Engine!');
    } catch (err: any) {
      toast.error('AI request failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  const handleSaveQuestion = async () => {
    // Try to parse and save to questions table if it's a generate_question result
    setSaveStatus('saving');
    try {
      const jsonStart = result.indexOf('{');
      const jsonEnd = result.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No valid JSON in response. Please review and save manually.');
      
      const parsed = JSON.parse(result.substring(jsonStart, jsonEnd + 1));
      
      // Get the first active subject as fallback
      const { data: subjects } = await supabase.from('subjects').select('id').limit(1).maybeSingle();
      
      const { error } = await supabase.from('questions').insert({
        subject_id: subjects?.id,
        question_text: parsed.question || parsed.question_text,
        options: parsed.options,
        correct_answer: parsed.correct_answer,
        explanation: parsed.explanation,
        difficulty,
        is_active: false, // Saved as draft for review
      });
      if (error) throw error;
      toast.success('Question saved as Draft! Review it in the Question Bank.');
      setSaveStatus('saved');
    } catch (err: any) {
      toast.error(err.message);
      setSaveStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">AI Content Studio & Monitoring</h2>
          <p className="text-slate-400 text-sm mt-1">Monitor AI API token usage, manage Gemini/Groq keys, and test backend AI generation integrity.</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('branding_audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeView === 'branding_audit'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AI Branding Audit
          </button>
          <button
            onClick={() => setActiveView('simulation')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeView === 'simulation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AI Simulation Verifier
          </button>
          <button
            onClick={() => setActiveView('tools')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeView === 'tools'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Interactive Tools
          </button>
        </div>
      </div>

      {activeView === 'branding_audit' ? (
        <AIBrandingAuditTester />
      ) : activeView === 'simulation' ? (
        <AISimulationTester />
      ) : (
        <>
          {/* AI Token Quota Monitoring & API Key Replacement Card */}
          {quotaStatus && (
        <Card className={`border transition-all ${quotaStatus.warningTriggered ? 'bg-amber-950/40 border-amber-600/60' : 'bg-slate-900 border-slate-800'}`}>
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              
              {/* Usage Stats */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${quotaStatus.warningTriggered ? 'text-amber-400 animate-pulse' : 'text-purple-400'}`} />
                  <span className="font-bold text-base text-slate-100">AI API Token Quota Status</span>
                  {quotaStatus.warningTriggered && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Threshold Alert (80%+ Consumed)
                    </span>
                  )}
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      quotaStatus.warningTriggered ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
                    }`}
                    style={{ width: `${Math.min(100, (quotaStatus.tokensUsed / quotaStatus.totalLimit) * 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Used: <strong className="text-slate-200">{quotaStatus.tokensUsed.toLocaleString()}</strong> / {quotaStatus.totalLimit.toLocaleString()} Tokens</span>
                  <span>Usage: <strong className={quotaStatus.warningTriggered ? 'text-amber-400' : 'text-purple-400'}>{Math.round((quotaStatus.tokensUsed / quotaStatus.totalLimit) * 100)}%</strong></span>
                </div>
              </div>

              {/* Replace Key Input */}
              <div className="w-full lg:w-96 space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" /> Replace API Key & Reset Quota
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Enter new AI API Key (gsk_...)"
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs font-mono text-slate-100"
                  />
                  <Button
                    onClick={handleUpdateKey}
                    disabled={updatingKey || !newKeyInput.trim()}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-xs font-semibold shrink-0"
                  >
                    {updatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update & Reset'}
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Tool Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => { setActiveTool(tool.id); setResult(''); setInput(''); }}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center ${
              activeTool === tool.id
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <tool.icon className="w-6 h-6" />
            <span className="text-xs font-medium leading-tight">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <currentTool.icon className="w-4 h-4 text-purple-400" />
              {currentTool.label}
            </CardTitle>
            <CardDescription className="text-slate-400">{currentTool.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={currentTool.placeholder}
              rows={6}
              className="bg-slate-950 border-slate-700 resize-none"
            />
            <div className="flex gap-3 items-center">
              <div className="space-y-1 flex-1">
                <label className="text-xs text-slate-400">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-sm text-slate-200"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <Button
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className="mt-5 gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" /> AI Output
              </CardTitle>
              {result && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-slate-700 gap-1 text-xs" onClick={handleCopy}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-700 gap-1 text-xs" onClick={() => { setResult(''); setInput(''); }}>
                    <RefreshCw className="w-3 h-3" /> Clear
                  </Button>
                  {activeTool === 'generate_question' && (
                    <Button
                      size="sm"
                      className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                      onClick={handleSaveQuestion}
                      disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    >
                      {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      {saveStatus === 'saved' ? 'Saved!' : 'Save as Draft'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <p className="text-sm text-slate-400">AI is generating content...</p>
              </div>
            ) : result ? (
              <div className="bg-slate-950 rounded-lg p-5 border border-slate-800 max-h-[500px] overflow-y-auto">
                <div className="prose prose-invert max-w-none text-slate-200 text-sm space-y-3 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-slate-800 [&_th]:border [&_th]:border-slate-700 [&_th]:p-2 [&_th]:bg-slate-900 [&_td]:border [&_td]:border-slate-800 [&_td]:p-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-purple-300 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-100">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-slate-800 rounded-xl">
                <BrainCircuit className="w-10 h-10 text-slate-700" />
                <p className="text-sm text-slate-500">AI output will appear here</p>
              </div>
            )}

            {result && activeTool === 'validate' && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Review the AI's suggestions carefully before making changes to your question bank.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
};
