import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Timer, BrainCircuit, Calendar, Swords, BookOpen, 
  History, Trophy, Target, Zap, RotateCcw, Monitor, CheckCircle2, ArrowRight,
  CheckCircle, XCircle, AlertCircle, Trash2, Filter, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getCanonicalSubjectByName, normalizeToCanonicalSubjectName } from '@/utils/subjectTaxonomy';
import { MathText } from '@/components/MathText';

export default function CBTCenter() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialTab = location.pathname === '/history' || searchParams.get('tab') === 'history' ? 'history' : 'practice';

  const [activeTab, setActiveTab] = useState<'practice' | 'mocks' | 'tournaments' | 'history'>(initialTab);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'practice' | 'mock'>('all');
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [selectedMistakeSubject, setSelectedMistakeSubject] = useState<string>('all');
  const [expandedMistakeId, setExpandedMistakeId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { profile } = useAuth();

  const userSubjects = (profile?.utme_subjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry'])
    .map((s: string) => normalizeToCanonicalSubjectName(s));

  useEffect(() => {
    const fetchActiveSession = async () => {
      if (!profile) return;
      try {
        const { data } = await supabase
          .from('exam_sessions')
          .select('id, status, started_at')
          .eq('user_id', profile.id)
          .eq('status', 'in_progress')
          .maybeSingle();
        if (data) setActiveSession(data);
      } catch (err) {
        console.warn('Active session check notice:', err);
      }
    };
    fetchActiveSession();
  }, [profile]);


  useEffect(() => {
    // Load local mistakes
    try {
      const stored = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
      setMistakes(Array.isArray(stored) ? stored : []);
    } catch {
      setMistakes([]);
    }

    const fetchHistory = async () => {
      if (!profile) return;
      setHistoryLoading(true);
      try {
        const { data } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('user_id', profile.id)
          .order('started_at', { ascending: false })
          .limit(50);

        // Also merge with local completed sessions
        const localHistory = JSON.parse(localStorage.getItem('jamb_practice_history') || '[]');
        const combined = [...(data || [])];
        if (Array.isArray(localHistory)) {
          const existingIds = new Set(combined.map(s => s.id));
          localHistory.forEach((loc: any) => {
            if (!existingIds.has(loc.id)) {
              combined.push(loc);
            }
          });
        }
        setHistorySessions(combined);
      } catch (err) {
        console.warn('Error fetching exam history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [profile, activeTab]);

  const practiceModes = [
    { title: 'Subject Practice', desc: 'Focus on a single subject (e.g. Physics)', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/practice?mode=subject' },
    { title: 'Topic Drill', desc: 'Master specific topics (e.g. Kinematics)', icon: Target, color: 'text-green-500', bg: 'bg-green-500/10', path: '/practice?mode=topic' },
    { title: 'Speed Test', desc: '20 questions in 10 minutes. Test your reflexes.', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10', path: '/practice?mode=speed' },
    { title: 'Daily Quiz', desc: 'Your personalized 15-minute daily challenge.', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10', path: '/practice?mode=daily' },
  ];

  const mockModes = [
    { title: 'Full JAMB Mock', desc: 'Standard 4-subject, 400 score, 2-hour exam.', icon: Timer, color: 'text-red-500', bg: 'bg-red-500/10', badge: 'Standard', path: '/cbt/full-mock' },
    { title: 'Past Questions', desc: 'Practice with real exams from previous years.', icon: History, color: 'text-orange-500', bg: 'bg-orange-500/10', path: '/cbt/past-questions' },
    { title: 'AI Generated Mock', desc: 'Dynamically generated based on your weak points.', icon: BrainCircuit, color: 'text-indigo-500', bg: 'bg-indigo-500/10', badge: 'AI Powered', path: '/cbt/ai-mock' },
  ];

  const [tournaments, setTournaments] = useState<any[]>([]);
  useEffect(() => {
    const fetchTournaments = async () => {
      const { data } = await supabase.from('tournaments').select('*').in('status', ['upcoming', 'active']).order('start_time', { ascending: true });
      if (data) setTournaments(data);
    };
    fetchTournaments();
  }, []);

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8 bg-background text-foreground min-h-screen pb-20">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6"
      >
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <Timer className="w-8 h-8 text-primary" /> CBT Testing Center
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">Simulate the real JAMB experience or hone your skills with targeted practice.</p>
        </div>
        
        {/* Active Session Warning / Resume */}
        {activeSession ? (
          <div className="flex gap-2">
            <Button variant="default" className="shadow-lg bg-orange-500 hover:bg-orange-600" asChild>
              <Link to="/exam">
                <RotateCcw className="w-4 h-4 mr-2" /> Resume Exam
              </Link>
            </Button>
            <Button variant="outline" className="shadow-lg text-destructive border-destructive hover:bg-destructive/10" onClick={async () => {
              await supabase.from('exam_sessions').update({ status: 'abandoned' }).eq('id', activeSession.id);
              setActiveSession(null);
            }}>
              Abandon
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="shadow-lg" asChild>
            <Link to="/exam">
              <RotateCcw className="w-4 h-4 mr-2" /> Start New Exam
            </Link>
          </Button>
        )}
      </motion.div>

      {/* CBT Device Recommendation Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900/60 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-slate-200 shadow-md">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              Best CBT Exam Experience Recommendation
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              For the most realistic JAMB exam environment—featuring standard desktop keyboard shortcuts (<kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">A</kbd>, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">B</kbd>, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">C</kbd>, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">D</kbd>, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">N</kbd>, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-blue-300 font-mono">P</kbd>), full split-screen question navigation, and high-speed multi-subject toggles—we strongly advise using a <strong>Laptop or Desktop Computer</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        <Button 
          variant={activeTab === 'practice' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('practice')}
          className="rounded-full"
        >
          <Target className="w-4 h-4 mr-2" /> Targeted Practice
        </Button>
        <Button 
          variant={activeTab === 'mocks' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('mocks')}
          className="rounded-full"
        >
          <Timer className="w-4 h-4 mr-2" /> Full Length Mocks
        </Button>
        <Button 
          variant={activeTab === 'tournaments' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('tournaments')}
          className="rounded-full"
        >
          <Swords className="w-4 h-4 mr-2" /> National Tournaments
        </Button>
        <Button 
          variant={activeTab === 'history' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('history')}
          className="rounded-full relative"
        >
          <History className="w-4 h-4 mr-2" /> History & Mistakes
          {mistakes.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold animate-pulse">
              {mistakes.length}
            </span>
          )}
        </Button>
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        className="mt-6"
      >
        {activeTab === 'practice' && (
          <div className="space-y-6">
            {/* Quick UTME Subject Drill Bar */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Your 4 Registered UTME Subjects
                  </h3>
                  <p className="text-xs text-muted-foreground">Jump directly into single-subject practice or topic drilling</p>
                </div>
                <Link to="/profile" className="text-xs text-primary hover:underline font-medium">
                  Change Subjects
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {userSubjects.map((subName) => {
                  const canonical = getCanonicalSubjectByName(subName);
                  const subId = canonical?.id || '';
                  return (
                    <button
                      key={subName}
                      onClick={() => navigate(`/practice?mode=subject&subjectId=${subId}`)}
                      className="p-3 rounded-lg bg-muted/40 hover:bg-primary/10 hover:border-primary/40 border border-border text-left transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                          {subName}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {canonical?.category || 'UTME Core'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {practiceModes.map((mode, i) => (
                <Card 
                  key={i} 
                  className="bg-card hover:bg-accent border-border transition-all duration-200 hover:shadow-md hover:-translate-y-1 cursor-pointer group"
                  onClick={() => navigate(mode.path)}
                >
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl ${mode.bg} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                      <mode.icon className={`w-6 h-6 ${mode.color}`} />
                    </div>
                    <h3 className="font-bold font-display text-lg mb-2">{mode.title}</h3>
                    <p className="text-sm text-muted-foreground">{mode.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mocks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mockModes.map((mode, i) => (
                <Card key={i} className="bg-card hover:border-primary/50 border-border transition-all duration-200 hover:shadow-lg relative overflow-hidden group">
                  {mode.badge && (
                    <div className="absolute top-4 right-4 text-xs font-bold uppercase px-2 py-1 bg-primary/10 text-primary rounded-full">
                      {mode.badge}
                    </div>
                  )}
                  <CardContent className="p-8">
                    <mode.icon className={`w-12 h-12 ${mode.color} mb-6 transition-transform group-hover:scale-110`} />
                    <h3 className="font-bold font-display text-2xl mb-3">{mode.title}</h3>
                    <p className="text-muted-foreground mb-8">{mode.desc}</p>
                    <Button asChild className="w-full" variant="default">
                      <Link to={mode.path || "/exam"}>Start Exam</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tournaments' && (
          <div className="space-y-6">
            {tournaments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No upcoming tournaments right now. Check back later!</div>
            ) : tournaments.map((t) => (
              <Card key={t.id} className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Trophy className="w-64 h-64" />
                </div>
                <CardHeader className="relative z-10 pb-0">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-xs font-bold uppercase tracking-wider text-indigo-300 w-max mb-4">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> {t.status}
                  </div>
                  <CardTitle className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
                    {t.title}
                  </CardTitle>
                  <CardDescription className="text-indigo-200 text-lg">
                    {t.description || 'Compete with thousands of students nationwide.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8 pb-8 flex flex-col sm:flex-row gap-6">
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1">
                    <p className="text-sm text-indigo-300 font-semibold uppercase mb-1">Starts In</p>
                    <p className="text-xl font-bold font-display text-white">{new Date(t.start_time).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1">
                    <p className="text-sm text-indigo-300 font-semibold uppercase mb-1">Entry</p>
                    <p className="text-xl font-bold font-display text-white">{t.entry_fee ? `₦${t.entry_fee}` : 'Free'}</p>
                  </div>
                  <Button asChild className="h-auto bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-lg px-8 shadow-xl shadow-indigo-500/20">
                    <Link to={`/tournaments/${t.id}`}>Enter Arena</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8">
            {/* Performance Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-medium">Total Sessions</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-display font-bold text-foreground">
                      {historySessions.length}
                    </span>
                    <span className="text-xs text-muted-foreground">attempts</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-medium">Avg Accuracy</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-display font-bold text-emerald-500">
                      {historySessions.length > 0 
                        ? Math.round(
                            historySessions.reduce((acc, s) => {
                              const total = s.total_questions || 20;
                              const score = s.score || s.total_score || 0;
                              return acc + (total > 0 ? (score / total) * 100 : 0);
                            }, 0) / historySessions.length
                          )
                        : 0}%
                    </span>
                    <span className="text-xs text-muted-foreground">overall</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-medium">Mistake Bank</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-display font-bold text-rose-500">
                      {mistakes.length}
                    </span>
                    <span className="text-xs text-muted-foreground">questions</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-medium">CBT Mocks</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-display font-bold text-indigo-500">
                      {historySessions.filter(s => s.mode?.includes('mock') || s.total_questions >= 40).length}
                    </span>
                    <span className="text-xs text-muted-foreground">completed</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Smart Mistake Bank Retake Callout */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-950/40 via-background to-orange-950/30 border border-rose-500/30 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                  <RotateCcw className="w-5 h-5 animate-spin-reverse" />
                  <span>Smart Mistake Bank Engine</span>
                </div>
                <h3 className="text-xl font-bold font-display text-foreground">
                  Turn Your Weaknesses Into Guaranteed Points
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every question you answer incorrectly in Practice or CBT mode is automatically captured here. Retake them in an isolated drill until you achieve 100% accuracy.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {mistakes.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your mistake bank?")) {
                        localStorage.removeItem('jamb_mistake_bank');
                        setMistakes([]);
                        toast.success("Mistake bank cleared.");
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Clear Bank
                  </Button>
                )}

                <Button
                  disabled={mistakes.length === 0}
                  onClick={() => navigate('/practice/session', { state: { mode: 'mistakes' } })}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-rose-600/20"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Practice Missed Questions ({mistakes.length})
                </Button>
              </div>
            </div>

            {/* Section Tabs: Recent Practice History vs Mistake Bank Review */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Past Practice & Exam History
                  </h2>
                  <p className="text-xs text-muted-foreground">Every practice session and CBT mock test you've completed</p>
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/50 text-xs">
                  <button
                    onClick={() => setHistoryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${historyFilter === 'all' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    All ({historySessions.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('practice')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${historyFilter === 'practice' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Practice Drills
                  </button>
                  <button
                    onClick={() => setHistoryFilter('mock')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${historyFilter === 'mock' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    CBT Mocks
                  </button>
                </div>
              </div>

              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Loading your practice records...</p>
                </div>
              ) : historySessions.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl p-8 bg-card/40">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <h4 className="text-base font-bold text-foreground">No practice sessions recorded yet</h4>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-6">
                    Start a subject practice drill or standard CBT mock to track your progress and uncover your areas for improvement.
                  </p>
                  <Button onClick={() => setActiveTab('practice')} className="rounded-xl">
                    <Target className="w-4 h-4 mr-2" /> Start First Practice Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {historySessions
                    .filter(session => {
                      if (historyFilter === 'practice') return !session.mode?.includes('mock') && session.total_questions < 40;
                      if (historyFilter === 'mock') return session.mode?.includes('mock') || session.total_questions >= 40;
                      return true;
                    })
                    .map((session, idx) => {
                      const totalQ = session.total_questions || 20;
                      const scoreVal = session.score || session.total_score || 0;
                      const pct = totalQ > 0 ? Math.round((scoreVal / totalQ) * 100) : 0;
                      const modeLabel = session.mode === 'full_mock' ? 'Full JAMB Mock (4 Subjects)'
                        : session.mode === 'past_questions' ? 'Past UTME Exam Paper'
                        : session.mode === 'ai_generated_mock' ? 'AI-Powered Adaptive Mock'
                        : session.mode === 'speed_test' ? 'Speed Test (20 Qs, 10 min)'
                        : session.mode === 'topic_drill' ? 'Topic Mastery Drill'
                        : session.mode === 'daily_quiz' ? 'Daily UTME Quiz'
                        : 'Subject Practice Drill';

                      const isMock = session.mode?.includes('mock') || totalQ >= 40;

                      return (
                        <div
                          key={session.id || idx}
                          className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMock ? 'bg-indigo-500/10 text-indigo-500' : 'bg-primary/10 text-primary'}`}>
                              {isMock ? <Timer className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-foreground">{modeLabel}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  pct >= 70 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                  pct >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                                  'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {pct}% Accuracy
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                                <span>{session.completed_at ? new Date(session.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(session.created_at || Date.now()).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{totalQ} Questions</span>
                                {session.time_spent_seconds && (
                                  <>
                                    <span>•</span>
                                    <span>{Math.floor(session.time_spent_seconds / 60)}m {session.time_spent_seconds % 60}s</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-lg font-display font-bold text-foreground">
                                {scoreVal}
                              </span>
                              <span className="text-xs text-muted-foreground">/{totalQ}</span>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 rounded-lg"
                              onClick={() => {
                                if (isMock) {
                                  navigate('/cbt/full-mock');
                                } else {
                                  navigate('/practice');
                                }
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Practice Again
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Questions Currently in Mistake Bank Review List */}
            {mistakes.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-rose-500" /> Inspect Missed Questions ({mistakes.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">Review your incorrect answers and step-by-step explanations</p>
                  </div>

                  {/* Filter by Subject */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={selectedMistakeSubject}
                      onChange={(e) => setSelectedMistakeSubject(e.target.value)}
                      className="text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">All Subjects ({mistakes.length})</option>
                      {Array.from(new Set(mistakes.map(m => m.subject_name || m.subjects?.name || 'General'))).map((s: any) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {mistakes
                    .filter(m => selectedMistakeSubject === 'all' || (m.subject_name || m.subjects?.name || 'General') === selectedMistakeSubject)
                    .map((m, idx) => {
                      const isExpanded = expandedMistakeId === (m.id || String(idx));
                      const subName = m.subject_name || m.subjects?.name || 'UTME Question';
                      const optionsObj = Array.isArray(m.options)
                        ? m.options
                        : typeof m.options === 'object' && m.options !== null
                        ? Object.entries(m.options).map(([k, v]) => ({ label: k, text: String(v) }))
                        : [];

                      return (
                        <div
                          key={m.id || idx}
                          className="rounded-xl border border-border bg-card p-4 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">
                                  {subName}
                                </span>
                                {m.year && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                                    {m.year}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium text-foreground line-clamp-2">
                                <MathText text={m.question_text || m.text || ''} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setExpandedMistakeId(isExpanded ? null : (m.id || String(idx)))}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-rose-500 hover:bg-rose-500/10"
                                title="Mark Mastered (Remove from Mistake Bank)"
                                onClick={() => {
                                  const updated = mistakes.filter((_, i) => i !== idx);
                                  localStorage.setItem('jamb_mistake_bank', JSON.stringify(updated));
                                  setMistakes(updated);
                                  toast.success("Question marked as mastered and removed from bank!");
                                }}
                              >
                                <CheckCircle className="w-4 h-4 text-emerald-500 mr-1" /> Mastered
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Solution & Options */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-border/50 space-y-3"
                              >
                                {/* Options list */}
                                <div className="space-y-1.5">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Options</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {optionsObj.map((opt: any, optIdx: number) => {
                                      const label = opt.label || String.fromCharCode(65 + optIdx);
                                      const text = typeof opt === 'string' ? opt : opt.text || '';
                                      const isCorrect = label === m.correct_answer || label === m.correct_option;

                                      return (
                                        <div
                                          key={label}
                                          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                                            isCorrect
                                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-medium'
                                              : 'bg-muted/30 border-border text-muted-foreground'
                                          }`}
                                        >
                                          <span className="font-bold shrink-0">{label}.</span>
                                          <div className="flex-1"><MathText text={text} /></div>
                                          {isCorrect && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Explanation */}
                                {m.explanation && (
                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground space-y-1">
                                    <span className="font-bold text-primary flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5" /> Official Solution & Explanation:
                                    </span>
                                    <div className="leading-relaxed text-muted-foreground">
                                      <MathText text={m.explanation} />
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

    </div>
  );
}
