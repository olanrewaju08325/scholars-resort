import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, RefreshCw, BarChart, Plus, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const SubjectsTab = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchSubjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

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
        <Card className="bg-slate-900 border-slate-800 text-slate-100 md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" /> Platform Subjects
            </CardTitle>
            <CardDescription className="text-slate-400">Manage available subjects on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <form onSubmit={handleAddSubject} className="flex gap-2 mb-4">
              <Input 
                placeholder="Subject Name" 
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                className="bg-slate-950 border-slate-800 flex-1"
                required
              />
              <Input 
                placeholder="Icon (e.g. book)" 
                value={newSubjectIcon}
                onChange={e => setNewSubjectIcon(e.target.value)}
                className="bg-slate-950 border-slate-800 w-32"
              />
              <Button type="submit" disabled={adding}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {loading ? (
                <div className="text-center text-slate-500 py-4">Loading...</div>
              ) : subjects.length === 0 ? (
                <div className="text-center text-slate-500 py-4">No subjects found.</div>
              ) : subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-slate-800 rounded-md bg-slate-950/50">
                  <span className="font-medium flex items-center gap-2">
                    {s.is_active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-500" />}
                    {s.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(s.id, s.is_active)} className={s.is_active ? "text-red-400 border-red-900" : "text-green-400 border-green-900"}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Popularity / Analytics */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-400" /> Subject Popularity
            </CardTitle>
            <CardDescription className="text-slate-400">Most chosen 4-subject combos (Mock Data)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Eng, Math, Phy, Chem (Science)</span>
                  <span className="font-bold text-green-400">45%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Eng, Econs, Govt, Lit (Arts/Law)</span>
                  <span className="font-bold text-blue-400">30%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Eng, Math, Acct, Comm (Commercial)</span>
                  <span className="font-bold text-purple-400">25%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
