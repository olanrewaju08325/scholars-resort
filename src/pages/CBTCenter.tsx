import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Timer, BrainCircuit, Calendar, Swords, BookOpen, 
  History, Trophy, Target, Zap, RotateCcw 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function CBTCenter() {
  const [activeTab, setActiveTab] = useState<'practice' | 'mocks' | 'tournaments'>('practice');
  const [activeSession, setActiveSession] = useState<any>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();


  useEffect(() => {
    const fetchActiveSession = async () => {
      if (!profile) return;
      const { data } = await supabase
        .from('exam_sessions')
        .select('id, mode')
        .eq('user_id', profile.id)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (data) setActiveSession(data);
    };
    fetchActiveSession();
  }, [profile]);


  const practiceModes = [
    { title: 'Subject Practice', desc: 'Focus on a single subject (e.g. Physics)', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/practice?mode=subject' },
    { title: 'Topic Drill', desc: 'Master specific topics (e.g. Kinematics)', icon: Target, color: 'text-green-500', bg: 'bg-green-500/10', path: '/practice?mode=topic' },
    { title: 'Speed Test', desc: '20 questions in 10 minutes. Test your reflexes.', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10', path: '/practice?mode=speed' },
    { title: 'Daily Quiz', desc: 'Your personalized 15-minute daily challenge.', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10', path: '/practice?mode=daily' },
  ];

  const mockModes = [
    { title: 'Full JAMB Mock', desc: 'Standard 4-subject, 400 score, 2-hour exam.', icon: Timer, color: 'text-red-500', bg: 'bg-red-500/10', badge: 'Standard', path: '/exam?mode=full' },
    { title: 'Past Questions', desc: 'Practice with real exams from previous years.', icon: History, color: 'text-orange-500', bg: 'bg-orange-500/10', path: '/exam?mode=past' },
    { title: 'AI Generated Mock', desc: 'Dynamically generated based on your weak points.', icon: BrainCircuit, color: 'text-indigo-500', bg: 'bg-indigo-500/10', badge: 'AI Powered', path: '/exam?mode=ai' },
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
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8 bg-slate-950/50 min-h-screen pb-20">
      
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
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        className="mt-6"
      >
        {activeTab === 'practice' && (
          <div className="space-y-6">
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
      </motion.div>

    </div>
  );
}
