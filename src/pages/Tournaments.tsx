import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Trophy, Users, Clock, Zap, Home, Award, Calendar, Timer, Star,
  Lock, BookOpen, Coins, ShieldCheck, Sparkles, ChevronRight, Info, CheckCircle2, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function Tournaments() {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);

  useEffect(() => {
    fetchTournaments();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTournaments = async () => {
    setLoading(true);
    
    // Check if feature is enabled
    try {
      const { data: settingsData } = await supabase.from('admin_settings').select('*').eq('setting_key', 'feature_toggles').maybeSingle();
      if (settingsData && settingsData.setting_value && settingsData.setting_value.tournaments_enabled === false) {
        setEnabled(false);
        setLoading(false);
        return;
      }
    } catch {}

    const listMap = new Map<string, any>();

    const parseAndClean = (rawT: any) => {
      if (!rawT) return null;
      let meta: Record<string, any> = {};
      const searchTarget = (rawT.rules || '') + '\n' + (rawT.description || '');
      const match = searchTarget.match(/__meta__:(\{[\s\S]*?\})(?:\n|$)/);
      if (match && match[1]) {
        try { meta = JSON.parse(match[1]); } catch {}
      }
      const cleanDesc = (rawT.description || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();
      const cleanRules = (rawT.rules || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();

      return {
        ...meta,
        ...rawT,
        description: cleanDesc || 'Compete in this UTME subject challenge and win rewards.',
        rules: cleanRules,
        participants_count: rawT.participants_count || rawT.participant_count || 0
      };
    };

    // 1. Try /api/tournaments
    try {
      const res = await fetch('/api/tournaments');
      const json = await res.json();
      if (json?.success && Array.isArray(json.tournaments)) {
        json.tournaments.forEach((t: any) => {
          const parsed = parseAndClean(t);
          if (parsed?.id) listMap.set(parsed.id, parsed);
        });
      }
    } catch {}

    // 2. Query real tournaments table in Supabase
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_time', { ascending: true });
        
      if (!error && data && Array.isArray(data)) {
        data.forEach(rawT => {
          const parsed = parseAndClean(rawT);
          if (parsed?.id) listMap.set(parsed.id, parsed);
        });
      }
    } catch {}

    // 3. Check admin_settings tournaments_db fallback
    try {
      const { data: currentSettings } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'tournaments_db')
        .maybeSingle();

      if (currentSettings?.setting_value && Array.isArray(currentSettings.setting_value)) {
        currentSettings.setting_value.forEach((t: any) => {
          const parsed = parseAndClean(t);
          if (parsed?.id && !listMap.has(parsed.id)) {
            listMap.set(parsed.id, parsed);
          }
        });
      }
    } catch {}

    const finalTournaments = Array.from(listMap.values()).sort((a, b) => {
      const timeA = new Date(a.start_time || 0).getTime();
      const timeB = new Date(b.start_time || 0).getTime();
      return timeA - timeB;
    });

    setTournaments(finalTournaments);
    setLoading(false);
  };

  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const joinTournament = async (id: string, status: string) => {
    if (!profile) return;
    
    if (status === 'locked') {
      toast.error("This tournament is locked by administrator.");
      return;
    }

    if (status === 'completed') {
      toast.error("This tournament has ended.");
    } else if (status === 'upcoming') {
      const { error } = await supabase.from('tournament_participants').insert({
        tournament_id: id,
        user_id: profile.id
      });
      if (error) {
        if (error.code === '23505') toast.info("You are already registered!");
        else toast.error("Failed to register.");
      } else {
        toast.success("Successfully registered! You will be notified when it starts.");
        fetchTournaments();
      }
    } else if (status === 'active') {
      navigate(`/tournaments/${id}`);
    }
  };

  const getCountdown = (startTime?: string | null) => {
    if (!startTime) return "Starting Soon";
    const target = new Date(startTime).getTime();
    if (isNaN(target)) return "Starting Soon";
    const diff = target - now;
    if (diff <= 0) return "Starting...";
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (!enabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <Zap className="w-16 h-16 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-bold font-display mb-4 text-foreground">Tournaments are currently offline.</h1>
        <p className="text-muted-foreground max-w-md mb-8">We are updating the tournament system to bring you better live events. Please check back later!</p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const liveUpcoming = tournaments.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const pastEvents = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6 md:p-10 relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 dark:bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto space-y-8 md:space-y-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-display flex items-center gap-3 md:gap-4 bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-orange-500 to-red-500">
              <Trophy className="w-9 h-9 md:w-12 md:h-12 text-amber-500 drop-shadow-md" />
              Arena & Tournaments
            </h1>
            <p className="text-muted-foreground mt-2 text-base md:text-lg">Compete against other scholars, climb the ranks, and win real prizes.</p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2 border-border hover:bg-muted text-foreground font-medium">
              <Home className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
              <Zap className="w-6 h-6 text-orange-500 animate-pulse" /> Live & Upcoming Challenges
            </h2>
            
            {loading ? (
              <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : liveUpcoming.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl shadow-sm">
                 <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-foreground">No active tournaments</h3>
                 <p className="text-muted-foreground mt-2 text-sm">Stay tuned. The next challenge is being prepared.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {liveUpcoming.map(tournament => {
                   const isLive = tournament.status === 'active';
                   const isLocked = tournament.status === 'locked';

                   const subjectLabel = tournament.subject_filter && tournament.subject_filter.trim() !== '' && tournament.subject_filter.toLowerCase() !== 'all'
                     ? tournament.subject_filter
                     : 'All 4 UTME Subjects';

                   const questionCount = tournament.question_count || 40;
                   const durationMins = tournament.duration_minutes || 30;
                   const prize = tournament.prize_description || tournament.cash_prize || tournament.prize_pool || 'Scholar Prestige & Badges';
                   const sponsor = tournament.sponsor || null;

                   return (
                     <Card key={tournament.id} className={`group relative overflow-hidden transition-all duration-300 border ${
                       isLive ? 'bg-card border-orange-500 shadow-md ring-1 ring-orange-500/20' :
                       isLocked ? 'bg-card border-border opacity-85' : 'bg-card border-border hover:border-primary/50 shadow-sm'
                     } rounded-2xl`}>
                        {/* Hover Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-500 pointer-events-none" />
                        
                        {isLive && (
                          <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-red-600 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider rounded-bl-xl flex items-center gap-2 shadow-lg z-10">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span> LIVE NOW
                          </div>
                        )}

                        {isLocked && (
                          <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider rounded-bl-xl flex items-center gap-1.5 shadow-lg z-10">
                            <Lock className="w-3 h-3" /> LOCKED
                          </div>
                        )}
                        
                        <CardHeader className="relative z-10 pb-3">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                              <BookOpen className="w-3 h-3" /> {subjectLabel}
                            </span>
                            {sponsor && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <Sparkles className="w-3 h-3" /> Sponsored by {sponsor}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-xl sm:text-2xl text-foreground font-display font-bold leading-tight pr-16">{tournament.title}</CardTitle>
                          
                          {/* Rich Formatted Description */}
                          <div className="mt-3 text-muted-foreground text-sm leading-relaxed whitespace-pre-line bg-muted/30 p-3.5 rounded-xl border border-border/60">
                            {tournament.description || 'Compete in this official UTME challenge to benchmark your speed, test mastery, and climb the national leaderboard.'}
                          </div>
                        </CardHeader>
                        
                        <CardContent className="relative z-10 pt-1">
                          {/* Specification Badges */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
                            <div className="flex flex-col p-2.5 rounded-xl bg-muted/60 border border-border">
                              <span className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-blue-500" /> Format
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                                {questionCount} Qs • {durationMins}m
                              </span>
                            </div>

                            <div className="flex flex-col p-2.5 rounded-xl bg-muted/60 border border-border">
                              <span className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                                <Timer className="w-3.5 h-3.5 text-amber-500" /> Schedule
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                                {isLive ? 'Live Now' : isLocked ? 'Entry Closed' : getCountdown(tournament.start_time)}
                              </span>
                            </div>

                            <div className="flex flex-col p-2.5 rounded-xl bg-muted/60 border border-border">
                              <span className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-purple-500" /> Scholars
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                                {tournament.participants_count} / {tournament.max_participants || '500'}
                              </span>
                            </div>

                            <div className="flex flex-col p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                              <span className="text-[11px] uppercase font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Award className="w-3.5 h-3.5 text-amber-500" /> Grand Prize
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 mt-0.5 truncate" title={prize}>
                                {prize}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Button 
                              disabled={isLocked}
                              onClick={() => joinTournament(tournament.id, tournament.status)}
                              className={`w-full sm:flex-1 font-bold h-12 text-sm tracking-wide rounded-xl transition-all duration-300 ${
                                isLocked ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed' :
                                isLive ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 border-0' :
                                'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border-0'
                              }`}
                            >
                              {isLocked ? 'TOURNAMENT LOCKED' : isLive ? 'ENTER ARENA NOW' : 'REGISTER FOR CHALLENGE'}
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => setSelectedTournament(tournament)}
                              className="w-full sm:w-auto h-12 px-4 border-border text-foreground hover:bg-muted text-xs font-semibold gap-1.5"
                            >
                              <Info className="w-4 h-4 text-primary" /> Full Rules & Details
                            </Button>
                          </div>
                        </CardContent>
                     </Card>
                   );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
              <Calendar className="w-6 h-6 text-muted-foreground" /> Past Events
            </h2>
            <div className="space-y-4">
              {pastEvents.length === 0 ? (
                 <div className="text-center py-8 bg-card border border-border rounded-xl">
                    <p className="text-muted-foreground text-sm">No past tournaments recorded.</p>
                 </div>
              ) : pastEvents.map(tournament => (
                <Card key={tournament.id} className="bg-card border-border hover:border-primary/40 transition-all rounded-xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-foreground font-semibold">{tournament.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <span>{new Date(tournament.start_time).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {tournament.participants_count} Players</span>
                    </div>
                    <Button variant="outline" className="w-full text-xs h-8 border-border hover:bg-muted text-foreground" onClick={() => joinTournament(tournament.id, tournament.status)}>
                      View Leaderboard
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="bg-blue-500/5 dark:bg-blue-900/20 border-blue-500/20 rounded-2xl shadow-sm mt-8">
              <CardHeader>
                <CardTitle className="text-blue-600 dark:text-blue-400 text-base font-bold flex items-center gap-2">
                   <Zap className="w-5 h-5"/> Arena Pro Tip
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed pt-0">
                Ensure a stable internet connection before entering a Live Tournament. The server clock syncs your session — disconnecting won't pause the timer!
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Full Tournament Details & Rules Modal */}
      {selectedTournament && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedTournament(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Tournament Specifications
            </div>

            <h2 className="text-2xl font-bold font-display text-foreground pr-8">
              {selectedTournament.title}
            </h2>

            {selectedTournament.sponsor && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                Official Event Sponsored by {selectedTournament.sponsor}
              </p>
            )}

            <div className="mt-4 space-y-4 text-sm text-foreground">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Tournament Overview</h4>
                <div className="bg-muted/40 p-3 rounded-xl border border-border/60 text-muted-foreground leading-relaxed whitespace-pre-line text-sm">
                  {selectedTournament.description || 'Compete with scholars across Nigeria in this timed examination duel.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <span className="text-muted-foreground block">Subject Scope</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.subject_filter || 'All UTME Subjects'}
                  </span>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <span className="text-muted-foreground block">Duration & Volume</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.question_count || 40} Questions in {selectedTournament.duration_minutes || 30} Mins
                  </span>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <span className="text-muted-foreground block">Entry Fee</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.entry_fee ? `₦${selectedTournament.entry_fee}` : '100% Free Entry'}
                  </span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <span className="text-amber-700 dark:text-amber-400 block font-semibold">Prize Reward</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">
                    {selectedTournament.prize_description || selectedTournament.cash_prize || 'Prestige & Badges'}
                  </span>
                </div>
              </div>

              {selectedTournament.scholarship_description && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <h5 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs uppercase">Scholarship Grant</h5>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                    {selectedTournament.scholarship_description}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Rules & Anti-Cheating Protocol</h4>
                <div className="bg-muted/40 p-3 rounded-xl border border-border/60 text-muted-foreground text-xs leading-relaxed space-y-1.5">
                  <p className="flex items-center gap-1.5 text-foreground font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> Single session submission per scholar.
                  </p>
                  <p className="flex items-center gap-1.5 text-foreground font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> Real-time synchronized server timer.
                  </p>
                  <p className="flex items-center gap-1.5 text-foreground font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> Speed + Accuracy tie-breaking algorithm.
                  </p>
                  {selectedTournament.rules && (
                    <p className="mt-2 pt-2 border-t border-border/50 text-foreground whitespace-pre-line">
                      {selectedTournament.rules}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => {
                  const t = selectedTournament;
                  setSelectedTournament(null);
                  joinTournament(t.id, t.status);
                }}
                disabled={selectedTournament.status === 'locked'}
                className="w-full font-bold h-11 bg-primary text-primary-foreground"
              >
                {selectedTournament.status === 'locked' ? 'Tournament Closed' : selectedTournament.status === 'active' ? 'Enter Arena Now' : 'Register for Tournament'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
