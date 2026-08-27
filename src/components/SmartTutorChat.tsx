import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, Paperclip, BarChart2, Target, BookOpen, Flame, Lock } from 'lucide-react';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { chatWithTutor } from '@/services/aiService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const SmartTutorChat = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExamLocked, setIsExamLocked] = useState(() => localStorage.getItem('scholars_live_exam_active') === 'true');
  const [studentStats, setStudentStats] = useState<any>(null);
  const [uploadedMaterials, setUploadedMaterials] = useState<any[]>([]);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttachNote, setShowAttachNote] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Listen to exam proctor lock events & query database for active exam session with is_ai_tutor_locked flag
  useEffect(() => {
    const handleExamState = (e: any) => {
      const active = !!(e.detail?.active || localStorage.getItem('scholars_live_exam_active') === 'true');
      setIsExamLocked(active);
      if (active) {
        setIsOpen(false);
      }
    };

    window.addEventListener('scholars:exam-active', handleExamState);
    window.addEventListener('scholars:focus-mode', handleExamState);

    // Also check server API & Supabase database for active session lock flag
    const checkDbExamLock = async () => {
      if (!profile?.id) return;
      try {
        const res = await fetch(`/api/exam-session/active-status?userId=${profile.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.is_ai_tutor_locked) {
            setIsExamLocked(true);
            return;
          }
        }
        // Fallback Supabase direct check
        const { data: dbSession } = await supabase
          .from('exam_sessions')
          .select('is_ai_tutor_locked, status')
          .eq('user_id', profile.id)
          .eq('status', 'in_progress')
          .eq('is_ai_tutor_locked', true)
          .maybeSingle();

        if (dbSession?.is_ai_tutor_locked) {
          setIsExamLocked(true);
        } else if (localStorage.getItem('scholars_live_exam_active') !== 'true') {
          setIsExamLocked(false);
        }
      } catch {}
    };

    checkDbExamLock();
    const interval = setInterval(checkDbExamLock, 5000);

    return () => {
      window.removeEventListener('scholars:exam-active', handleExamState);
      window.removeEventListener('scholars:focus-mode', handleExamState);
      clearInterval(interval);
    };
  }, [profile?.id]);

  // Fetch performance data when chat is initialized
  useEffect(() => {
    if (!profile?.id) return;

    const loadPerformanceAndData = async () => {
      try {
        // Fetch recent exam scores with valid schema columns
        let exams: any[] = [];
        try {
          const { data } = await supabase
            .from('exam_sessions')
            .select('score, total_questions, submitted_at, status')
            .eq('user_id', profile.id)
            .order('submitted_at', { ascending: false })
            .limit(10);
          if (data) exams = data;
        } catch {}

        // Fetch user stats / weak areas if any
        let stats: any = null;
        try {
          const { data } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle();
          stats = data;
        } catch {}

        // Fetch ingested study materials if table exists
        try {
          const { data: materials } = await supabase
            .from('content_ingestion_jobs')
            .select('title, topics, summary')
            .eq('user_id', profile.id)
            .eq('status', 'completed')
            .limit(5);

          if (materials) setUploadedMaterials(materials);
        } catch {}

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
            content: `Hello ${profile.full_name?.split(' ')[0] || 'there'}! I am your AI Scholar Assistant. I have loaded your study data: your target score is ${profile.target_score || 300} for ${profile.target_university || 'JAMB'}, and your streak is ${profile.streak_days || 0} days. How can I help you master your subjects today?`
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

  const handleSend = async (textToSend?: string) => {
    if (isExamLocked || localStorage.getItem('scholars_live_exam_active') === 'true') {
      toast.error('AI Tutor is locked during live proctored CBT exams to prevent cheating.');
      setIsOpen(false);
      return;
    }

    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      // Build rich System Context with structured prompt chain
      const systemContext = {
        role: 'system',
        content: `You are an elite academic counselor and expert UTME/JAMB AI Tutor. You are analyzing ${studentStats?.fullName || 'a student'}'s preparation data for the Nigerian UTME/JAMB exam.

REAL-TIME STUDENT METRICS & PERFORMANCE PROFILE:
- Student Name: ${studentStats?.fullName || 'Student'}
- Target Score: ${studentStats?.targetScore || 300} / 400
- Target University: ${studentStats?.targetUni || 'Federal University'}
- Registered UTME Subjects: ${studentStats?.subjects?.join(', ')}
- Daily Active Streak: ${studentStats?.streakDays || 0} Days
- Historical CBT Practice Accuracy: ${studentStats?.averageAccuracy || 0}% (${studentStats?.recentExamsCount || 0} sessions completed)
- Primary Weak Areas / Bottlenecks: ${studentStats?.weakTopics?.join(', ') || 'Speed pacing, calculation accuracy'}
${uploadedMaterials.length > 0 ? `- Ingested Course Textbooks: ${uploadedMaterials.map(m => m.title + ' (' + (m.topics?.join(', ') || 'Syllabus') + ')').join('; ')}` : ''}

STRUCTURED PROMPT CHAIN INSTRUCTIONS:
You MUST structure your response into clear, non-generic, actionable sections based directly on the student's metrics:

1. DIAGNOSTIC REFLECTION:
Analyze their current score trajectory relative to their target (${studentStats?.targetScore || 300}/400) and target university (${studentStats?.targetUni}). Explicitly state the gap in points and required daily question velocity.

2. TAILORED UTME SYLLABUS BREAKDOWN:
Break down step-by-step strategies for their registered subjects (${studentStats?.subjects?.join(', ')}). Highlight high-yield topics that appear frequently in JAMB past questions.

3. ACTIONABLE REMEDIATION PLAN:
Provide a 3-step concrete study sequence for their weak areas (${studentStats?.weakTopics?.join(', ') || 'speed pacing'}).

4. STRICT FORMATTING REQUIREMENTS:
- DO NOT use any emojis under ANY circumstances.
- DO NOT output placeholders like "[Score]" or "[Uni]". Populate exact values and real Nigerian institutions.
- Use bold headings, Markdown tables, and structured bullet lists.`
      };

      const fullConversation = [systemContext, ...updatedMessages];
      const response = await chatWithTutor(fullConversation);

      setMessages([...updatedMessages, { role: 'assistant', content: response }]);
    } catch (error: any) {
      console.error('AI Tutor error:', error);
      setMessages([
        ...updatedMessages, 
        { 
          role: 'assistant', 
          content: `I am analyzing your query and study history. Please feel free to re-submit your question or ask about specific UTME topics.` 
        }
      ]);
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
          onClick={() => {
            if (isExamLocked) {
              toast.error('AI Scholar Tutor is locked during live proctored CBT exams to prevent cheating.');
              return;
            }
            setIsOpen(true);
          }} 
          className={`h-12 px-4 rounded-full shadow-2xl transition-all flex items-center gap-2 border ${
            isExamLocked 
              ? 'bg-rose-900/90 border-rose-500/50 text-rose-200 cursor-not-allowed opacity-90' 
              : 'shadow-purple-500/30 bg-purple-600 hover:bg-purple-700 text-white border-purple-400/40'
          }`}
          aria-label="Open AI Smart Tutor"
        >
          <div className="relative flex items-center justify-center">
            {isExamLocked ? <Lock className="h-5 w-5 text-rose-300" /> : <Bot className="h-5 w-5 text-white" />}
            {!isExamLocked && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-200"></span>
              </span>
            )}
          </div>
          <span className="font-bold text-xs tracking-wide">
            {isExamLocked ? 'AI Tutor Locked (Exam)' : 'AI Smart Tutor'}
          </span>
        </Button>
      )}

      {isOpen && (
        <Card className="w-80 sm:w-96 h-[560px] flex flex-col shadow-2xl border-purple-500/30 bg-background">
          <CardHeader className={`${isExamLocked ? 'bg-rose-900' : 'bg-purple-600'} text-white rounded-t-lg flex flex-row items-center justify-between py-3 px-4 shrink-0`}>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              {isExamLocked ? <Lock className="h-5 w-5 text-rose-300" /> : <Bot className="h-5 w-5" />} 
              {isExamLocked ? 'AI Tutor Locked' : 'AI Smart Tutor'}
              {studentStats && !isExamLocked && (
                <span className="text-[10px] bg-purple-800/80 px-2 py-0.5 rounded-full font-mono text-purple-200">
                  Target: {studentStats.targetScore}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-purple-700 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Locked Exam Notice Banner */}
          {isExamLocked && (
            <div className="bg-rose-950/80 border-b border-rose-500/30 p-3 text-xs text-rose-200 flex items-start gap-2 shrink-0">
              <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Proctor Mode Active</p>
                <p className="text-[11px] text-rose-300/90 mt-0.5">
                  AI Scholar Tutor is locked during live CBT exams to ensure academic integrity and prevent cheating.
                </p>
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
                {msg.role === 'user' ? (
                  <div className="p-2.5 rounded-xl text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap bg-purple-600 text-white rounded-tr-none">
                    {msg.content}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl text-xs leading-relaxed max-w-[88%] bg-card border border-border text-foreground rounded-tl-none shadow-sm space-y-2">
                    <Markdown
                      components={{
                        table: ({ node, ...props }) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-border border text-[11px]" {...props} /></div>,
                        th: ({ node, ...props }) => <th className="bg-muted/60 px-2 py-1 text-left font-bold text-foreground" {...props} />,
                        td: ({ node, ...props }) => <td className="border-t border-border px-2 py-1 text-muted-foreground" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="text-sm font-bold text-primary mt-2 mb-1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xs font-bold text-primary mt-2 mb-1" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-xs font-semibold text-foreground mt-1 mb-0.5" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-0.5 text-foreground" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-0.5 text-foreground" {...props} />
                      }}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                )}
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
                disabled={isExamLocked}
                title={isExamLocked ? "Locked during exam" : "Feed study material or notes to AI"}
                className={`h-9 w-9 shrink-0 ${showAttachNote ? 'border-purple-500 text-purple-400' : 'text-muted-foreground'}`}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input 
                placeholder={isExamLocked ? "AI Tutor locked during exam..." : "Ask your AI Tutor..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={loading || isExamLocked}
                className="text-xs h-9"
              />
              <Button onClick={() => handleSend()} size="icon" className="h-9 w-9 bg-purple-600 hover:bg-purple-700 text-white shrink-0" disabled={loading || !input.trim() || isExamLocked}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

