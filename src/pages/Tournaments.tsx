import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Trophy, Users, Clock, Zap, Home, Award, Calendar, Timer, Star,
  Lock, BookOpen, Coins, ShieldCheck, Sparkles, ChevronRight, Info, CheckCircle2, X,
  AlertCircle, ArrowRight, ShieldAlert, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { WeeklyChallenge } from '@/components/dashboard/WeeklyChallenge';

export default function Tournaments() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [registeredTournamentIds, setRegisteredTournamentIds] = useState<string[]>([]);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('tournaments');

  const fetchMyRegistrations = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const res = await fetch(`/api/tournaments/my-registrations?userId=${encodeURIComponent(profile.id)}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.registeredTournamentIds)) {
        setRegisteredTournamentIds(json.registeredTournamentIds);
      }
    } catch (err) {
      console.warn('Could not fetch registered tournaments:', err);
    }
  }, [profile?.id]);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    
    // Check if feature is enabled
    try {
      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('setting_key', 'feature_toggles')
        .maybeSingle();

      if (settingsData?.setting_value?.tournaments_enabled === false) {
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
        description: cleanDesc || 'Compete in this UTME subject challenge, test speed, and win real rewards.',
        rules: cleanRules,
        participants_count: rawT.participants_count || rawT.participant_count || 0
      };
    };

    // 1. Fetch from server API
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

    // 2. Query Supabase tournaments table
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_time', { ascending: true });
        
      if (!error && data && Array.isArray(data)) {
        data.forEach(rawT => {
          const parsed = parseAndClean(rawT);
          if (parsed?.id && !listMap.has(parsed.id)) {
            listMap.set(parsed.id, parsed);
          }
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
  }, []);

  useEffect(() => {
    fetchTournaments();
    fetchMyRegistrations();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [fetchTournaments, fetchMyRegistrations]);

  const joinTournament = async (tournament: any) => {
    if (!profile) {
      toast.error("Please login to register for challenges.");
      return;
    }
    
    if (tournament.status === 'locked') {
      toast.error("This tournament is locked by administrator.");
      return;
    }

    if (tournament.status === 'completed') {
      toast.error("This tournament has ended.");
      return;
    }

    if (tournament.status === 'active') {
      navigate(`/tournaments/${tournament.id}`);
      return;
    }

    const isAlreadyRegistered = registeredTournamentIds.includes(tournament.id) || 
      (tournament.legacy_id && registeredTournamentIds.includes(tournament.legacy_id));
      
    if (isAlreadyRegistered) {
      toast.info("You are already registered! Arena opens when countdown ends.");
      return;
    }

    setRegisteringId(tournament.id);
    try {
      const res = await fetch('/api/tournaments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournament.id,
          legacy_id: tournament.legacy_id,
          user_id: profile.id,
          user_name: profile.full_name || profile.name || 'Scholar',
          user_email: profile.email || ''
        })
      });

      const json = await res.json();
      if (json?.success) {
        toast.success(json.message || "Successfully registered for tournament!");
        setRegisteredTournamentIds(prev => [...prev, tournament.id, tournament.legacy_id].filter(Boolean));
        fetchTournaments();
      } else {
        toast.error(json?.error || "Registration failed. Please try again.");
      }
    } catch (err: any) {
      toast.error("Network connection error. Please try again.");
    } finally {
      setRegisteringId(null);
    }
  };

  const getCountdown = (startTime?: string | null) => {
    if (!startTime) return "Starting Soon";
    const target = new Date(startTime).getTime();
    if (isNaN(target)) return "Starting Soon";
    const diff = target - now;
    if (diff <= 0) return "Starting Now";
    
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Zap className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-3xl font-bold font-display mb-3 text-foreground">Tournaments are currently in maintenance.</h1>
        <p className="text-muted-foreground max-w-md mb-6">We are upgrading the live tournament engine. Please check back shortly!</p>
        <Button asChild className="bg-primary text-primary-foreground font-semibold">
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const liveUpcoming = tournaments.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const pastEvents = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl w-full mx-auto space-y-6 md:space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                  National Arena & Challenges
                </h1>
                <p className="text-muted-foreground text-sm">
                  Compete nationwide, test your speed under pressure, and win scholarships & cash prizes.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/cbt">
              <Button variant="outline" size="sm" className="gap-2 text-foreground font-medium">
                <Clock className="w-4 h-4" /> CBT Practice
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="default" size="sm" className="gap-2 font-medium">
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Challenge Hub Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted p-1 border border-border rounded-xl">
            <TabsTrigger value="tournaments" className="gap-2 font-semibold text-xs sm:text-sm">
              <Trophy className="w-4 h-4 text-amber-500" /> Live Tournaments
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-2 font-semibold text-xs sm:text-sm">
              <Zap className="w-4 h-4 text-orange-500" /> Weekly Speed Challenge
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2 font-semibold text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Rules & Fair Play
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TOURNAMENTS */}
          <TabsContent value="tournaments" className="mt-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Live & Upcoming Challenges */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold font-display flex items-center gap-2 text-foreground">
                    <Zap className="w-5 h-5 text-amber-500" /> Available Competitions
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                    {liveUpcoming.length} Active
                  </span>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center p-16 bg-card border border-border rounded-2xl">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading arena competitions...</p>
                  </div>
                ) : liveUpcoming.length === 0 ? (
                  <Card className="bg-card border-border rounded-2xl p-12 text-center shadow-sm">
                    <Trophy className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-foreground">No open tournaments right now</h3>
                    <p className="text-muted-foreground mt-1 text-sm max-w-sm mx-auto">
                      Administrators are setting up the next national duel. Check back soon or try the Weekly Challenge!
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {liveUpcoming.map(tournament => {
                      const isLive = tournament.status === 'active';
                      const isLocked = tournament.status === 'locked';
                      const isRegistered = registeredTournamentIds.includes(tournament.id) || 
                        (tournament.legacy_id && registeredTournamentIds.includes(tournament.legacy_id));
                      const isRegistering = registeringId === tournament.id;

                      const subjectLabel = tournament.subject_filter && tournament.subject_filter.trim() !== '' && tournament.subject_filter.toLowerCase() !== 'all'
                        ? tournament.subject_filter
                        : 'All 4 UTME Subjects';

                      const questionCount = tournament.question_count || 40;
                      const durationMins = tournament.duration_minutes || 30;
                      const prize = tournament.prize_description || tournament.cash_prize || tournament.prize_pool || 'Scholar Prestige & Badges';
                      const sponsor = tournament.sponsor || null;

                      return (
                        <Card 
                          key={tournament.id} 
                          className={`bg-card text-card-foreground border transition-all duration-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md ${
                            isLive 
                              ? 'border-orange-500 ring-1 ring-orange-500/30' 
                              : isRegistered 
                              ? 'border-emerald-500/40' 
                              : 'border-border'
                          }`}
                        >
                          {/* Top Status Banner */}
                          <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-semibold border-b ${
                            isLive 
                              ? 'bg-orange-500 text-white border-orange-600' 
                              : isRegistered
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                              : 'bg-muted/60 text-muted-foreground border-border'
                          }`}>
                            <div className="flex items-center gap-2">
                              {isLive ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                  <span className="font-bold tracking-wider uppercase">Live Arena Open Now</span>
                                </>
                              ) : isRegistered ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="font-bold">You are officially registered for this challenge</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-4 h-4" />
                                  <span>Registration Open • Starts in {getCountdown(tournament.start_time)}</span>
                                </>
                              )}
                            </div>

                            {isLocked && (
                              <span className="flex items-center gap-1 text-red-600 font-bold uppercase tracking-wider">
                                <Lock className="w-3.5 h-3.5" /> Locked
                              </span>
                            )}
                          </div>

                          <CardHeader className="p-5 sm:p-6 pb-3">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                <BookOpen className="w-3.5 h-3.5" /> {subjectLabel}
                              </span>
                              {sponsor && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                  <Sparkles className="w-3.5 h-3.5" /> Sponsored by {sponsor}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
                                {tournament.entry_fee ? `Fee: ₦${tournament.entry_fee}` : 'Free Entry'}
                              </span>
                            </div>

                            <CardTitle className="text-xl sm:text-2xl font-bold font-display text-foreground leading-snug">
                              {tournament.title}
                            </CardTitle>

                            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                              {tournament.description || 'Compete with scholars across Nigeria to benchmark your preparation under timed examination conditions.'}
                            </p>
                          </CardHeader>

                          <CardContent className="p-5 sm:p-6 pt-0 space-y-5">
                            {/* Specifications Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-muted/50 border border-border rounded-xl p-3">
                                <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-blue-500" /> Format
                                </span>
                                <span className="text-sm font-bold text-foreground mt-1 block">
                                  {questionCount} Qs • {durationMins}m
                                </span>
                              </div>

                              <div className="bg-muted/50 border border-border rounded-xl p-3">
                                <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                                  <Timer className="w-3.5 h-3.5 text-amber-500" /> Schedule
                                </span>
                                <span className="text-sm font-bold text-foreground mt-1 block">
                                  {isLive ? 'Live Battle' : getCountdown(tournament.start_time)}
                                </span>
                              </div>

                              <div className="bg-muted/50 border border-border rounded-xl p-3">
                                <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-purple-500" /> Scholars
                                </span>
                                <span className="text-sm font-bold text-foreground mt-1 block">
                                  {tournament.participants_count || 0} Registered
                                </span>
                              </div>

                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                                <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-amber-500" /> Prize Pool
                                </span>
                                <span className="text-sm font-bold text-amber-800 dark:text-amber-300 mt-1 block truncate" title={prize}>
                                  {prize}
                                </span>
                              </div>
                            </div>

                            {/* Registered Status Strip */}
                            {isRegistered && !isLive && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                                <div className="text-xs">
                                  <p className="font-bold text-emerald-900 dark:text-emerald-200">Seat Confirmed!</p>
                                  <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    Arena opens at scheduled time. Please review the rules below and ensure you are logged in when it starts.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                              {isLive ? (
                                <Button 
                                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                                  className="w-full sm:flex-1 h-12 text-sm font-bold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md shadow-orange-500/20"
                                >
                                  <Zap className="w-4 h-4 mr-2" /> ENTER LIVE ARENA NOW
                                </Button>
                              ) : isRegistered ? (
                                <div className="w-full sm:flex-1 flex gap-2">
                                  <Button 
                                    disabled
                                    variant="outline"
                                    className="w-full h-12 text-sm font-bold border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> REGISTERED (READY)
                                  </Button>
                                </div>
                              ) : (
                                <Button 
                                  disabled={isLocked || isRegistering}
                                  onClick={() => joinTournament(tournament)}
                                  className="w-full sm:flex-1 h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                >
                                  {isRegistering ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                      Registering Your Seat...
                                    </>
                                  ) : isLocked ? (
                                    'REGISTRATION CLOSED'
                                  ) : (
                                    'REGISTER FOR CHALLENGE'
                                  )}
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                onClick={() => setSelectedTournament(tournament)}
                                className="w-full sm:w-auto h-12 px-4 border-border text-foreground hover:bg-muted text-xs font-semibold gap-1.5"
                              >
                                <Info className="w-4 h-4 text-primary" /> Rules & Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Past Events & Pro Tips */}
              <div className="space-y-6">
                <Card className="bg-card border-border rounded-2xl shadow-sm">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <Calendar className="w-4 h-4 text-muted-foreground" /> Previous Tournaments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    {pastEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No previous tournament records yet.
                      </p>
                    ) : (
                      pastEvents.map(pt => (
                        <div key={pt.id} className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{pt.title}</p>
                            <p className="text-muted-foreground mt-0.5">{new Date(pt.start_time).toLocaleDateString()}</p>
                          </div>
                          <span className="font-bold text-muted-foreground">{pt.participants_count || 0} scholars</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 rounded-2xl shadow-sm">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Official Examination Protocols
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 text-xs text-muted-foreground space-y-2 leading-relaxed">
                    <p>• <strong>Strict Single Attempt:</strong> Each registered scholar can only submit once per challenge.</p>
                    <p>• <strong>Speed-Tiebreaker:</strong> Rankings are calculated by highest score first, then fastest completion time.</p>
                    <p>• <strong>Synchronized Clock:</strong> The timer runs authoritatively on the server. Do not navigate away or refresh.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: WEEKLY SPEED CHALLENGE */}
          <TabsContent value="weekly" className="mt-6 space-y-6">
            <WeeklyChallenge />
          </TabsContent>

          {/* TAB 3: RULES & FAIR PLAY */}
          <TabsContent value="rules" className="mt-6">
            <Card className="bg-card text-card-foreground border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
              <div>
                <h3 className="text-xl font-bold font-display text-foreground">National Competition Code of Conduct</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  To ensure fairness, equal opportunity, and integrity, all participants must comply with these guidelines.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1.5">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Identity Verification
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Prize disbursements and scholarship recognition require verification matching your Jambite profile details. Multi-accounting will result in permanent disqualification.
                  </p>
                </div>

                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1.5">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Synchronized Submissions
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    When the countdown ends, the arena accepts answers until the deadline. Late submissions caused by offline intervals are automatically processed with offline stamps.
                  </p>
                </div>

                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1.5">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" /> Anti-Cheat & Window Focus
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    The arena monitors tab switching and copy-paste activity. Excessive tab blurs trigger flag logs reviewed by moderators before prize issuance.
                  </p>
                </div>

                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1.5">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" /> Prize Distribution
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Cash prizes, airtime vouchers, and textbook vouchers are credited within 48 hours of final leaderboard verification.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Full Tournament Details & Rules Modal */}
      {selectedTournament && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedTournament(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Competition Overview
            </div>

            <h2 className="text-2xl font-bold font-display text-foreground pr-8">
              {selectedTournament.title}
            </h2>

            {selectedTournament.sponsor && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                Official Event Sponsored by {selectedTournament.sponsor}
              </p>
            )}

            <div className="mt-4 space-y-4 text-sm text-foreground">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
                <div className="bg-muted/40 p-3 rounded-xl border border-border text-muted-foreground leading-relaxed whitespace-pre-line text-xs">
                  {selectedTournament.description || 'Compete with scholars across Nigeria in this timed examination duel.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground block">Subject Scope</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.subject_filter || 'All UTME Subjects'}
                  </span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground block">Duration & Volume</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.question_count || 40} Questions in {selectedTournament.duration_minutes || 30} Mins
                  </span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground block">Entry Fee</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.entry_fee ? `₦${selectedTournament.entry_fee}` : '100% Free Entry'}
                  </span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                  <span className="text-amber-700 dark:text-amber-400 block font-semibold">Prize Reward</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">
                    {selectedTournament.prize_description || selectedTournament.cash_prize || 'Prestige & Badges'}
                  </span>
                </div>
              </div>

              {selectedTournament.rules && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Custom Rules</h4>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                    {selectedTournament.rules}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => {
                  const t = selectedTournament;
                  setSelectedTournament(null);
                  joinTournament(t);
                }}
                disabled={selectedTournament.status === 'locked' || registeredTournamentIds.includes(selectedTournament.id)}
                className="w-full font-bold h-11 bg-primary text-primary-foreground"
              >
                {registeredTournamentIds.includes(selectedTournament.id) 
                  ? 'Already Registered' 
                  : selectedTournament.status === 'locked' 
                  ? 'Tournament Closed' 
                  : selectedTournament.status === 'active' 
                  ? 'Enter Arena Now' 
                  : 'Register for Tournament'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
