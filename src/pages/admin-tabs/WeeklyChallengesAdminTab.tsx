import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Swords, Plus, Trash2, Users, CheckCircle, XCircle, Sparkles, RefreshCw, Calendar } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { callGroqAPI } from '@/services/aiService';

const SUBJECTS = ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'Geography', 'Commerce', 'Accounting'];

export const WeeklyChallengesAdminTab = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [selectedSubject, setSelectedSubject] = useState('Physics');
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

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('weekly_challenges')
      .select('*')
      .order('week_start', { ascending: false });

    if (!error && data) setChallenges(data);
    setLoading(false);
  };

  const generateWithAI = async () => {
    setGeneratingAI(true);
    try {
      const prompt = `Generate a single challenging JAMB UTME multiple-choice question for ${selectedSubject}.
Return STRICT JSON format:
{
  "question": "Question text here",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correct_answer": "A",
  "explanation": "Detailed step-by-step solution"
}`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setQuestionJSON(JSON.stringify(parsed, null, 2));
        if (!title) setTitle(`Weekly ${selectedSubject} Challenge`);
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
      const { error } = await supabase.from('weekly_challenges').insert({
        title,
        subject: selectedSubject,
        question_data: parsedQuestion,
        week_start: weekStart,
        week_end: weekEnd,
        is_active: true
      });

      if (error) throw error;
      toast.success('Weekly challenge created!');
      setIsFormOpen(false);
      setTitle('');
      setQuestionJSON('');
      fetchChallenges();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        toast.error('Invalid JSON. Check the question format.');
      } else {
        toast.error(`Failed to create challenge: ${err.message}`);
      }
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase.from('weekly_challenges').update({ is_active: !currentState }).eq('id', id);
    if (!error) {
      setChallenges(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentState } : c));
      toast.success(`Challenge ${!currentState ? 'activated' : 'deactivated'}.`);
    }
  };

  const handleDelete = (id: string) => {
    confirmAction('Delete Challenge', 'Delete this weekly challenge and all submissions?', async () => {
      const { error } = await supabase.from('weekly_challenges').delete().eq('id', id);
      if (!error) {
        toast.success('Challenge deleted.');
        fetchChallenges();
      }
    }, { destructive: true });
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="w-6 h-6 text-primary" /> Weekly Challenges
          </h2>
          <p className="text-slate-400">Create and manage weekly student challenges with XP rewards.</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> New Challenge
        </Button>
      </div>

      {/* Create Form */}
      {isFormOpen && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Create Weekly Challenge</CardTitle>
            <CardDescription className="text-slate-400">Use AI to generate a question or paste your own JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Physics Week" className="bg-slate-950 border-slate-800" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full h-10 bg-slate-950 border border-slate-800 rounded-md px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium invisible">Generate</label>
                  <Button type="button" onClick={generateWithAI} disabled={generatingAI} className="w-full bg-purple-600 hover:bg-purple-700 h-10">
                    {generatingAI ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {generatingAI ? 'Generating...' : 'AI Generate'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Week Start</label>
                  <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="bg-slate-950 border-slate-800" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Week End</label>
                  <Input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} className="bg-slate-950 border-slate-800" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Question JSON</label>
                <div className="text-xs text-slate-500 mb-1">
                  Format: <code className="bg-slate-800 px-1 rounded">{"{ \"question\": \"...\", \"options\": [\"A) ...\", \"B) ...\", \"C) ...\", \"D) ...\"], \"answer\": \"A\", \"explanation\": \"...\" }"}</code>
                </div>
                <textarea
                  value={questionJSON}
                  onChange={e => setQuestionJSON(e.target.value)}
                  className="w-full h-40 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                  placeholder='{"question": "...", "options": ["A) ...", "B) ..."], "answer": "A", "explanation": "..."}'
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="border-slate-700 hover:bg-slate-800">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">Create Challenge</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Challenges List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading challenges...</div>
        ) : challenges.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-16 text-center text-slate-500">
              <Swords className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No weekly challenges created yet.</p>
            </CardContent>
          </Card>
        ) : challenges.map(challenge => {
          const q = challenge.question_data;
          return (
            <Card key={challenge.id} className={`bg-slate-900 border-slate-800 text-slate-100 transition-all ${!challenge.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg">{challenge.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400">{challenge.subject}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${challenge.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {challenge.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2 mb-3">{q?.question}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {challenge.week_start} → {challenge.week_end}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(challenge.id, challenge.is_active)}
                      className={`h-8 text-xs ${challenge.is_active ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-green-800/40 text-green-400 hover:bg-green-950'}`}>
                      {challenge.is_active ? <XCircle className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                      {challenge.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(challenge.id)} className="h-8 text-red-400 hover:text-red-300 hover:bg-red-950">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
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
