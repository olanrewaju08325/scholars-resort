import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy, Users, Clock, Zap, Home, Award, Calendar, Timer, Star, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function Tournaments() {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchTournaments();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTournaments = async () => {
    setLoading(true);
    
    // Check if feature is enabled
    const { data: settingsData } = await supabase.from('admin_settings').select('*').eq('setting_key', 'feature_toggles').maybeSingle();
    if (settingsData && settingsData.setting_value && settingsData.setting_value.tournaments_enabled === false) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    // Query real tournaments
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        tournament_participants (count)
      `)
      .order('start_time', { ascending: true });
      
    if (!error && data) {
      const formatted = data.map(t => ({
        ...t,
        participants_count: t.tournament_participants?.[0]?.count || 0
      }));
      setTournaments(formatted);
    }
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

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
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
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-center">
        <Zap className="w-16 h-16 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-bold font-display mb-4 text-white">Tournaments are currently offline.</h1>
        <p className="text-slate-400 max-w-md mb-8">We are updating the tournament system to bring you better live events. Please check back later!</p>
        <Button asChild className="bg-white text-black hover:bg-slate-200">
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const liveUpcoming = tournaments.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const pastEvents = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col p-6 md:p-10 relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto space-y-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-display flex items-center gap-4 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
              <Trophy className="w-10 h-10 md:w-12 md:h-12 text-yellow-500 drop-shadow-md" />
              Arena & Tournaments
            </h1>
            <p className="text-slate-400 mt-2 text-lg">Compete against other scholars, climb the ranks, and win real prizes.</p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-300">
              <Home className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
              <Zap className="w-6 h-6 text-orange-500 animate-pulse" /> Live & Upcoming Challenges
            </h2>
            
            {loading ? (
              <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : liveUpcoming.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-3xl">
                 <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-foreground">No active tournaments</h3>
                 <p className="text-muted-foreground mt-2">Stay tuned. The next challenge is being prepared.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {liveUpcoming.map(tournament => {
                   const isLive = tournament.status === 'active';
                   const isLocked = tournament.status === 'locked';

                   return (
                     <Card key={tournament.id} className={`group relative overflow-hidden transition-all duration-300 border ${
                       isLive ? 'bg-card border-orange-500 shadow-md' :
                       isLocked ? 'bg-card border-border opacity-75' : 'bg-card border-border hover:border-primary/50'
                     } rounded-2xl`}>
                        {/* Hover Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
                        
                        {isLive && (
                          <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-red-600 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider rounded-bl-xl flex items-center gap-2 shadow-lg z-10">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span> LIVE NOW
                          </div>
                        )}

                        {isLocked && (
                          <div className="absolute top-0 right-0 bg-red-500/80 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider rounded-bl-xl flex items-center gap-1.5 shadow-lg z-10">
                            <Lock className="w-3 h-3" /> LOCKED
                          </div>
                        )}
                        
                        <CardHeader className="relative z-10 pb-2">
                          <CardTitle className="text-2xl text-white pr-24 font-display leading-tight">{tournament.title}</CardTitle>
                          <CardDescription className="text-slate-400 mt-2 text-sm leading-relaxed">{tournament.description || 'General UTME test duel.'}</CardDescription>
                        </CardHeader>
                        
                        <CardContent className="relative z-10">
                          <div className="flex flex-wrap gap-3 mt-4 mb-8">
                            <div className="flex items-center gap-2 text-sm font-medium bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-lg">
                              <Timer className="w-4 h-4 text-blue-400" />
                              {isLive ? 'In Progress' : isLocked ? 'Entry Closed' : getCountdown(tournament.start_time)}
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-lg">
                              <Users className="w-4 h-4 text-purple-400" />
                              {tournament.participants_count} / {tournament.max_participants || '500'} Players
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-2 rounded-lg">
                              <Star className="w-4 h-4 text-yellow-500" />
                              {tournament.prize_description || 'Prestige & XP'}
                            </div>
                          </div>
                          
                          <Button 
                            disabled={isLocked}
                            onClick={() => joinTournament(tournament.id, tournament.status)}
                            className={`w-full font-bold h-12 text-sm tracking-wide rounded-xl transition-all duration-300 ${
                              isLocked ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' :
                              isLive ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 border-0' :
                              'bg-blue-600 hover:bg-blue-700 text-white border-0'
                            }`}
                          >
                            {isLocked ? 'TOURNAMENT LOCKED' : isLive ? 'ENTER ARENA NOW' : 'REGISTER FOR CHALLENGE'}
                          </Button>
                        </CardContent>
                     </Card>
                   );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-300">
              <Calendar className="w-6 h-6" /> Past Events
            </h2>
            <div className="space-y-4">
              {pastEvents.length === 0 ? (
                 <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-2xl">
                    <p className="text-slate-500 text-sm">No past tournaments recorded.</p>
                 </div>
              ) : pastEvents.map(tournament => (
                <Card key={tournament.id} className="bg-slate-900/40 border-slate-800 opacity-80 hover:opacity-100 transition-all rounded-xl backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-200">{tournament.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                      <span>{new Date(tournament.start_time).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {tournament.participants_count} Players</span>
                    </div>
                    <Button variant="outline" className="w-full text-xs h-8 border-slate-700 hover:bg-slate-800 text-slate-300" onClick={() => joinTournament(tournament.id, tournament.status)}>
                      View Leaderboard
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="bg-blue-900/20 border-blue-500/20 rounded-2xl backdrop-blur-sm mt-8">
              <CardHeader>
                <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
                   <Zap className="w-5 h-5"/> Arena Pro Tip
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Ensure a stable internet connection before entering a Live Tournament. The server clock syncs your session — disconnecting won't pause the timer!
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
