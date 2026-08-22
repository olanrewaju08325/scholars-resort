import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Trophy, Plus, Trash2, Users, Clock, Calendar, Edit2,
  CheckCircle, XCircle, Loader2, BarChart3, Medal, Zap, Sparkles, Lock, Unlock, ArrowLeft, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { callGroqAPI } from '@/services/aiService';

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
  question_source: 'mixed'
};

export const AdminTournamentsTab = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState('all');
  const { confirmAction, ConfirmElement } = useConfirm();

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, tournament_participants(count)')
      .order('created_at', { ascending: false });
    if (!error && data) setTournaments(data);
    setLoading(false);
  };

  const fetchParticipants = async (tournamentId: string) => {
    const { data } = await supabase
      .from('tournament_participants')
      .select('*, profiles!user_id(full_name, email)')
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false });
    if (data) setParticipants(data);
  };

  const handleAIGenerateWeeklyChallenge = async () => {
    setSaving(true);
    toast.info("Groq AI is generating a Weekly Challenge...");
    try {
      const prompt = `Generate a JSON configuration for a 'Weekly Challenge' JAMB UTME tournament for Nigerian students.
It should include:
- "title": exciting title (e.g. "Mega UTME Physics & Math Duel")
- "description": compelling description
- "prize_description": e.g. "₦25,000 Cash Prize + Scholar Badge"
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
        // Fallback: fix trailing commas if present
        const fixed = jsonCandidate.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(fixed);
      }
      
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() + (6 - now.getDay())); // Next Saturday
      start.setHours(10, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(12, 0, 0, 0); // 2 hours later
      
      setForm({
        ...EMPTY_FORM,
        title: parsed.title || "AI Weekly Challenge",
        description: parsed.description || "",
        prize_description: parsed.prize_description || "₦25,000 Cash Prize",
        duration_minutes: parsed.duration_minutes || 60,
        question_count: parsed.question_count || 50,
        subject_filter: parsed.subject_filter || "Mathematics",
        coin_reward: parsed.coin_reward || 500,
        xp_reward: parsed.xp_reward || 1500,
        start_time: start.toISOString().slice(0, 16),
        end_time: end.toISOString().slice(0, 16),
        registration_deadline: start.toISOString().slice(0, 16)
      });
      
      setView('create');
      toast.success("AI generated challenge! Please review and save.");
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
        prize_description: form.prize_description,
        cash_prize: Number(form.cash_prize),
        entry_fee: Number(form.entry_fee),
        sponsor: form.sponsor,
        scholarship_description: form.scholarship_description,
        status: form.status,
        is_private: form.is_private,
        invite_code: form.invite_code,
        coin_reward: Number(form.coin_reward),
        xp_reward: Number(form.xp_reward),
        difficulty: form.difficulty
      };

      if (view === 'edit' && form.id) {
        const { error } = await supabase.from('tournaments').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Tournament updated successfully!');
      } else {
        const { error } = await supabase.from('tournaments').insert(payload);
        if (error) throw error;
        toast.success('Tournament created successfully!');
      }

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
    const { error } = await supabase.from('tournaments').update({ status: newStatus }).eq('id', tournament.id);
    if (!error) {
      toast.success(`Tournament is now ${newStatus === 'locked' ? 'Locked (Students cannot enter)' : 'Unlocked'}`);
      fetchTournaments();
    } else {
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('tournaments').update({ status: newStatus }).eq('id', id);
    if (!error) {
      toast.success(`Tournament marked as ${newStatus}`);
      fetchTournaments();
    }
  };

  const handleDelete = (id: string) => {
    confirmAction(
      'Delete Tournament',
      'Are you sure? This will remove all participant and leaderboard records.',
      async () => {
        await supabase.from('tournament_participants').delete().eq('tournament_id', id);
        await supabase.from('tournaments').delete().eq('id', id);
        toast.success('Tournament deleted.');
        fetchTournaments();
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

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" /> Tournament & Battle Management
          </h2>
          <p className="text-slate-400">Create, edit, lock, unlock, and award prizes for live student tournaments.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {view !== 'list' && (
            <Button variant="outline" onClick={() => { setView('list'); setForm(EMPTY_FORM); }} className="border-slate-700">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to List
            </Button>
          )}
          {view === 'list' && (
            <>
              <Button onClick={handleAIGenerateWeeklyChallenge} disabled={saving} className="bg-purple-600 hover:bg-purple-700 font-bold">
                <Sparkles className="w-4 h-4 mr-2" /> AI Generate Challenge
              </Button>
              <Button onClick={() => { setForm(EMPTY_FORM); setView('create'); }} className="bg-primary hover:bg-primary/90 font-bold">
                <Plus className="w-4 h-4 mr-2" /> Create Tournament
              </Button>
            </>
          )}
        </div>
      </div>

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
                    ? 'bg-primary text-white'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-center py-12 text-slate-400">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-bold">No tournaments found in this category.</p>
              <p className="text-xs text-slate-500 mt-1">Create one manually or use AI generation above.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTournaments.map(t => {
                const count = t.tournament_participants?.[0]?.count || 0;
                const isLocked = t.status === 'locked';

                return (
                  <Card key={t.id} className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between hover:border-slate-700 transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          {isLocked && <Lock className="w-4 h-4 text-red-400" />}
                          {t.title}
                        </CardTitle>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          t.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          t.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                          t.status === 'locked' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <CardDescription className="text-slate-400 line-clamp-2 text-xs">
                        {t.description || 'No description provided.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-blue-400" /> {new Date(t.start_time).toLocaleDateString()}</div>
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> {t.duration_minutes} mins ({t.question_count} Qs)</div>
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-400" /> {count} / {t.max_participants} Players</div>
                        <div className="flex items-center gap-1.5 font-bold text-yellow-400 truncate"><Trophy className="w-3.5 h-3.5" /> {t.prize_description || 'XP Prize'}</div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(t)} className="h-8 px-2 text-xs border-slate-700 text-slate-300 hover:text-white">
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleToggleLock(t)} 
                            className={`h-8 px-2 text-xs border-slate-700 ${isLocked ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-red-400'}`}
                          >
                            {isLocked ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                            {isLocked ? 'Unlock' : 'Lock'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDetail(t)} className="h-8 px-2 text-xs border-slate-700 text-slate-300">
                            <Users className="w-3.5 h-3.5 mr-1" /> Players
                          </Button>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10">
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

      {(view === 'create' || view === 'edit') && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>{view === 'edit' ? 'Edit Tournament' : 'Create New Tournament'}</CardTitle>
            <CardDescription className="text-slate-400">Configure tournament rules, subject syllabus, dates, and reward prizes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tournament Title</label>
                  <Input 
                    value={form.title} 
                    onChange={e => setForm({ ...form, title: e.target.value })} 
                    placeholder="e.g. National UTME Grand Master Duel"
                    className="bg-slate-950 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select 
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 outline-none"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active (Live Now)</option>
                    <option value="locked">Locked (Disabled)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description & Overview</label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Describe the rules, target subjects, and special eligibility..."
                  className="bg-slate-950 border-slate-800 h-24"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    value={form.start_time} 
                    onChange={e => setForm({ ...form, start_time: e.target.value })} 
                    className="bg-slate-950 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    value={form.end_time} 
                    onChange={e => setForm({ ...form, end_time: e.target.value })} 
                    className="bg-slate-950 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Registration Deadline</label>
                  <Input 
                    type="datetime-local" 
                    value={form.registration_deadline} 
                    onChange={e => setForm({ ...form, registration_deadline: e.target.value })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (Mins)</label>
                  <Input 
                    type="number" 
                    value={form.duration_minutes} 
                    onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question Count</label>
                  <Input 
                    type="number" 
                    value={form.question_count} 
                    onChange={e => setForm({ ...form, question_count: Number(e.target.value) })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Players</label>
                  <Input 
                    type="number" 
                    value={form.max_participants} 
                    onChange={e => setForm({ ...form, max_participants: Number(e.target.value) })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject Filter</label>
                  <Input 
                    value={form.subject_filter} 
                    onChange={e => setForm({ ...form, subject_filter: e.target.value })} 
                    placeholder="e.g. Physics, Math"
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prize Description</label>
                  <Input 
                    value={form.prize_description} 
                    onChange={e => setForm({ ...form, prize_description: e.target.value })} 
                    placeholder="e.g. ₦50,000 Cash + Certificate"
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Coin Reward</label>
                  <Input 
                    type="number" 
                    value={form.coin_reward} 
                    onChange={e => setForm({ ...form, coin_reward: Number(e.target.value) })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">XP Reward</label>
                  <Input 
                    type="number" 
                    value={form.xp_reward} 
                    onChange={e => setForm({ ...form, xp_reward: Number(e.target.value) })} 
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setView('list')} className="border-slate-700">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-bold">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {view === 'edit' ? 'Update Tournament' : 'Publish Tournament'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {view === 'detail' && selectedTournament && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold">{selectedTournament.title} - Leaderboard</CardTitle>
                <CardDescription className="text-slate-400">Total Registered: {participants.length} students</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No participants registered yet.</div>
            ) : (
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-slate-300 text-black' :
                        idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-sm">{p.profiles?.full_name || 'Scholar Student'}</p>
                        <p className="text-xs text-slate-500">{p.profiles?.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{p.score || 0} PTS</p>
                      <p className="text-xs text-slate-500">{p.time_spent_seconds ? `${Math.floor(p.time_spent_seconds / 60)}m ${p.time_spent_seconds % 60}s` : 'Registered'}</p>
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
