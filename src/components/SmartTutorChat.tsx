import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, Paperclip, BarChart2, Target, BookOpen, Flame, Key, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { chatWithTutor, setLocalGroqApiKey, getGroqApiKey } from '@/services/aiService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const SmartTutorChat = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [studentStats, setStudentStats] = useState<any>(null);
  const [uploadedMaterials, setUploadedMaterials] = useState<any[]>([]);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttachNote, setShowAttachNote] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [hasValidKey, setHasValidKey] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check if API key is present
  useEffect(() => {
    getGroqApiKey().then(k => {
      setHasValidKey(Boolean(k && k.length > 10));
    });
  }, []);

  // Fetch performance data when chat is initialized
  useEffect(() => {
    if (!profile?.id) return;

    const loadPerformanceAndData = async () => {
      try {
        // Fetch recent exam scores
        const { data: exams } = await supabase
          .from('exam_sessions')
          .select('score, total_questions, subject, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10);

        // Fetch user stats / weak areas if any
        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        // Fetch ingested study materials
        const { data: materials } = await supabase
          .from('content_ingestion_jobs')
          .select('title, topics, summary')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .limit(5);

        if (materials) setUploadedMaterials(materials);

        const totalAttempts = exams?.length || 0;
        const avgScore = (totalAttempts > 0 && exams)
          ? Math.round(exams.reduce((acc, curr) => acc + (curr.score / (curr.total_questions || 1)) * 100, 0) / totalAttempts)
          : 0;

        setStudentStats({
          fullName: profile.full_name || 'Student',
          targetScore: profile.target_score || 300,
          targetUni: profile.target_university || 'Top University',
          subjects: profile.utme_subjects || ['English', 'Mathematics', 'Physics', 'Chemistry'],
          streakDays: profile.streak_days || 0,
          xp: profile.xp || 0,
          recentExamsCount: totalAttempts,
          averageAccuracy: avgScore,
          weakTopics: stats?.weak_topics || ['General Exam Speed', 'Complex Calculations'],
        });

        // Initialize greeting message
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${profile.full_name?.split(' ')[0] || 'there'}! I am your AI Tutor powered by Groq. I have loaded your study data: your target score is ${profile.target_score || 300} for ${profile.target_university || 'JAMB'}, and your streak is ${profile.streak_days || 0} days. How can I help you master your subjects today?`
          }
        ]);
      } catch (err) {
        console.error('Failed to load tutor context:', err);
      }
    };

    loadPerformanceAndData();
  }, [profile]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSaveGroqKey = async () => {
    if (!keyInput.trim() || keyInput.trim().length < 10) {
      toast.error('Please enter a valid Groq API Key (starts with gsk_...)');
      return;
    }
    const cleanKey = keyInput.trim();
    setLocalGroqApiKey(cleanKey);
    setHasValidKey(true);
    setShowKeySetup(false);
    setKeyInput('');

    // If admin, also persist to Supabase admin_settings
    if (profile?.role === 'admin' || profile?.email === 'admitwise2@gmail.com') {
      try {
        await supabase.from('admin_settings').upsert({
          setting_key: 'ai_api_keys',
          setting_value: { groq: cleanKey, groq_key: cleanKey },
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      } catch {}
    }

    toast.success('Groq API Key saved successfully!');
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: 'Groq Brain connected! You can now ask me any question about your UTME subjects, novel chapters, or mock exam calculations.' }
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      // Build rich System Context
      const systemContext = {
        role: 'system',
        content: `You are an elite, highly encouraging Nigerian UTME/JAMB AI Tutor specializing in personalized guidance. You are chatting with ${studentStats?.fullName || 'a student'}.
STUDENT PROFILE & DATA:
- Target Score: ${studentStats?.targetScore || 300}/400
- Target Institution: ${studentStats?.targetUni || 'University'}
- UTME Subjects: ${studentStats?.subjects?.join(', ')}
- Current Streak: ${studentStats?.streakDays || 0} days
- Recent Practice Accuracy: ${studentStats?.averageAccuracy || 0}% across ${studentStats?.recentExamsCount || 0} exams
- Known Weak Areas: ${studentStats?.weakTopics?.join(', ') || 'None recorded yet'}
${uploadedMaterials.length > 0 ? `- Ingested Study Materials: ${uploadedMaterials.map(m => m.title + ' (' + (m.topics?.join(', ') || '') + ')').join('; ')}` : ''}

INSTRUCTIONS:
1. Always keep responses focused on Nigerian UTME/JAMB syllabus standards.
2. Incorporate the student's performance data, weak topics, and target score into your explanations.
3. Be clear, concise, and structured. Use step-by-step breakdowns for calculations or complex concepts.`
      };

      const fullConversation = [systemContext, ...updatedMessages];
      const response = await chatWithTutor(fullConversation);

      setMessages([...updatedMessages, { role: 'assistant', content: response }]);
    } catch (error: any) {
      console.error('Groq AI error:', error);
      const isKeyMissing = error?.message?.includes('API Key') || error?.message?.includes('configured') || !hasValidKey;

      if (isKeyMissing) {
        setMessages([
          ...updatedMessages,
          { 
            role: 'assistant', 
            content: 'Groq API Key is not yet configured for this deployment. Click the Key icon (🔑) at the top of this chat or in Admin Settings to connect your Groq API Key (free from console.groq.com) so we can chat immediately!' 
          }
        ]);
        setShowKeySetup(true);
      } else {
        setMessages([
          ...updatedMessages, 
          { 
            role: 'assistant', 
            content: `I encountered an issue connecting to Groq (${error?.message || 'Network timeout'}). Please tap retry or verify your Groq API Key.` 
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAttachStudyNote = async () => {
    if (!customNote.trim()) return;
    const noteText = customNote.trim();
    setCustomNote('');
    setShowAttachNote(false);
    
    toast.success('Study notes attached to AI Tutor session!');
    handleSend(`[Student Study Material Attached]: "${noteText.substring(0, 500)}...". Please summarize this material and test me on 2 key questions from it!`);
  };

  return (
    <div className="fixed bottom-6 right-4 md:bottom-6 md:right-6 z-[90] pb-[72px] md:pb-0">
      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="h-12 px-4 rounded-full shadow-2xl shadow-purple-500/30 bg-purple-600 hover:bg-purple-700 text-white relative group flex items-center gap-2 border border-purple-400/40"
          aria-label="Open AI Smart Tutor"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-200"></span>
            </span>
          </div>
          <span className="font-bold text-xs tracking-wide">AI Smart Tutor</span>
        </Button>
      )}

      {isOpen && (
        <Card className="w-80 sm:w-96 h-[560px] flex flex-col shadow-2xl border-purple-500/30 bg-background">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg flex flex-row items-center justify-between py-3 px-4 shrink-0">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bot className="h-5 w-5" /> AI Smart Tutor
              {studentStats && (
                <span className="text-[10px] bg-purple-800/80 px-2 py-0.5 rounded-full font-mono text-purple-200">
                  Target: {studentStats.targetScore}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowKeySetup(!showKeySetup)} 
                className="text-white hover:bg-purple-700 h-8 w-8"
                title="Configure Groq API Key"
              >
                <Key className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-purple-700 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Key Setup Dropdown */}
          {showKeySetup && (
            <div className="p-3 bg-purple-950/90 text-white border-b border-purple-500/30 space-y-2 shrink-0 animate-in slide-in-from-top-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-purple-200">
                  <Key className="w-3.5 h-3.5" /> Set Groq API Key (Llama 3.3)
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-purple-300" onClick={() => setShowKeySetup(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[11px] text-purple-300">
                Enter your free Groq key from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline font-bold text-white">console.groq.com</a>:
              </p>
              <div className="flex gap-1.5">
                <Input 
                  type="password"
                  placeholder="gsk_..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="h-8 text-xs bg-slate-900 border-purple-500/50 text-white"
                />
                <Button size="sm" onClick={handleSaveGroqKey} className="h-8 text-xs bg-purple-600 hover:bg-purple-700">
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Context Banner */}
          {studentStats && (
            <div className="bg-purple-950/40 border-b border-purple-500/20 px-3 py-1.5 text-[11px] text-purple-300 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" /> {studentStats.streakDays}d streak</span>
              <span className="flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5 text-emerald-400" /> {studentStats.averageAccuracy}% Accuracy</span>
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-blue-400" /> {studentStats.targetUni}</span>
            </div>
          )}

          {/* Quick Action Chips */}
          <div className="p-2 bg-muted/30 border-b border-border flex gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            <button 
              onClick={() => handleSend("Analyze my weak points based on my performance and suggest a daily study plan.")}
              disabled={loading}
              className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-full whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Weak Topics Analysis
            </button>
            <button 
              onClick={() => handleSend("Quiz me on 3 questions from my weakest subject to test my readiness.")}
              disabled={loading}
              className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 rounded-full whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <BookOpen className="w-3 h-3" /> Quick Weakness Drill
            </button>
          </div>

          {/* Custom Note Attachment Box */}
          {showAttachNote && (
            <div className="p-3 bg-purple-950/60 border-b border-purple-500/30 space-y-2 shrink-0 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-200 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Attach Study Material or Notes
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-purple-300" onClick={() => setShowAttachNote(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <textarea 
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="Paste paragraph, formula, or study note here..."
                className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200 h-16 resize-none focus:outline-none focus:border-purple-500"
              />
              <Button size="sm" onClick={handleAttachStudyNote} disabled={!customNote.trim()} className="w-full h-7 text-xs bg-purple-600 hover:bg-purple-700">
                Feed Material to AI Tutor
              </Button>
            </div>
          )}

          {/* Chat Messages */}
          <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/10">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                )}
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-purple-600 text-white rounded-tr-none' 
                    : 'bg-card border border-border text-foreground rounded-tl-none shadow-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5 items-center text-muted-foreground text-xs italic">
                <Bot className="h-4 w-4 animate-bounce text-purple-400" />
                <span>Thinking & analyzing your performance data...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </CardContent>

          {/* Footer */}
          <CardFooter className="p-2.5 bg-card border-t border-border flex flex-col gap-2 shrink-0">
            <div className="flex w-full gap-2 items-center">
              <Button 
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowAttachNote(!showAttachNote)}
                title="Feed study material or notes to AI"
                className={`h-9 w-9 shrink-0 ${showAttachNote ? 'border-purple-500 text-purple-400' : 'text-muted-foreground'}`}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input 
                placeholder="Ask your AI Tutor..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={loading}
                className="text-xs h-9"
              />
              <Button onClick={() => handleSend()} size="icon" className="h-9 w-9 bg-purple-600 hover:bg-purple-700 text-white shrink-0" disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

