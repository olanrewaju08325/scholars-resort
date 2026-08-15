import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Trash2, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

export const EventsTab = () => {
  const [mocks, setMocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form State
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(120);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchMocks = async () => {
    setLoading(true);
    const { data } = await supabase.from('mock_exams').select('*').order('start_time', { ascending: false });
    if (data) setMocks(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMocks();
  }, []);

  const handleCreateMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) return;
    
    setCreating(true);
    try {
      const { error } = await supabase.from('mock_exams').insert({
        title,
        duration_minutes: duration,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        is_active: true
      });
      if (error) throw error;
      
      setTitle('');
      setStartTime('');
      setEndTime('');
      toast.success("Event created successfully!");
      fetchMocks();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Delete Mock Exam", "Are you sure you want to delete this mock? This action cannot be undone.", async () => {
      await supabase.from('mock_exams').delete().eq('id', id);
      fetchMocks();
    }, { destructive: true });
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> Schedule Mock Exam
            </CardTitle>
            <CardDescription className="text-slate-400">Create a new synchronized mock/tournament.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMock} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm">Mock Title</label>
                <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. National Grand Mock v2" className="bg-slate-950 border-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Duration (Minutes)</label>
                <Input required type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-slate-950 border-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm">Start Time</label>
                  <Input required type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm">End Time</label>
                  <Input required type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Schedule Mock
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
             <CardTitle>Upcoming & Past Mocks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-slate-400">Loading...</p> : (
              <div className="space-y-3">
                {mocks.map(mock => (
                  <div key={mock.id} className="p-3 border border-slate-800 rounded-lg flex justify-between items-center bg-slate-950/50">
                    <div>
                      <h4 className="font-semibold text-sm">{mock.title}</h4>
                      <p className="text-xs text-slate-400">
                        {new Date(mock.start_time).toLocaleString()} - {mock.duration_minutes} mins
                      </p>
                    </div>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(mock.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {mocks.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No mock exams scheduled.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Remove the mock dummy leaderboards from Events tab since we'll build a real leaderboard page */}
    </div>
  );
};
