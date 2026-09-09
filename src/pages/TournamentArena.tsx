import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Clock, Zap, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { checkIsCorrect } from '@/utils/questionUtils';

export default function TournamentArena() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [tournament, setTournament] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Record<string, {name: string, score: number}>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour for tournament
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!profile || !id) return;
    
    const initArena = async () => {
      let tData: any = null;

      // 1. Fetch tournament details from Supabase
      try {
        const { data: rawData } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
        if (rawData) {
          tData = rawData;
        }
      } catch {}

      // 2. Fallback to API / admin_settings if needed
      if (!tData) {
        try {
          const res = await fetch('/api/tournaments');
          const json = await res.json();
          if (json?.tournaments && Array.isArray(json.tournaments)) {
            tData = json.tournaments.find((t: any) => String(t.id) === String(id));
          }
        } catch {}
      }

      if (!tData) {
        try {
          const { data: currentSettings } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'tournaments_db')
            .maybeSingle();

          if (currentSettings?.setting_value && Array.isArray(currentSettings.setting_value)) {
            tData = currentSettings.setting_value.find((t: any) => String(t.id) === String(id));
          }
        } catch {}
      }

      if (!tData) {
        toast.error("Tournament not found");
        navigate('/tournaments');
        return;
      }

      let meta: Record<string, any> = {};
      const searchTarget = (tData.rules || '') + '\n' + (tData.description || '');
      const match = searchTarget.match(/__meta__:(\{[\s\S]*?\})(?:\n|$)/);
      if (match && match[1]) {
        try { meta = JSON.parse(match[1]); } catch {}
      }
      const cleanDesc = (tData.description || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();
      const cleanRules = (tData.rules || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();

      const finalTournament = {
        ...meta,
        ...tData,
        description: cleanDesc,
        rules: cleanRules
      };
      setTournament(finalTournament);

      // 2. Fetch questions based on tournament configuration (subject_filter & count)
      const count = Number(finalTournament.question_count) || 20;
      let qData: any[] | null = null;

      // Filter by tournament subject if specified
      if (tData.subject_filter && tData.subject_filter.trim() !== '' && tData.subject_filter.toLowerCase() !== 'all') {
        const rawSub = tData.subject_filter.trim();
        const subjects = rawSub.split(',').map((s: string) => s.trim()).filter(Boolean);
        
        let query = supabase.from('questions').select('*').eq('is_active', true);
        if (subjects.length === 1) {
          query = query.ilike('subject', `%${subjects[0]}%`);
        } else if (subjects.length > 1) {
          const filterStr = subjects.map((s: string) => `subject.ilike.%${s}%`).join(',');
          query = query.or(filterStr);
        }
        const res = await query.limit(count);
        if (res.data && res.data.length > 0) {
          qData = res.data;
        }
      }

      // Fallback if no subject filter or no questions returned for that subject
      if (!qData || qData.length === 0) {
        const fallbackRes = await supabase
          .from('questions')
          .select('*')
          .eq('is_active', true)
          .limit(count);
        qData = fallbackRes.data;
      }

      if (qData && qData.length > 0) {
        setQuestions(qData.map(q => {
          let opts: string[] = [];
          if (q.options) {
            if (typeof q.options === 'string') {
              try {
                const parsed = JSON.parse(q.options);
                opts = Array.isArray(parsed) ? parsed : Object.values(parsed);
              } catch {
                opts = [];
              }
            } else if (Array.isArray(q.options)) {
              opts = q.options;
            } else if (typeof q.options === 'object') {
              opts = Object.values(q.options);
            }
          }
          if (opts.length === 0) {
            opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
          }
          return {
            ...q,
            options: opts.map((opt: any) => typeof opt === 'object' && opt !== null ? (opt.text || opt.value || opt.id || '') : String(opt || ''))
          };
        }));
      } else {
        toast.error("No questions currently assigned to this tournament.");
      }
      setLoading(false);
    };

    initArena();
  }, [id, profile, navigate]);

  // Realtime subscription for live leaderboard
  useEffect(() => {
    if (!profile || !id || loading) return;

    const channel = supabase.channel(`tournament_${id}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newLeaderboard: Record<string, any> = {};
        for (const [key, presences] of Object.entries(state)) {
          const p = presences[0] as any;
          newLeaderboard[key] = { name: p.name, score: p.score || 0 };
        }
        setLeaderboard(newLeaderboard);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        toast.info(`${newPresences[0].name} joined the arena!`);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: profile.full_name, score: 0 });
        }
      });

    // Update presence when score changes
    const updateScore = async () => {
      await channel.track({ name: profile.full_name, score });
    };
    updateScore();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, id, loading, score]);

  // Timer
  useEffect(() => {
    if (loading || finished) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, finished]);

  const handleAnswer = async (selected: string) => {
    const q = questions[currentIdx];
    const isCorrect = checkIsCorrect(selected, q);
    
    let newScore = score;
    if (isCorrect) {
      newScore = score + 10;
      setScore(newScore);
      toast.success("Correct! +10 Points");
    } else {
      toast.error("Incorrect!");
    }

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(c => c + 1);
    } else {
      setFinished(true);
      await finishTournament(newScore);
    }
  };

  const finishTournament = async (finalScore: number) => {
    if (!profile || !id) return;
    try {
      // 1. Submit to API backend (updates admin_settings, awards XP, resilient to non-UUIDs)
      await fetch('/api/tournaments/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: id,
          score: finalScore,
          time_taken_seconds: 3600 - timeLeft,
          user_id: profile.id
        })
      }).catch(() => {});

      // 2. Also try direct table update if valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        try {
          await supabase
            .from('tournament_participants')
            .update({ score: finalScore, completed_at: new Date().toISOString() })
            .eq('tournament_id', id)
            .eq('user_id', profile.id);
        } catch {}
      }

      toast.success(`Tournament complete! You earned ${finalScore * 10} XP`);
    } catch (err) {
      console.warn("Tournament score save note:", err);
      toast.success(`Tournament complete! Final score: ${finalScore}`);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (finished) {
    // Sort leaderboard
    const ranked = Object.values(leaderboard).sort((a, b) => b.score - a.score);
    
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
        <h1 className="text-4xl font-display font-bold mb-2">Tournament Complete!</h1>
        <p className="text-xl text-muted-foreground mb-8">Your Final Score: {score}</p>
        
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 mb-8 text-left">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Final Live Rankings</h2>
          <div className="space-y-3">
            {ranked.map((p, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-semibold flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    i === 0 ? 'bg-amber-500/20 text-amber-500' :
                    i === 1 ? 'bg-slate-300/20 text-slate-400' :
                    i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    #{i + 1}
                  </span>
                  {p.name}
                </span>
                <span className="text-primary font-mono font-bold">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  const q = questions[currentIdx];
  const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card/50 flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="font-bold hidden md:block">{tournament?.title || "Live Tournament"}</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-primary font-mono bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <Clock className="w-4 h-4" /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}
          </div>
          <div className="font-bold">Score: <span className="text-primary">{score}</span></div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Arena */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 flex items-center justify-center">
          <div className="w-full max-w-3xl">
            <div className="mb-6 flex justify-between text-sm font-semibold text-muted-foreground">
              <span>Question {currentIdx + 1} of {questions.length}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display leading-relaxed mb-10">{q.question_text}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {q.options.map((opt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  className="p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left text-lg font-medium group"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors font-bold shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Live Sidebar */}
        <aside className="w-full lg:w-80 border-l border-border bg-card/30 p-6 flex flex-col">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-yellow-500" /> Live Arena Leaderboard
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {sortedLeaderboard.map((p, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${p.name === profile?.full_name ? 'bg-primary/10 border-primary/30' : 'bg-muted/50 border-border'}`}>
                <div className="flex items-center gap-3 truncate">
                  <span className="font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="font-medium truncate">{p.name === profile?.full_name ? 'You' : p.name}</span>
                </div>
                <span className="font-mono text-primary font-bold">{p.score}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
