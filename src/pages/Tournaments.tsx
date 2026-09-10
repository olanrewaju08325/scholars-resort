import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Trophy, Users, Clock, Zap, Home, Award, Calendar, Timer, Star,
  Lock, BookOpen, Coins, ShieldCheck, Sparkles, ChevronRight, Info, CheckCircle2, X,
  AlertCircle, ArrowRight, ShieldAlert, Check, CreditCard, Smartphone, Building2, Gift, Send
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { WeeklyChallenge } from '@/components/dashboard/WeeklyChallenge';

export default function Tournaments() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [registeredTournamentIds, setRegisteredTournamentIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('scholar_registered_tournaments');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [checkoutTournament, setCheckoutTournament] = useState<any | null>(null);
  const [paymentOption, setPaymentOption] = useState<'coins' | 'direct_transfer' | 'vip'>('coins');
  const [vipCode, setVipCode] = useState('');
  const [transferSenderName, setTransferSenderName] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [activeTab, setActiveTab] = useState('tournaments');

  // Prize Claim Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimTournament, setClaimTournament] = useState<any | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimPayoutType, setClaimPayoutType] = useState<'bank_transfer' | 'airtime' | 'scholar_wallet'>('bank_transfer');
  const [claimBankName, setClaimBankName] = useState('');
  const [claimAccountNumber, setClaimAccountNumber] = useState('');
  const [claimAccountName, setClaimAccountName] = useState('');
  const [claimPhoneNumber, setClaimPhoneNumber] = useState('');
  const [claimNetwork, setClaimNetwork] = useState('MTN');
  const [claimNotes, setClaimNotes] = useState('');
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  const fetchMyRegistrations = useCallback(async () => {
    const effectiveId = profile?.id || (user as any)?.id;
    const effectiveEmail = profile?.email || (user as any)?.email;
    if (!effectiveId && !effectiveEmail) return;

    try {
      const queryParams = new URLSearchParams();
      if (effectiveId) queryParams.set('userId', effectiveId);
      if (effectiveEmail) queryParams.set('email', effectiveEmail);

      const res = await fetch(`/api/tournaments/my-registrations?${queryParams.toString()}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.registeredTournamentIds)) {
        setRegisteredTournamentIds(prev => {
          const merged = Array.from(new Set([...prev, ...json.registeredTournamentIds]));
          try {
            localStorage.setItem('scholar_registered_tournaments', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not fetch registered tournaments:', err);
    }
  }, [profile?.id, profile?.email, (user as any)?.id, (user as any)?.email]);

  const fetchMyClaims = useCallback(async () => {
    const effectiveId = profile?.id || (user as any)?.id;
    if (!effectiveId) return;
    setLoadingClaims(true);
    try {
      const res = await fetch(`/api/tournaments/prize-claims?user_id=${encodeURIComponent(effectiveId)}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.claims)) {
        setMyClaims(json.claims);
      }
    } catch (err) {
      console.warn('Could not fetch prize claims:', err);
    } finally {
      setLoadingClaims(false);
    }
  }, [profile?.id, (user as any)?.id]);

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

      const entryFee = Number(meta.entry_fee ?? rawT.entry_fee ?? 0);
      const isFree = entryFee === 0;

      return {
        ...meta,
        ...rawT,
        entry_fee: entryFee,
        is_free: isFree,
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
    fetchMyClaims();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [fetchTournaments, fetchMyRegistrations, fetchMyClaims]);

  const handleRegisterClick = (tournament: any) => {
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

    // If paid tournament, show checkout modal
    if (tournament.entry_fee && tournament.entry_fee > 0) {
      setCheckoutTournament(tournament);
      return;
    }

    // Otherwise 1-click free registration
    executeRegistration(tournament, { payment_method: 'free' });
  };

  const executeRegistration = async (tournament: any, paymentDetails: any = {}) => {
    setRegisteringId(tournament.id);
    try {
      const res = await fetch('/api/tournaments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournament.id,
          legacy_id: tournament.legacy_id,
          user_id: profile?.id,
          user_name: profile?.full_name || profile?.email || 'Scholar',
          user_email: profile?.email || '',
          ...paymentDetails
        })
      });

      const json = await res.json();
      if (json?.success) {
        toast.success(json.message || "Successfully registered for tournament!");
        setRegisteredTournamentIds(prev => {
          const updated = Array.from(new Set([...prev, tournament.id, tournament.legacy_id].filter(Boolean)));
          try {
            localStorage.setItem('scholar_registered_tournaments', JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCheckoutTournament(null);
        if (refreshProfile) refreshProfile();
        fetchTournaments();
      } else {
        toast.error(json?.error || "Registration failed. Please try again.");
      }
    } catch {
      toast.error("Network connection error. Please try again.");
    } finally {
      setRegisteringId(null);
    }
  };

  const handlePaidCheckout = async () => {
    if (!checkoutTournament || !profile) return;

    if (paymentOption === 'coins') {
      const requiredCoins = checkoutTournament.entry_fee || 500;
      const userCoins = profile.coins || 0;
      if (userCoins < requiredCoins) {
        toast.error(`Insufficient coins! You have ${userCoins} coins, need ${requiredCoins}.`);
        return;
      }
      await executeRegistration(checkoutTournament, {
        payment_method: 'coins',
        coins_deducted: requiredCoins
      });
    } else if (paymentOption === 'vip') {
      if (!vipCode.trim()) {
        toast.error("Please enter your Scholarship or VIP Access Code");
        return;
      }
      if (checkoutTournament.invite_code && checkoutTournament.invite_code.toLowerCase() === vipCode.trim().toLowerCase()) {
        await executeRegistration(checkoutTournament, {
          payment_method: 'scholarship_code',
          payment_reference: `VIP_${vipCode.trim()}`
        });
      } else {
        toast.error("Invalid VIP / Scholarship Code. Please check and try again.");
      }
    } else {
      // Direct Nigerian Bank Transfer / Reference verification
      if (!transferSenderName.trim() && !transferReference.trim()) {
        toast.error("Please enter your Sender Name or Bank Transfer Reference to confirm your payment.");
        return;
      }
      await executeRegistration(checkoutTournament, {
        payment_method: 'direct_bank_transfer',
        payment_reference: transferReference.trim() || `TRF_${Date.now()}_${transferSenderName.trim()}`,
        sender_name: transferSenderName.trim()
      });
    }
  };

  const handleSubmitPrizeClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !claimTournament) return;

    setClaimSubmitting(true);
    try {
      const res = await fetch('/api/tournaments/prize-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: claimTournament.id,
          tournament_title: claimTournament.title,
          user_id: profile.id,
          user_name: profile.full_name || profile.email || 'Scholar Winner',
          user_email: profile.email || '',
          rank: claimTournament.userRank || 1,
          score: claimTournament.userScore || 100,
          payout_type: claimPayoutType,
          bank_name: claimBankName,
          account_number: claimAccountNumber,
          account_name: claimAccountName,
          phone_number: claimPhoneNumber,
          telecom_network: claimNetwork,
          prize_amount: claimTournament.prize_description || claimTournament.cash_prize || 'Prize Reward',
          notes: claimNotes
        })
      });

      const json = await res.json();
      if (json?.success) {
        toast.success(json.message || "Prize claim submitted successfully!");
        setClaimModalOpen(false);
        fetchMyClaims();
      } else {
        toast.error(json?.error || "Failed to submit prize claim");
      }
    } catch {
      toast.error("Network error while submitting claim.");
    } finally {
      setClaimSubmitting(false);
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
    if (h > 0) return `${h}m ${s}s`;
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-bold">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight flex items-center gap-2">
                  National Arena & Prized Duels
                </h1>
                <p className="text-muted-foreground text-sm">
                  Compete nationwide in 100% Free & Prized Tournaments. Win guaranteed cash prizes, airtime & university scholarships.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
            <TabsTrigger value="claims" className="gap-2 font-semibold text-xs sm:text-sm">
              <Gift className="w-4 h-4 text-emerald-500" /> Prize Claims ({myClaims.length})
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
                      const prize = tournament.prize_description || (tournament.cash_prize ? `₦${Number(tournament.cash_prize).toLocaleString()} Cash Prize` : 'Scholar Prestige & Badges');
                      const sponsor = tournament.sponsor || null;
                      const isPaid = Boolean(tournament.entry_fee && tournament.entry_fee > 0);

                      return (
                        <Card 
                          key={tournament.id} 
                          className={`bg-card text-card-foreground border transition-all duration-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md ${
                            isLive 
                              ? 'border-orange-500 ring-1 ring-orange-500/30' 
                              : isRegistered 
                              ? 'border-emerald-500/40' 
                              : isPaid 
                              ? 'border-amber-500/30' 
                              : 'border-border'
                          }`}
                        >
                          {/* Top Status Banner */}
                          <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-semibold border-b ${
                            isLive 
                              ? 'bg-orange-500 text-white border-orange-600' 
                              : isRegistered
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                              : isPaid
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
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
                              
                              {/* Prominent Free vs Paid Badge */}
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <Coins className="w-3.5 h-3.5 text-amber-500" /> Entry Fee: ₦{Number(tournament.entry_fee).toLocaleString()}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <Gift className="w-3.5 h-3.5 text-emerald-500" /> 100% FREE ENTRY
                                </span>
                              )}

                              {/* Cash Prize Tag */}
                              {(tournament.cash_prize || tournament.prize_description) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> {prize}
                                </span>
                              )}

                              {sponsor && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                  <Sparkles className="w-3.5 h-3.5" /> Sponsored by {sponsor}
                                </span>
                              )}
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
                                  <Award className="w-3.5 h-3.5 text-amber-500" /> Reward
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
                                  onClick={() => handleRegisterClick(tournament)}
                                  className={`w-full sm:flex-1 h-12 text-sm font-bold text-primary-foreground shadow-sm ${
                                    isPaid 
                                      ? 'bg-amber-600 hover:bg-amber-700' 
                                      : 'bg-primary hover:bg-primary/90'
                                  }`}
                                >
                                  {isRegistering ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                      Registering Your Seat...
                                    </>
                                  ) : isLocked ? (
                                    'REGISTRATION CLOSED'
                                  ) : isPaid ? (
                                    `JOIN ARENA (₦${Number(tournament.entry_fee).toLocaleString()})`
                                  ) : (
                                    'REGISTER FREE NOW'
                                  )}
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                onClick={() => setSelectedTournament(tournament)}
                                className="w-full sm:w-auto h-12 px-4 border-border text-foreground hover:bg-muted text-xs font-semibold gap-1.5"
                              >
                                <Info className="w-4 h-4 text-primary" /> Rules & Prizes
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
                          <div className="text-right">
                            <span className="font-bold text-muted-foreground block">{pt.participants_count || 0} scholars</span>
                            <button
                              onClick={() => {
                                setClaimTournament(pt);
                                setClaimModalOpen(true);
                              }}
                              className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                            >
                              Claim Prize
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-2xl shadow-sm">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Prize Disbursal Guarantee
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 text-xs text-muted-foreground space-y-2 leading-relaxed">
                    <p>• <strong>Cash Transfer:</strong> Direct to all Nigerian commercial and microfinance bank accounts within 48 hours.</p>
                    <p>• <strong>Instant Airtime:</strong> Topups delivered directly to MTN, Airtel, Glo, and 9mobile lines.</p>
                    <p>• <strong>Speed-Tiebreaker:</strong> Rankings are calculated by highest score first, then fastest completion time.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: MY PRIZE CLAIMS */}
          <TabsContent value="claims" className="mt-6 space-y-6">
            <Card className="bg-card text-card-foreground border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h3 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    <Gift className="w-5 h-5 text-emerald-500" /> Your Tournament Prize Claims & Payouts
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Track cash transfers and airtime disbursements for competitions where you placed on the leaderboard.
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setClaimTournament({
                      id: 'custom_claim',
                      title: 'UTME Challenge Prize Reward',
                      prize_description: 'Cash / Airtime Reward',
                      userRank: 1,
                      userScore: 100
                    });
                    setClaimModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs"
                >
                  <Send className="w-4 h-4" /> Submit New Claim
                </Button>
              </div>

              {loadingClaims ? (
                <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
              ) : myClaims.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <Trophy className="w-10 h-10 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="font-bold text-foreground">No Prize Claims Submitted Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When you compete in a tournament and place in winning ranks, submit your Nigerian Bank or Phone details here to receive your payout!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myClaims.map((claim: any) => {
                    const isDisbursed = claim.status === 'disbursed';
                    const isVerified = claim.status === 'verified';
                    const isRejected = claim.status === 'rejected';

                    return (
                      <div key={claim.id} className="p-4 bg-muted/40 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{claim.tournament_title}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Rank #{claim.rank}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {claim.payout_type === 'bank_transfer' ? (
                              <span>Bank: {claim.bank_name} • {claim.account_number} ({claim.account_name})</span>
                            ) : claim.payout_type === 'airtime' ? (
                              <span>Airtime: {claim.telecom_network} • {claim.phone_number}</span>
                            ) : (
                              <span>Scholar Coins Wallet Credit</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Claimed on {new Date(claim.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1">
                          <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                            isDisbursed ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' :
                            isVerified ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30' :
                            isRejected ? 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30' :
                            'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          }`}>
                            {claim.status || 'Pending Verification'}
                          </span>
                          {claim.disbursal_reference && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Ref: {claim.disbursal_reference}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 3: WEEKLY SPEED CHALLENGE */}
          <TabsContent value="weekly" className="mt-6 space-y-6">
            <WeeklyChallenge />
          </TabsContent>

          {/* TAB 4: RULES & FAIR PLAY */}
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

      {/* PAID CHECKOUT MODAL */}
      {checkoutTournament && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setCheckoutTournament(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
              <Coins className="w-4 h-4" /> Tournament Entry Pass
            </div>

            <h2 className="text-xl font-bold font-display text-foreground pr-6">
              {checkoutTournament.title}
            </h2>

            <p className="text-xs text-muted-foreground mt-1">
              Required Entry Fee: <strong className="text-foreground">₦{Number(checkoutTournament.entry_fee).toLocaleString()}</strong>
            </p>

            <div className="mt-5 space-y-3">
              <label className="text-xs font-bold uppercase text-muted-foreground">Select Payment Method</label>
              
              <div 
                onClick={() => setPaymentOption('coins')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  paymentOption === 'coins' ? 'bg-amber-500/10 border-amber-500' : 'bg-muted/40 border-border hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Scholar Coins</p>
                    <p className="text-xs text-muted-foreground">Your Balance: {profile?.coins || 0} Coins</p>
                  </div>
                </div>
                <span className="font-bold text-sm text-amber-600 dark:text-amber-400">{checkoutTournament.entry_fee || 500} Coins</span>
              </div>

              <div 
                onClick={() => setPaymentOption('direct_transfer')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2.5 ${
                  paymentOption === 'direct_transfer' ? 'bg-primary/10 border-primary' : 'bg-muted/40 border-border hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Direct Bank Transfer</p>
                      <p className="text-xs text-muted-foreground">Pay to official account & confirm</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-foreground">₦{Number(checkoutTournament.entry_fee).toLocaleString()}</span>
                </div>

                {paymentOption === 'direct_transfer' && (
                  <div className="mt-2 p-3 bg-background/80 rounded-lg border border-border space-y-2 text-xs">
                    <div className="p-2 bg-primary/5 rounded border border-primary/20 space-y-0.5">
                      <p className="font-bold text-primary">Official Payment Account:</p>
                      <p className="text-foreground">Bank: <strong>OPay / Moniepoint MFB</strong></p>
                      <p className="text-foreground">Account Name: <strong>Scholars Resort Arena</strong></p>
                      <p className="text-foreground">Account Number: <strong className="font-mono text-sm tracking-wider text-primary">8100123456</strong></p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Sender Account Name</label>
                      <Input 
                        value={transferSenderName}
                        onChange={e => setTransferSenderName(e.target.value)}
                        placeholder="e.g. Samuel Adebayo"
                        className="bg-background border-border text-foreground text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Transfer Reference / Receipt Code (Optional)</label>
                      <Input 
                        value={transferReference}
                        onChange={e => setTransferReference(e.target.value)}
                        placeholder="e.g. NIP/2026/893749"
                        className="bg-background border-border text-foreground text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div 
                onClick={() => setPaymentOption('vip')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                  paymentOption === 'vip' ? 'bg-blue-500/10 border-blue-500' : 'bg-muted/40 border-border hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Scholarship / VIP Passcode</p>
                    <p className="text-xs text-muted-foreground">Free entry with approved voucher</p>
                  </div>
                </div>

                {paymentOption === 'vip' && (
                  <Input 
                    value={vipCode}
                    onChange={e => setVipCode(e.target.value)}
                    placeholder="Enter VIP / Scholarship code"
                    className="bg-background border-border text-foreground text-xs mt-1"
                  />
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCheckoutTournament(null)}
                className="w-1/3 border-border text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePaidCheckout}
                disabled={registeringId === checkoutTournament.id}
                className="w-2/3 font-bold bg-primary text-primary-foreground text-xs h-10"
              >
                {registeringId === checkoutTournament.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Complete & Register'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PRIZE CLAIM MODAL */}
      {claimModalOpen && claimTournament && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setClaimModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
              <Award className="w-4 h-4" /> Prize Claim & Disbursal Form
            </div>

            <h2 className="text-2xl font-bold font-display text-foreground pr-8">
              Claim Your Reward
            </h2>

            <p className="text-xs text-muted-foreground mt-1">
              Event: <strong className="text-foreground">{claimTournament.title}</strong> • Reward: <strong className="text-amber-600 dark:text-amber-400">{claimTournament.prize_description || claimTournament.cash_prize || 'Prize Reward'}</strong>
            </p>

            <form onSubmit={handleSubmitPrizeClaim} className="mt-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Payout Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setClaimPayoutType('bank_transfer')}
                    className={`p-2.5 rounded-lg border font-bold flex flex-col items-center gap-1 transition-all ${
                      claimPayoutType === 'bank_transfer' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Bank Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClaimPayoutType('airtime')}
                    className={`p-2.5 rounded-lg border font-bold flex flex-col items-center gap-1 transition-all ${
                      claimPayoutType === 'airtime' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Airtime</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClaimPayoutType('scholar_wallet')}
                    className={`p-2.5 rounded-lg border font-bold flex flex-col items-center gap-1 transition-all ${
                      claimPayoutType === 'scholar_wallet' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    <span>Scholar Coins</span>
                  </button>
                </div>
              </div>

              {claimPayoutType === 'bank_transfer' && (
                <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Bank Name</label>
                    <Input 
                      value={claimBankName}
                      onChange={e => setClaimBankName(e.target.value)}
                      placeholder="e.g. GTBank, Zenith, Access, OPay, Kuda, Moniepoint"
                      className="bg-background border-border text-foreground text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Account Number (10 Digits)</label>
                      <Input 
                        value={claimAccountNumber}
                        onChange={e => setClaimAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0123456789"
                        className="bg-background border-border text-foreground text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Account Name</label>
                      <Input 
                        value={claimAccountName}
                        onChange={e => setClaimAccountName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="bg-background border-border text-foreground text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {claimPayoutType === 'airtime' && (
                <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Telecom Network</label>
                    <select
                      value={claimNetwork}
                      onChange={e => setClaimNetwork(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border rounded-md text-xs text-foreground outline-none"
                    >
                      <option value="MTN">MTN Nigeria</option>
                      <option value="Airtel">Airtel Nigeria</option>
                      <option value="Glo">Globacom (Glo)</option>
                      <option value="9mobile">9mobile</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Phone Number</label>
                    <Input 
                      value={claimPhoneNumber}
                      onChange={e => setClaimPhoneNumber(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="bg-background border-border text-foreground text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Additional Notes (Optional)</label>
                <Input 
                  value={claimNotes}
                  onChange={e => setClaimNotes(e.target.value)}
                  placeholder="e.g. Please send confirmation SMS"
                  className="bg-background border-border text-foreground text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClaimModalOpen(false)}
                  className="border-border text-foreground hover:bg-muted text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={claimSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  {claimSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Submit Payout Details
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <span className="text-muted-foreground block">Entry Status</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {selectedTournament.entry_fee ? `₦${Number(selectedTournament.entry_fee).toLocaleString()} Paid Entry` : '100% Free Entry'}
                  </span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                  <span className="text-amber-700 dark:text-amber-400 block font-semibold">Prize Reward</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">
                    {selectedTournament.prize_description || (selectedTournament.cash_prize ? `₦${Number(selectedTournament.cash_prize).toLocaleString()} Cash` : 'Prestige & Badges')}
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
                  handleRegisterClick(t);
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
                  : selectedTournament.entry_fee 
                  ? `Register (₦${Number(selectedTournament.entry_fee).toLocaleString()})` 
                  : 'Register Free for Tournament'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
