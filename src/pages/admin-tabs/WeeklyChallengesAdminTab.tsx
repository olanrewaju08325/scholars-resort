import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Swords, Plus, Trash2, CheckCircle, XCircle, Sparkles, RefreshCw, Calendar, Clock, Database, ShieldAlert } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { callGroqAPI } from '@/services/aiService';

const SUBJECTS = ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'Geography', 'Commerce', 'Accounting'];

export const WeeklyChallengesAdminTab = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [loadingFromDB, setLoadingFromDB] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [difficultyFilter, setDifficultyFilter] = useState('hard');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split('T')[0];
  });
  const [weekEnd, setWeekEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 7); // Sunday
    return d.toISOString().split('T')[0];
  });
  const [questionJSON, setQuestionJSON] = useState('');
  const [title, setTitle] = useState('');

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    let items: any[] = [];
    try {
      const { data, error } = await supabase
        .from('weekly_challenges')
        .select('*')
        .order('week_start', { ascending: false });

      if (!error && data && data.length > 0) {
        items = data;
      }
    } catch {}

    if (items.length === 0) {
      try {
        const { data: settingData } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'weekly_challenges_db')
          .maybeSingle();
        if (settingData?.value && Array.isArray(settingData.value)) {
          items = settingData.value;
        }
      } catch {}
    }

    if (items.length === 0) {
      try {
        const localRaw = localStorage.getItem('scholar_weekly_challenges');
        if (localRaw) items = JSON.parse(localRaw);
      } catch {}
    }

    setChallenges(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Pull real question from database matching subject and difficulty
  const fetchQuestionFromDatabase = async () => {
    setLoadingFromDB(true);
    try {
      // Find matching subject
      const { data: subData } = await supabase
        .from('subjects')
        .select('id')
        .ilike('name', `%${selectedSubject}%`)
        .maybeSingle();

      let query = supabase.from('questions').select('*');
      if (subData?.id) {
        query = query.eq('subject_id', subData.id);
      }
      if (difficultyFilter !== 'all') {
        query = query.eq('difficulty', difficultyFilter);
      }

      const { data: dbQuestions, error } = await query.limit(10);

      if (error || !dbQuestions || dbQuestions.length === 0) {
        toast.info(`No existing ${difficultyFilter} questions found in database for ${selectedSubject}. Try switching difficulty to 'All' or use AI generation.`);
        setLoadingFromDB(false);
        return;
      }

      // Pick a random question from pool
      const randomQ = dbQuestions[Math.floor(Math.random() * dbQuestions.length)];
      let optionsArray = [];
      try {
        optionsArray = typeof randomQ.options === 'string' ? JSON.parse(randomQ.options) : randomQ.options;
      } catch {
        optionsArray = [randomQ.options];
      }

      const formattedData = {
        question: randomQ.question_text,
        options: optionsArray,
        correct_answer: randomQ.correct_answer || 'A',
        explanation: randomQ.explanation || 'Official UTME past question solution.',
        duration_minutes: durationMinutes,
        source: 'Real Past Question Database'
      };

      setQuestionJSON(JSON.stringify(formattedData, null, 2));
      if (!title) setTitle(`Weekly ${selectedSubject} Challenge (${durationMinutes} mins)`);
      toast.success(`Loaded real past question from ${selectedSubject} database!`);
    } catch (err: any) {
      toast.error('Could not pull from database: ' + err.message);
    }
    setLoadingFromDB(false);
  };

  const generateWithAI = async () => {
    setGeneratingAI(true);
    try {
      const prompt = `Generate a single challenging JAMB UTME multiple-choice question for ${selectedSubject}. Difficulty: ${difficultyFilter}.
Return STRICT JSON format:
{
  "question": "Question text here",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correct_answer": "A",
  "explanation": "Detailed step-by-step solution",
  "duration_minutes": ${durationMinutes}
}`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      let cleanText = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
        let parsed: any;
        try {
          parsed = JSON.parse(jsonCandidate);
        } catch {
          const fixed = jsonCandidate.replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(fixed);
        }
        parsed.duration_minutes = durationMinutes;
        setQuestionJSON(JSON.stringify(parsed, null, 2));
        if (!title) setTitle(`Weekly ${selectedSubject} AI Challenge`);
        toast.success('Question generated via Groq AI! Review and save.');
      } else {
        toast.error('AI response format unexpected. Review and edit manually.');
      }
    } catch (err: any) {
      toast.error(`AI generation failed: ${err.message}`);
    }
    setGeneratingAI(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionJSON.trim() || !title.trim()) {
      toast.error('Title and question data are required.');
      return;
    }

    try {
      const parsedQuestion = JSON.parse(questionJSON);
      parsedQuestion.duration_minutes = durationMinutes;

      const newChallenge = {
        id: `wc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title,
        subject: selectedSubject,
        question_data: parsedQuestion,
        week_start: weekStart,
        week_end: weekEnd,
        is_active: true,
        created_at: new Date().toISOString()
      };

      // 1. Try Supabase weekly_challenges table
      let savedToSupabase = false;
      try {
        const { error } = await supabase.from('weekly_challenges').insert({
          title,
          subject: selectedSubject,
          question_data: parsedQuestion,
          week_start: weekStart,
          week_end: weekEnd,
          is_active: true
        });
        if (!error) savedToSupabase = true;
      } catch {}

      // 2. Always sync to admin_settings and local storage
      try {
        const existing = [...challenges, newChallenge];
        await supabase.from('admin_settings').upsert({
          key: 'weekly_challenges_db',
          value: existing,
          updated_at: new Date().toISOString()
        });
        localStorage.setItem('scholar_weekly_challenges', JSON.stringify(existing));
      } catch {}

      toast.success('Weekly challenge created successfully!');
      setIsFormOpen(false);
      setTitle('');
      setQuestionJSON('');
      await fetchChallenges();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        toast.error('Invalid JSON format. Check your question structure.');
      } else {
        toast.error(`Failed to create challenge: ${err.message}`);
      }
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await supabase.from('weekly_challenges').update({ is_active: !currentState }).eq('id', id);
    } catch {}

    const updated = challenges.map(c => c.id === id ? { ...c, is_active: !currentState } : c);
    setChallenges(updated);
    try {
      await supabase.from('admin_settings').upsert({
        key: 'weekly_challenges_db',
        value: updated,
        updated_at: new Date().toISOString()
      });
      localStorage.setItem('scholar_weekly_challenges', JSON.stringify(updated));
    } catch {}
    toast.success(`Challenge ${!currentState ? 'activated' : 'deactivated'}.`);
  };

  const handleDelete = (id: string) => {
    confirmAction('Delete Challenge', 'Delete this weekly challenge and all student submissions?', async () => {
      try {
        await supabase.from('weekly_challenges').delete().eq('id', id);
      } catch {}

      const updated = challenges.filter(c => c.id !== id);
      setChallenges(updated);
      try {
        await supabase.from('admin_settings').upsert({
          key: 'weekly_challenges_db',
          value: updated,
          updated_at: new Date().toISOString()
        });
        localStorage.setItem('scholar_weekly_challenges', JSON.stringify(updated));
      } catch {}
      toast.success('Challenge deleted.');
      fetchChallenges();
    }, { destructive: true });
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Swords className="w-6 h-6 text-primary" /> Weekly Challenges Manager
          </h2>
          <p className="text-muted-foreground text-sm">Configure timed weekly student competitions using real past questions or Groq AI.</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-primary hover:bg-primary/90 font-bold">
          <Plus className="w-4 h-4 mr-2" /> New Weekly Challenge
        </Button>
      </div>

      {/* Create Form */}
      {isFormOpen && (
        <Card className="bg-card border-border text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle>Create New Timed Challenge</CardTitle>
            <CardDescription>Pull real questions directly from your database or generate with AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Challenge Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Physics Weekly Hard Challenge" className="bg-background border-border" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
                  <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary text-foreground">
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Timer / Duration</label>
                  <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary text-foreground font-semibold">
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={20}>20 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Difficulty Filter</label>
                  <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}
                    className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary text-foreground">
                    <option value="hard">Hard Questions Only</option>
                    <option value="medium">Medium Questions</option>
                    <option value="all">All Difficulties</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Week Start</label>
                  <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="bg-background border-border" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Week End</label>
                  <Input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} className="bg-background border-border" required />
                </div>
              </div>

              {/* Data Loaders */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" onClick={fetchQuestionFromDatabase} disabled={loadingFromDB} variant="outline" className="flex-1 font-bold gap-2">
                      {loadingFromDB ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-primary" />}
                      {loadingFromDB ? 'Loading...' : 'Pull Real Past Question from Database'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fetch an authentic past JAMB question directly from storage</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" onClick={generateWithAI} disabled={generatingAI} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2">
                      {generatingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generatingAI ? 'Generating...' : 'AI Generate Hard Question'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Synthesize a high-order reasoning challenge question with AI</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question Data (JSON Format)</label>
                <textarea
                  value={questionJSON}
                  onChange={e => setQuestionJSON(e.target.value)}
                  className="w-full h-40 bg-background border border-border rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-primary outline-none text-foreground"
                  placeholder='{"question": "...", "options": ["A) ...", "B) ..."], "correct_answer": "A", "explanation": "..."}'
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 font-bold">Publish Challenge</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Challenges List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading weekly challenges...</div>
        ) : challenges.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Swords className="w-12 h-12 mx-auto mb-4 opacity-30 text-primary" />
              <p className="font-semibold">No active or past weekly challenges.</p>
              <p className="text-xs mt-1">Click "New Weekly Challenge" above to configure your first competition.</p>
            </CardContent>
          </Card>
        ) : challenges.map(challenge => {
          const q = challenge.question_data;
          const duration = q?.duration_minutes || 15;
          return (
            <Card key={challenge.id} className={`bg-card border-border text-card-foreground transition-all shadow-sm ${!challenge.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">{challenge.title}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/10 text-primary">{challenge.subject}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {duration} Mins
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${challenge.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {challenge.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{q?.question}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {challenge.week_start} → {challenge.week_end}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(challenge.id, challenge.is_active)}
                          className="h-8 text-xs font-semibold">
                          {challenge.is_active ? <XCircle className="w-3.5 h-3.5 mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                          {challenge.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{challenge.is_active ? 'Unpublish challenge from student leaderboard' : 'Publish challenge for active student leaderboard'}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(challenge.id)} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Permanently delete this weekly competition</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
