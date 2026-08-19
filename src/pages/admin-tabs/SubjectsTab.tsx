import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, BarChart, Plus, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const SubjectsTab = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectStats, setSubjectStats] = useState<Array<{ id: string; name: string; count: number; percentage: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subData } = await supabase.from('subjects').select('*').order('name');
      const loadedSubjects = subData || [];
      setSubjects(loadedSubjects);

      // Fetch dynamic question counts per subject
      const { data: qData } = await supabase.from('questions').select('subject_id');
      const totalQs = qData?.length || 0;

      const countsMap: Record<string, number> = {};
      qData?.forEach((q: any) => {
        if (q.subject_id) {
          countsMap[q.subject_id] = (countsMap[q.subject_id] || 0) + 1;
        }
      });

      const stats = loadedSubjects.map((s: any) => {
        const count = countsMap[s.id] || 0;
        const percentage = totalQs > 0 ? Math.round((count / totalQs) * 100) : 0;
        return { id: s.id, name: s.name, count, percentage };
      });

      setSubjectStats(stats);
    } catch (err) {
      console.warn('Error loading subjects:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName) return;
    setAdding(true);
    const { error } = await supabase.from('subjects').insert({
      name: newSubjectName,
      icon: newSubjectIcon || 'book',
      is_active: true
    });
    if (!error) {
      toast.success('Subject added successfully!');
      setNewSubjectName('');
      setNewSubjectIcon('');
      fetchSubjects();
    } else {
      toast.error('Failed to add subject.');
    }
    setAdding(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('subjects').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      toast.success(`Subject ${!currentStatus ? 'activated' : 'deactivated'}.`);
      fetchSubjects();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Subject List & Management */}
        <Card className="bg-card border-border text-foreground md:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Platform Subjects
            </CardTitle>
            <CardDescription>Manage available subjects on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <form onSubmit={handleAddSubject} className="flex gap-2 mb-4">
              <Input 
                placeholder="Subject Name" 
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                className="bg-background border-border flex-1"
                required
              />
              <Input 
                placeholder="Icon (e.g. book)" 
                value={newSubjectIcon}
                onChange={e => setNewSubjectIcon(e.target.value)}
                className="bg-background border-border w-32"
              />
              <Button type="submit" disabled={adding} className="font-bold">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {loading ? (
                <div className="text-center text-muted-foreground py-4">Loading subjects...</div>
              ) : subjects.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">No subjects found.</div>
              ) : subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-muted/20">
                  <span className="font-medium flex items-center gap-2 text-sm">
                    {s.is_active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                    {s.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(s.id, s.is_active)} className={s.is_active ? "text-red-500 border-red-500/30" : "text-green-500 border-green-500/30"}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Question Counts & Distribution */}
        <Card className="bg-card border-border text-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-500" /> Question Distribution Per Subject
            </CardTitle>
            <CardDescription>Live question counts and percentages calculated dynamically from database.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Calculating question counts...</div>
            ) : subjectStats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No subjects or questions stored yet.</div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {subjectStats.map((stat, idx) => {
                  const colors = ['bg-primary', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-indigo-500', 'bg-rose-500'];
                  const colorClass = colors[idx % colors.length];
                  return (
                    <div key={stat.id}>
                      <div className="flex justify-between text-sm mb-1 font-semibold">
                        <span className="text-foreground">{stat.name}</span>
                        <span className="text-primary font-mono">{stat.count} Qs ({stat.percentage}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`${colorClass} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.max(stat.percentage, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
