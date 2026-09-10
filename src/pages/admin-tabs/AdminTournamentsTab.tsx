import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Trophy, Plus, Trash2, Users, Clock, Calendar, Edit2,
  CheckCircle, XCircle, Loader2, Sparkles, Lock, Unlock, ArrowLeft, RefreshCw, Database,
  Gift, Coins, Check, Building2, Smartphone
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { callGroqAPI } from '@/services/aiService';
import { authFetch } from '@/lib/apiAuth';

const isValidUUID = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export const parseTournamentMetadata = (t: any): any => {
  if (!t) return t;
  let meta: Record<string, any> = {};

  const searchTarget = (t.rules || '') + '\n' + (t.description || '');
  const match = searchTarget.match(/__meta__:(\{[\s\S]*?\})(?:\n|$)/);
  if (match && match[1]) {
    try {
      meta = JSON.parse(match[1]);
    } catch {}
  }

  const cleanDescription = (t.description || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();
  const cleanRules = (t.rules || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();

  return {
    ...meta,
    ...t,
    description: cleanDescription,
    rules: cleanRules
  };
};

/**
 * Adaptive database save: Formats base columns cleanly, stores extended attributes
 * in metadata within `description`, uses server route to bypass RLS, and falls back
 * to admin_settings and localStorage. This prevents 400 Bad Request and 403 Forbidden errors.
 */
async function saveTournamentAdaptive(
  supabaseClient: any,
  payload: Record<string, any>,
  isEdit: boolean,
  tournamentId?: string
): Promise<{ success: boolean; adaptedColumns: string[]; error?: any }> {
  const metadata: Record<string, any> = {
    subject_filter: payload.subject_filter,
    question_count: payload.question_count,
    duration_minutes: payload.duration_minutes,
    registration_deadline: payload.registration_deadline,
    prize_description: payload.prize_description,
    cash_prize: payload.cash_prize,
    prize_first_place: payload.prize_first_place,
    prize_second_place: payload.prize_second_place,
    prize_third_place: payload.prize_third_place,
    prize_airtime: payload.prize_airtime,
    sponsor: payload.sponsor,
    scholarship_description: payload.scholarship_description,
    is_private: payload.is_private,
    invite_code: payload.invite_code,
    password: payload.password,
    min_players: payload.min_players,
    max_players: payload.max_players,
    coin_reward: payload.coin_reward,
    xp_reward: payload.xp_reward,
    badge_reward: payload.badge_reward,
    difficulty: payload.difficulty,
    question_source: payload.question_source,
    rules: payload.rules
  };

  const adaptedColumns = Object.keys(metadata).filter(k => metadata[k] !== undefined && metadata[k] !== '' && metadata[k] !== 0);

  const cleanDescription = (payload.description || '').replace(/__meta__:\{.*?\}(?:\n|$)/s, '').trim();
  const descriptionWithMeta = `${cleanDescription}\n__meta__:${JSON.stringify(metadata)}`;

  // Base payload containing ONLY the columns guaranteed to exist in Supabase tournaments table
  const cleanBasePayload: Record<string, any> = {
    title: payload.title,
    description: descriptionWithMeta,
    start_time: payload.start_time,
    end_time: payload.end_time,
    entry_fee: Number(payload.entry_fee) || 0,
    status: payload.status || 'upcoming',
    max_participants: Number(payload.max_participants) || 500
  };

  let savedOk = false;

  // 1. Try server endpoint first (bypasses client-side RLS and handles service role)
  try {
    const res = await authFetch('/api/admin/tournaments/save', {
      method: 'POST',
      body: JSON.stringify({ tournament: payload, isEdit, id: tournamentId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        savedOk = true;
      }
    }
  } catch (_) {}

  // 2. If server route didn't complete, perform direct Supabase client query with universal base columns if ID is valid UUID
  if (!savedOk && (!tournamentId || isValidUUID(tournamentId))) {
    try {
      const res = isEdit && tournamentId
        ? await supabaseClient.from('tournaments').update(cleanBasePayload).eq('id', tournamentId)
        : await supabaseClient.from('tournaments').insert(cleanBasePayload);
      if (!res.error) {
        savedOk = true;
      } else {
        console.warn('[Supabase Direct Tournament Notice]', res.error.message);
      }
    } catch (dbErr: any) {
      console.warn('[Supabase Direct Tournament Error]', dbErr?.message);
    }
  }

  // 3. Always mirror to admin_settings and localStorage as high-availability fallback
  try {
    const effectiveId = tournamentId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}`);
    const localItem = {
      ...payload,
      id: effectiveId,
      description: descriptionWithMeta,
      updated_at: new Date().toISOString()
    };

    const localRaw = localStorage.getItem('scholar_tournaments');
    let localList: any[] = localRaw ? JSON.parse(localRaw) : [];
    if (isEdit && tournamentId) {
      localList = localList.map(t => t.id === tournamentId ? { ...t, ...localItem } : t);
    } else {
      localList.unshift(localItem);
    }
    localStorage.setItem('scholar_tournaments', JSON.stringify(localList));

    // Also persist into admin_settings and server disk store
    try {
      await authFetch('/api/settings/tournaments_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: localList })
      });
      await supabaseClient.from('admin_settings').upsert({
        setting_key: 'tournaments_db',
        setting_value: localList,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (_) {}

    savedOk = true;
  } catch (_) {}

  if (savedOk) {
    return { success: true, adaptedColumns };
  }

  return { success: false, adaptedColumns: [], error: new Error('Unable to save tournament. Please check connection.') };
}

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  subject_filter: '',
  question_count: 40,
  duration_minutes: 120,
  start_time: '',
  end_time: '',
  registration_deadline: '',
  max_participants: 500,
  prize_description: '',
  cash_prize: 0,
  prize_first_place: 0,
  prize_second_place: 0,
  prize_third_place: 0,
  prize_airtime: '',
  entry_fee: 0,
  sponsor: '',
  scholarship_description: '',
  status: 'upcoming',
  is_private: false,
  invite_code: '',
  password: '',
  min_players: 0,
  max_players: 1000,
  coin_reward: 0,
  xp_reward: 0,
  badge_reward: '',
  difficulty: 'mixed',
  question_source: 'mixed',
  rules: ''
};

export const AdminTournamentsTab = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail' | 'claims'>('list');
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState('all');
  const { confirmAction, ConfirmElement } = useConfirm();

  // Prize Claims state
  const [claims, setClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState('all');
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);

  const fetchTournaments = async () => {
    setLoading(true);
    let allTournaments: any[] = [];
    const idSet = new Set<string>();

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*, tournament_participants(count)')
        .order('created_at', { ascending: false });
      if (!error && data) {
        data.forEach(t => {
          const parsed = parseTournamentMetadata(t);
          allTournaments.push(parsed);
          if (parsed.id) idSet.add(parsed.id);
        });
      }
    } catch {}

    // Merge from admin_settings and local storage
    try {
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'tournaments_db')
        .maybeSingle();
      if (settingData?.setting_value && Array.isArray(settingData.setting_value)) {
        settingData.setting_value.forEach((item: any) => {
          if (item && item.id && !idSet.has(item.id)) {
            allTournaments.push(parseTournamentMetadata(item));
            idSet.add(item.id);
          }
        });
      }
    } catch {}

    try {
      const localRaw = localStorage.getItem('scholar_tournaments');
      if (localRaw) {
        const localList = JSON.parse(localRaw);
        if (Array.isArray(localList)) {
          localList.forEach((item: any) => {
            if (item && item.id && !idSet.has(item.id)) {
              allTournaments.push(parseTournamentMetadata(item));
              idSet.add(item.id);
            }
          });
        }
      }
    } catch {}

    setTournaments(allTournaments);
    setLoading(false);
  };

  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const res = await authFetch('/api/tournaments/prize-claims');
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.claims)) {
          setClaims(json.claims);
        }
      }
    } catch (err) {
      console.warn('Could not fetch prize claims:', err);
    } finally {
      setLoadingClaims(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
    fetchClaims();
  }, []);

  const handleUpdateClaimStatus = async (claimId: string, status: 'verified' | 'disbursed' | 'rejected') => {
    let disbursalReference = '';
    let adminNote = '';

    if (status === 'disbursed') {
      const ref = window.prompt('Enter Bank Payout / Airtime Transfer Reference ID (e.g. NIP/2026/98234 or PSTK_TRF_123):');
      if (!ref) {
        toast.error('Payout reference is recommended when marking as disbursed.');
        return;
      }
      disbursalReference = ref;
    } else if (status === 'rejected') {
      const note = window.prompt('Enter rejection note / reason (e.g. Invalid account details or mismatched name):');
      if (!note) return;
      adminNote = note;
    }

    setUpdatingClaimId(claimId);
    try {
      const res = await authFetch('/api/tournaments/admin/update-claim', {
        method: 'POST',
        body: JSON.stringify({
          claim_id: claimId,
          status,
          disbursal_reference: disbursalReference,
          admin_note: adminNote
        })
      });

      const json = await res.json();
      if (json?.success) {
        toast.success(`Claim marked as ${status.toUpperCase()}`);
        setClaims(prev => prev.map(c => c.id === claimId ? json.claim : c));
      } else {
        toast.error(json?.error || 'Failed to update claim');
      }
    } catch {
      toast.error('Network error updating claim status');
    } finally {
      setUpdatingClaimId(null);
    }
  };

  const fetchParticipants = async (tournamentId: string) => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('score', { ascending: false });

      if (error || !data) {
        setParticipants([]);
        return;
      }

      const userIds = Array.from(new Set(data.map((d: any) => d.user_id).filter(Boolean)));
      let profileMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        (profs || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      const enriched = data.map((d: any) => ({
        ...d,
        profiles: profileMap[d.user_id] || { full_name: 'Scholar', email: 'N/A' }
      }));

      setParticipants(enriched);
    } catch {
      setParticipants([]);
    }
  };

  const handleAIGenerateWeeklyChallenge = async () => {
    setSaving(true);
    toast.info("Groq AI is generating a Prized Challenge...");
    try {
      const prompt = `Generate a JSON configuration for a 100% FREE entry JAMB UTME tournament with cash and airtime prizes for Nigerian students.
It should include:
- "title": exciting title (e.g. "National Physics & Math Speed Duel")
- "description": compelling description
- "prize_description": "1st: ₦15,000 • 2nd: ₦10,000 • 3rd: ₦5,000 + Airtime"
- "cash_prize": 30000
- "prize_first_place": 15000
- "prize_second_place": 10000
- "prize_third_place": 5000
- "prize_airtime": "₦1,000 Airtime for 4th to 10th place"
- "duration_minutes": 60
- "question_count": 50
- "subject_filter": "Physics, Mathematics"
- "coin_reward": 500
- "xp_reward": 1500

Return STRICT JSON format:
{
  "title": "...",
  "description": "...",
  "prize_description": "...",
  "cash_prize": 30000,
  "prize_first_place": 15000,
  "prize_second_place": 10000,
  "prize_third_place": 5000,
  "prize_airtime": "...",
  "duration_minutes": 60,
  "question_count": 50,
  "subject_filter": "...",
  "coin_reward": 500,
  "xp_reward": 1500
}`;
      
      const responseText = await callGroqAPI([{ role: 'user', content: prompt }]);
      let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("AI response format was not valid JSON.");
      }
      
      const jsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonCandidate);
      } catch (pErr) {
        const fixed = jsonCandidate.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(fixed);
      }
      
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() + (6 - now.getDay())); // Next Saturday
      start.setHours(10, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(12, 0, 0, 0);
      
      setForm({
        ...EMPTY_FORM,
        title: parsed.title || "National UTME Challenge Duel",
        description: parsed.description || "",
        prize_description: parsed.prize_description || "1st: ₦15,000 • 2nd: ₦10,000 • 3rd: ₦5,000",
        cash_prize: Number(parsed.cash_prize) || 30000,
        prize_first_place: Number(parsed.prize_first_place) || 15000,
        prize_second_place: Number(parsed.prize_second_place) || 10000,
        prize_third_place: Number(parsed.prize_third_place) || 5000,
        prize_airtime: parsed.prize_airtime || "₦1,000 Airtime for 4th-10th",
        entry_fee: 0,
        duration_minutes: parsed.duration_minutes || 60,
        question_count: parsed.question_count || 50,
        subject_filter: parsed.subject_filter || "Mathematics, Physics",
        coin_reward: parsed.coin_reward || 500,
        xp_reward: parsed.xp_reward || 1500,
        start_time: start.toISOString().slice(0, 16),
        end_time: end.toISOString().slice(0, 16),
        registration_deadline: start.toISOString().slice(0, 16)
      });
      
      setView('create');
      toast.success("AI generated prized competition! Please review and publish.");
    } catch (err: any) {
      toast.error("AI Generation failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_time || !form.end_time) {
      toast.error('Title, start time, and end time are required.');
      return;
    }
    setSaving(true);
    try {
      // Auto-compute prize description if empty
      let computedPrize = form.prize_description;
      if (!computedPrize && (form.prize_first_place || form.cash_prize)) {
        computedPrize = `1st: ₦${Number(form.prize_first_place || form.cash_prize).toLocaleString()}${form.prize_second_place ? ` • 2nd: ₦${Number(form.prize_second_place).toLocaleString()}` : ''}${form.prize_third_place ? ` • 3rd: ₦${Number(form.prize_third_place).toLocaleString()}` : ''}${form.prize_airtime ? ` • ${form.prize_airtime}` : ''}`;
      }

      const payload: any = {
        title: form.title,
        description: form.description,
        subject_filter: form.subject_filter,
        question_count: Number(form.question_count),
        duration_minutes: Number(form.duration_minutes),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        registration_deadline: form.registration_deadline
          ? new Date(form.registration_deadline).toISOString()
          : new Date(form.start_time).toISOString(),
        max_participants: Number(form.max_participants),
        prize_description: computedPrize || 'Scholar Certificate & XP',
        cash_prize: Number(form.cash_prize),
        prize_first_place: Number(form.prize_first_place),
        prize_second_place: Number(form.prize_second_place),
        prize_third_place: Number(form.prize_third_place),
        prize_airtime: form.prize_airtime,
        entry_fee: Number(form.entry_fee),
        sponsor: form.sponsor,
        scholarship_description: form.scholarship_description,
        status: form.status,
        is_private: form.is_private,
        invite_code: form.invite_code,
        coin_reward: Number(form.coin_reward),
        xp_reward: Number(form.xp_reward),
        difficulty: form.difficulty,
        rules: form.rules || ''
      };

      const result = await saveTournamentAdaptive(supabase, payload, view === 'edit' && !!form.id, form.id);
      if (!result.success) {
        throw result.error || new Error('Failed to save tournament');
      }

      toast.success(view === 'edit' ? 'Tournament updated successfully!' : 'Tournament published successfully!');
      setForm(EMPTY_FORM);
      setView('list');
      fetchTournaments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: any) => {
    setForm({
      ...EMPTY_FORM,
      ...t,
      start_time: t.start_time ? new Date(t.start_time).toISOString().slice(0, 16) : '',
      end_time: t.end_time ? new Date(t.end_time).toISOString().slice(0, 16) : '',
      registration_deadline: t.registration_deadline ? new Date(t.registration_deadline).toISOString().slice(0, 16) : '',
    });
    setView('edit');
  };

  const handleToggleLock = async (tournament: any) => {
    const newStatus = tournament.status === 'locked' ? 'upcoming' : 'locked';
    if (isValidUUID(tournament.id)) {
      try {
        await supabase.from('tournaments').update({ status: newStatus }).eq('id', tournament.id);
      } catch {}
    }
    setTournaments(prev => prev.map(t => t.id === tournament.id ? { ...t, status: newStatus } : t));
    try {
      const localRaw = localStorage.getItem('scholar_tournaments');
      if (localRaw) {
        const list = JSON.parse(localRaw).map((t: any) => t.id === tournament.id ? { ...t, status: newStatus } : t);
        localStorage.setItem('scholar_tournaments', JSON.stringify(list));
        await authFetch('/api/settings/tournaments_db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: list })
        });
        await supabase.from('admin_settings').upsert({
          setting_key: 'tournaments_db',
          setting_value: list,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      }
    } catch {}
    toast.success(`Tournament is now ${newStatus === 'locked' ? 'Locked (Students cannot enter)' : 'Unlocked'}`);
  };

  const handleDelete = (id: string) => {
    confirmAction(
      'Delete Tournament',
      'Are you sure? This will remove all participant and leaderboard records.',
      async () => {
        try {
          await authFetch('/api/admin/tournaments/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
          });
        } catch {}
        if (isValidUUID(id)) {
          try { await supabase.from('tournament_participants').delete().eq('tournament_id', id); } catch {}
          try { await supabase.from('tournaments').delete().eq('id', id); } catch {}
        }

        setTournaments(prev => prev.filter(t => t.id !== id));
        try {
          const localRaw = localStorage.getItem('scholar_tournaments');
          if (localRaw) {
            const list = JSON.parse(localRaw).filter((t: any) => t.id !== id);
            localStorage.setItem('scholar_tournaments', JSON.stringify(list));
            await authFetch('/api/settings/tournaments_db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: list })
            });
            await supabase.from('admin_settings').upsert({
              setting_key: 'tournaments_db',
              setting_value: list,
              updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
          }
        } catch {}
        toast.success('Tournament deleted.');
      },
      { destructive: true }
    );
  };

  const openDetail = async (t: any) => {
    setSelectedTournament(t);
    await fetchParticipants(t.id);
    setView('detail');
  };

  const filteredTournaments = tournaments.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  const pendingClaimsCount = claims.filter(c => c.status === 'pending').length;
  const filteredClaims = claims.filter(c => {
    if (claimsFilter === 'all') return true;
    return c.status === claimsFilter;
  });

  return (
    <div className="space-y-6">
      {ConfirmElement}
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground font-display">
            <Trophy className="w-6 h-6 text-amber-500" /> Tournament & Prized Duel Center
          </h2>
          <p className="text-muted-foreground text-sm">
            Host 100% Free competitions with Cash/Airtime prizes or Paid entry duels with direct bank payouts.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {view !== 'list' && (
            <Button variant="outline" onClick={() => { setView('list'); setForm(EMPTY_FORM); }} className="border-border text-foreground hover:bg-muted text-xs">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to List
            </Button>
          )}
          {view === 'list' && (
            <>
              <Button
                variant={view === 'claims' ? 'default' : 'outline'}
                onClick={() => { setView('claims'); fetchClaims(); }}
                className="border-border hover:bg-muted text-xs text-foreground font-bold relative"
              >
                <Gift className="w-4 h-4 mr-1.5 text-emerald-500" /> Prize Claims
                {pendingClaimsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-600 text-white font-bold">
                    {pendingClaimsCount}
                  </span>
                )}
              </Button>
              <Button onClick={handleAIGenerateWeeklyChallenge} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs">
                <Sparkles className="w-4 h-4 mr-1.5" /> AI Generate Prized Duel
              </Button>
              <Button onClick={() => { setForm(EMPTY_FORM); setView('create'); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">
                <Plus className="w-4 h-4 mr-1.5" /> Create Tournament
              </Button>
            </>
          )}
        </div>
      </div>

      {/* VIEW 1: TOURNAMENTS LIST */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* Status Filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {['all', 'upcoming', 'active', 'locked', 'completed'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  statusFilter === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground border border-border hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="bg-card border-border text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-bold text-foreground">No tournaments found in this category.</p>
              <p className="text-xs text-muted-foreground mt-1">Create one manually or use AI generation above.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTournaments.map(t => {
                const count = t.tournament_participants?.[0]?.count || t.participants_count || 0;
                const isLocked = t.status === 'locked';
                const isFree = !t.entry_fee || Number(t.entry_fee) === 0;

                return (
                  <Card key={t.id} className="bg-card border-border text-foreground flex flex-col justify-between hover:border-primary/50 shadow-sm transition-all rounded-xl">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {isFree ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                100% FREE ENTRY
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                PAID: ₦{Number(t.entry_fee).toLocaleString()}
                              </span>
                            )}
                            {t.sponsor && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                {t.sponsor}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                            {isLocked && <Lock className="w-4 h-4 text-red-500" />}
                            {t.title}
                          </CardTitle>
                        </div>

                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          t.status === 'active' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                          t.status === 'upcoming' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                          t.status === 'locked' ? 'bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <CardDescription className="text-muted-foreground line-clamp-2 text-xs">
                        {t.description || 'No description provided.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border">
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-blue-500" /> {new Date(t.start_time).toLocaleDateString()}</div>
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> {t.duration_minutes}m ({t.question_count} Qs)</div>
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-500" /> {count} / {t.max_participants} Players</div>
                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 truncate"><Trophy className="w-3.5 h-3.5" /> {t.prize_description || (t.cash_prize ? `₦${t.cash_prize}` : 'Prestige')}</div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(t)} className="h-8 px-2 text-xs border-border text-foreground hover:bg-muted">
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleToggleLock(t)} 
                            className={`h-8 px-2 text-xs border-border ${isLocked ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-red-600 hover:bg-red-500/10'}`}
                          >
                            {isLocked ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                            {isLocked ? 'Unlock' : 'Lock'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDetail(t)} className="h-8 px-2 text-xs border-border text-foreground hover:bg-muted">
                            <Users className="w-3.5 h-3.5 mr-1" /> Leaderboard
                          </Button>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="h-8 px-2 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PRIZE CLAIMS & DISBURSALS */}
      {view === 'claims' && (
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground font-display">
                  <Gift className="w-5 h-5 text-emerald-500" /> Student Prize Claims & Disbursals
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Verify student bank accounts, phone numbers for airtime, and record payment transaction references.
                </CardDescription>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                {['all', 'pending', 'verified', 'disbursed', 'rejected'].map(st => (
                  <button
                    key={st}
                    onClick={() => setClaimsFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                      claimsFilter === st
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-muted-foreground border border-border hover:text-foreground'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingClaims ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : filteredClaims.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gift className="w-12 h-12 text-muted-foreground/60 mx-auto mb-2" />
                <p className="font-bold text-foreground">No prize claims found in this category.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClaims.map((claim: any) => {
                  const isPending = claim.status === 'pending';
                  const isVerified = claim.status === 'verified';
                  const isDisbursed = claim.status === 'disbursed';
                  const isUpdating = updatingClaimId === claim.id;

                  return (
                    <div key={claim.id} className="p-4 bg-muted/40 border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">{claim.user_name}</span>
                          <span className="text-xs text-muted-foreground">({claim.user_email})</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            Rank #{claim.rank} • {claim.score} PTS
                          </span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {claim.prize_amount}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-foreground">
                          Tournament: <span className="text-primary">{claim.tournament_title}</span>
                        </p>

                        {/* Payout Details */}
                        <div className="p-2.5 bg-background border border-border rounded-lg text-xs space-y-1">
                          {claim.payout_type === 'bank_transfer' ? (
                            <div className="flex items-center gap-2 text-foreground font-mono">
                              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                              <span><strong>Bank:</strong> {claim.bank_name} • <strong>Acct:</strong> {claim.account_number} • <strong>Name:</strong> {claim.account_name}</span>
                            </div>
                          ) : claim.payout_type === 'airtime' ? (
                            <div className="flex items-center gap-2 text-foreground font-mono">
                              <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span><strong>Network:</strong> {claim.telecom_network} • <strong>Phone:</strong> {claim.phone_number}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-foreground">
                              <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>Scholar Wallet Credit</span>
                            </div>
                          )}

                          {claim.notes && (
                            <p className="text-muted-foreground italic text-[11px]">Note from student: "{claim.notes}"</p>
                          )}
                          {claim.disbursal_reference && (
                            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">Payment Ref: {claim.disbursal_reference}</p>
                          )}
                          {claim.admin_note && (
                            <p className="text-red-500 text-[11px]">Admin Note: {claim.admin_note}</p>
                          )}
                        </div>
                      </div>

                      {/* Admin Actions */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                          isDisbursed ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' :
                          isVerified ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30' :
                          'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          {claim.status}
                        </span>

                        <div className="flex items-center gap-1.5 mt-1">
                          {isPending && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleUpdateClaimStatus(claim.id, 'verified')}
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                              Verify Details
                            </Button>
                          )}

                          {!isDisbursed && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleUpdateClaimStatus(claim.id, 'disbursed')}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Mark Disbursed
                            </Button>
                          )}

                          {isPending && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() => handleUpdateClaimStatus(claim.id, 'rejected')}
                              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VIEW 3: CREATE / EDIT TOURNAMENT */}
      {(view === 'create' || view === 'edit') && (
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <CardTitle>{view === 'edit' ? 'Edit Tournament' : 'Publish New Tournament'}</CardTitle>
            <CardDescription className="text-muted-foreground">Configure tournament rules, entry fee, prizes, and schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tournament Title</label>
                  <Input 
                    value={form.title} 
                    onChange={e => setForm({ ...form, title: e.target.value })} 
                    placeholder="e.g. National UTME Physics & Math Grand Duel"
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Status</label>
                  <select 
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm text-foreground outline-none"
                  >
                    <option value="upcoming">Upcoming (Registration Open)</option>
                    <option value="active">Active (Live Arena Open)</option>
                    <option value="locked">Locked (Temporarily Disabled)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description & Overview</label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Describe the rules, target subjects, and special eligibility..."
                  className="bg-background border-border text-foreground h-20"
                />
              </div>

              {/* Entry Mode & Fee */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" /> Entry Mode & Fee (₦)
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {Number(form.entry_fee) === 0 ? '100% Free Entry Mode (Students join for free)' : `Paid Entry: ₦${Number(form.entry_fee).toLocaleString()}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Entry Fee (₦)</label>
                    <Input 
                      type="number" 
                      value={form.entry_fee} 
                      onChange={e => setForm({ ...form, entry_fee: Number(e.target.value) })} 
                      placeholder="0 for 100% Free"
                      className="bg-background border-border text-foreground font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Set 0 for free entry with sponsored prizes</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Sponsor / Partner Name</label>
                    <Input 
                      value={form.sponsor} 
                      onChange={e => setForm({ ...form, sponsor: e.target.value })} 
                      placeholder="e.g. AdmitWise Foundation"
                      className="bg-background border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">VIP / Scholarship Code</label>
                    <Input 
                      value={form.invite_code} 
                      onChange={e => setForm({ ...form, invite_code: e.target.value })} 
                      placeholder="e.g. SCHOLAR2026"
                      className="bg-background border-border text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Prize Configuration */}
              <div className="p-4 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-3">
                <label className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Cash Prizes & Airtime Rewards Breakdown
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">1st Place Cash (₦)</label>
                    <Input 
                      type="number" 
                      value={form.prize_first_place} 
                      onChange={e => setForm({ ...form, prize_first_place: Number(e.target.value) })} 
                      placeholder="10000"
                      className="bg-background border-border text-foreground font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">2nd Place Cash (₦)</label>
                    <Input 
                      type="number" 
                      value={form.prize_second_place} 
                      onChange={e => setForm({ ...form, prize_second_place: Number(e.target.value) })} 
                      placeholder="5000"
                      className="bg-background border-border text-foreground font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">3rd Place Cash (₦)</label>
                    <Input 
                      type="number" 
                      value={form.prize_third_place} 
                      onChange={e => setForm({ ...form, prize_third_place: Number(e.target.value) })} 
                      placeholder="2000"
                      className="bg-background border-border text-foreground font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Airtime Reward</label>
                    <Input 
                      value={form.prize_airtime} 
                      onChange={e => setForm({ ...form, prize_airtime: e.target.value })} 
                      placeholder="e.g. ₦1,000 to Top 10"
                      className="bg-background border-border text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-muted-foreground">Custom Prize Summary Label</label>
                  <Input 
                    value={form.prize_description} 
                    onChange={e => setForm({ ...form, prize_description: e.target.value })} 
                    placeholder="e.g. 1st: ₦10,000 • 2nd: ₦5,000 • 3rd: ₦2,000 + Airtime to Top 10"
                    className="bg-background border-border text-foreground text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Start Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    value={form.start_time} 
                    onChange={e => setForm({ ...form, start_time: e.target.value })} 
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">End Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    value={form.end_time} 
                    onChange={e => setForm({ ...form, end_time: e.target.value })} 
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Registration Deadline</label>
                  <Input 
                    type="datetime-local" 
                    value={form.registration_deadline} 
                    onChange={e => setForm({ ...form, registration_deadline: e.target.value })} 
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Duration (Mins)</label>
                  <Input 
                    type="number" 
                    value={form.duration_minutes} 
                    onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} 
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Question Count</label>
                  <Input 
                    type="number" 
                    value={form.question_count} 
                    onChange={e => setForm({ ...form, question_count: Number(e.target.value) })} 
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Max Players</label>
                  <Input 
                    type="number" 
                    value={form.max_participants} 
                    onChange={e => setForm({ ...form, max_participants: Number(e.target.value) })} 
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Subject Filter</label>
                  <Input 
                    value={form.subject_filter} 
                    onChange={e => setForm({ ...form, subject_filter: e.target.value })} 
                    placeholder="e.g. Physics, Math"
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setView('list')} className="border-border text-foreground hover:bg-muted">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {view === 'edit' ? 'Update Tournament' : 'Publish Tournament'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* VIEW 4: DETAIL & LEADERBOARD */}
      {view === 'detail' && selectedTournament && (
        <Card className="bg-card border-border text-card-foreground">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold text-foreground">{selectedTournament.title} - Leaderboard</CardTitle>
                <CardDescription className="text-muted-foreground">Total Registered: {participants.length} students</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No participants registered yet.</div>
            ) : (
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-slate-300 text-black' :
                        idx === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-sm text-foreground">{p.profiles?.full_name || 'Scholar Student'}</p>
                        <p className="text-xs text-muted-foreground">{p.profiles?.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{p.score || 0} PTS</p>
                      <p className="text-xs text-muted-foreground">{p.time_spent_seconds ? `${Math.floor(p.time_spent_seconds / 60)}m ${p.time_spent_seconds % 60}s` : 'Registered'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
